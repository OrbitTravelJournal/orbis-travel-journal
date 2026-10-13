import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.0';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const audience='410563003589-0gt2acjlughfar1kgsril4dlumgq4ikr.apps.googleusercontent.com';
const origins=new Set(['https://orbittraveljournal.github.io','http://127.0.0.1:4183','http://localhost:4183']);
export async function handle(req){
  const origin=req.headers.get('Origin')||'';
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}:{})};
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.has(origin))return reply({error:'Origin not allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['GET','POST'].includes(req.method))return reply({error:'Method not allowed'},405);
  let identity;
  try{
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
    const {payload}=await jwtVerify(token,keys,{audience,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],requiredClaims:['sub','exp','iat','email']});
    if(payload.email_verified!==true||typeof payload.sub!=='string')throw new Error('Invalid identity');
    identity=payload;
  }catch{return reply({error:'Please sign in with Google again'},401);}
  const base=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const dbHeaders={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
  try{
    if(req.method==='GET'){
      const r=await fetch(`${base}/rest/v1/orbis_workspaces?google_sub=eq.${encodeURIComponent(identity.sub)}&select=snapshot,version,updated_at`,{headers:dbHeaders});
      if(!r.ok)throw new Error('Database unavailable');
      const rows=await r.json(),row=rows[0];
      return reply({account:identity.sub,email:identity.email,snapshot:row?.snapshot??null,version:row?.version??0,updatedAt:row?.updated_at??null});
    }
    if(Number(req.headers.get('Content-Length')||0)>12*1024*1024)return reply({error:'Snapshot is too large'},413);
    const raw=await req.text();if(new TextEncoder().encode(raw).length>12*1024*1024)return reply({error:'Snapshot is too large'},413);
    let data;try{data=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400);}
    if(!Number.isSafeInteger(data.version)||data.version<0||!Array.isArray(data.snapshot)||data.snapshot.length>200||data.snapshot.some(t=>!t||typeof t.id!=='string'||typeof t.name!=='string'||!Array.isArray(t.days)||!Array.isArray(t.hotels)||t.days.some(d=>!d||!Array.isArray(d.items))))return reply({error:'Invalid workspace'},400);
    const r=await fetch(`${base}/rest/v1/rpc/orbis_save_workspace`,{method:'POST',headers:dbHeaders,body:JSON.stringify({p_sub:identity.sub,p_snapshot:data.snapshot,p_version:data.version})});
    if(!r.ok)throw new Error('Database unavailable');
    const saved=await r.json();return saved?reply(saved):reply({error:'Another device changed this workspace'},409);
  }catch{return reply({error:'Cloud unavailable; keep your local copy'},503);}
}
Deno.serve(handle);
