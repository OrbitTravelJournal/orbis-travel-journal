import { handleBookingFiles } from './booking-file-service.js';
import { lookupPlaces } from './place-lookup.js';
import { photoStore } from './photo-service.js';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.0';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const audience='410563003589-0gt2acjlughfar1kgsril4dlumgq4ikr.apps.googleusercontent.com';
const origins=new Set(['https://orbittraveljournal.github.io','http://127.0.0.1:4183','http://localhost:4183']);
export async function handle(req){
  const origin=req.headers.get('Origin')||'';
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}:{})};
  let sessionExpiry;
  const reply=(body,status=200)=>new Response(JSON.stringify({...body,...(status===200&&sessionExpiry?{sessionExpiresAt:sessionExpiry}:{})}),{status,headers});
  if(origin&&!origins.has(origin))return reply({error:'Origin not allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['GET','POST'].includes(req.method))return reply({error:'Method not allowed'},405);
  const base=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const dbHeaders={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
  const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  let identity,sessionHash=null,googleVerified=false;
  try{
    if(/^orbis_[0-9a-f]{64}$/.test(token)){
      sessionHash=await digest(token);
      const r=await fetch(`${base}/rest/v1/orbis_sessions?token_hash=eq.${sessionHash}&select=google_sub,expires_at,max_expires_at`,{headers:dbHeaders});
      if(!r.ok)return reply({error:'Session service unavailable'},503);
      const row=(await r.json())[0];
      if(!row||Date.parse(row.expires_at)<=Date.now()||Date.parse(row.max_expires_at)<=Date.now())throw new Error('Expired session');
      identity={sub:row.google_sub};sessionExpiry=row.expires_at;
      if(Date.parse(row.expires_at)-Date.now()<14*86400000){
        const expiry=new Date(Math.min(Date.now()+30*86400000,Date.parse(row.max_expires_at))).toISOString();
        const renewed=await fetch(`${base}/rest/v1/orbis_sessions?token_hash=eq.${sessionHash}`,{method:'PATCH',headers:dbHeaders,body:JSON.stringify({expires_at:expiry})});
        if(renewed.ok)sessionExpiry=expiry;
      }
    }else{
      const {payload}=await jwtVerify(token,keys,{audience,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],requiredClaims:['sub','exp','iat','email']});
      if(payload.email_verified!==true||typeof payload.sub!=='string')throw new Error('Invalid identity');
      identity=payload;googleVerified=true;
    }
  }catch{return reply({error:'Please sign in with Google again'},401);}
  try{
    if(req.method==='GET'){
      const known=new URL(req.url).searchParams.get('knownVersion');
      if(known&&/^[1-9][0-9]*$/.test(known)){
        const meta=await fetch(`${base}/rest/v1/orbis_workspaces?google_sub=eq.${encodeURIComponent(identity.sub)}&select=version,updated_at`,{headers:dbHeaders,signal:AbortSignal.timeout(15000)});
        if(!meta.ok)throw new Error('Database unavailable');
        const row=(await meta.json())[0];
        if(row&&String(row.version)===known)return reply({account:identity.sub,unchanged:true,version:row.version,updatedAt:row.updated_at});
      }
      const r=await fetch(`${base}/rest/v1/orbis_workspaces?google_sub=eq.${encodeURIComponent(identity.sub)}&select=snapshot,version,updated_at`,{headers:dbHeaders});
      if(!r.ok)throw new Error('Database unavailable');
      const rows=await r.json(),row=rows[0];
      return reply({account:identity.sub,email:identity.email,snapshot:row?.snapshot??null,version:row?.version??0,updatedAt:row?.updated_at??null});
    }
    if(Number(req.headers.get('Content-Length')||0)>12*1024*1024)return reply({error:'Snapshot is too large'},413);
    const raw=await req.text();if(new TextEncoder().encode(raw).length>12*1024*1024)return reply({error:'Snapshot is too large'},413);
    let data;try{data=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400);}
    if(data.action==='session'){
      if(!googleVerified)return reply({error:'Google verification required'},403);
      const value='orbis_'+[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
      const expiresAt=new Date(Date.now()+30*86400000).toISOString(),maxExpiresAt=new Date(Date.now()+90*86400000).toISOString();
      const created=await fetch(`${base}/rest/v1/orbis_sessions`,{method:'POST',headers:dbHeaders,body:JSON.stringify({token_hash:await digest(value),google_sub:identity.sub,expires_at:expiresAt,max_expires_at:maxExpiresAt})});
      if(!created.ok)throw new Error('Session creation failed');
      return reply({sessionToken:value,account:identity.sub,expiresAt});
    }
    if(typeof data.action==='string'&&data.action.startsWith('photos-')){
      try{
        const photos=await photoStore({base,headers:dbHeaders,sub:identity.sub});
        if(data.action==='photos-upload')return reply(await photos.upload(data.data));
        if(data.action==='photos-sign')return reply(await photos.sign(data.urls));
        if(data.action==='photos-migrate')return reply(await photos.migrate());
        return reply({error:'未知照片操作。'},400);
      }catch(error){return reply({error:error.status?error.message:'照片服务暂不可用，原照片保留。'},error.status||503);}
    }
    if(typeof data.action==='string'&&data.action.startsWith('files-')){
      try{return reply(await handleBookingFiles(data,{base,headers:dbHeaders,sub:identity.sub}));}catch(error){return reply({error:error.status?error.message:'文件服务暂不可用，请稍后重试。'},error.status||503);}
    }
    if(data.action==='lookup'){
      if(typeof data.query!=='string'||!data.query.trim()||data.query.length>160)return reply({error:'Invalid place name'},400);
      try{return reply({places:await lookupPlaces(data.query.trim())})}catch{return reply({error:'Place source unavailable'},502)}
    }
    if(data.action==='logout'){
      if(sessionHash){const r=await fetch(`${base}/rest/v1/orbis_sessions?token_hash=eq.${sessionHash}`,{method:'DELETE',headers:dbHeaders});if(!r.ok)throw new Error('Session revocation failed');}
      return reply({ok:true});
    }
    if(data.clientVersion!==2)return reply({error:'Please update the app before syncing'},426);
    if(!Number.isSafeInteger(data.version)||data.version<0||!Array.isArray(data.snapshot)||data.snapshot.length>200||data.snapshot.some(t=>!t||typeof t.id!=='string'||typeof t.name!=='string'||!Array.isArray(t.days)||!Array.isArray(t.hotels)||t.days.some(d=>!d||!Array.isArray(d.items))))return reply({error:'Invalid workspace'},400);
    // Older clients may still send embedded images. Normalize them as well, so
    // a stale open tab cannot reintroduce photo bytes into cloud workspaces.
    let linked;
    try{linked=(await (await photoStore({base,headers:dbHeaders,sub:identity.sub})).externalize(data.snapshot)).snapshot;}
    catch(error){return reply({error:error.status?error.message:'照片上传未完成，原资料保留。'},error.status||503);}
    // Raw bytes avoid repeated large JSON extraction in PostgREST. The server-only
    // adapter parses once and calls the existing atomic, version-checked save.
    const r=await fetch(`${base}/rest/v1/rpc/orbis_save_workspace_raw`,{method:'POST',headers:{...dbHeaders,'Content-Type':'application/octet-stream'},body:JSON.stringify({p_sub:identity.sub,p_snapshot:linked,p_version:data.version}),signal:AbortSignal.timeout(45000)});
    if(!r.ok)throw new Error('Database unavailable');
    const saved=await r.json();return saved?reply(saved):reply({error:'Another device changed this workspace'},409);
  }catch{return reply({error:'Cloud unavailable; keep your local copy'},503);}
}
Deno.serve(handle);

