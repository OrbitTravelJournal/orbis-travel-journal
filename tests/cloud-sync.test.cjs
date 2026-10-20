const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const path=require('node:path');
const root=path.join(__dirname,'..');
const canonical=v=>JSON.stringify((function sort(x){return Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x})(v));
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const trip=(photo='')=>({id:'trip',name:'Japan',days:[],hotels:[],hotelMedia:{Kyoto:{photo}}});
const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
function backend(initial){
  let row=initial?structuredClone(initial):null;
  const calls=[];
  const context={Request,Response,URL,TextEncoder,crypto:webcrypto,AbortSignal,
    Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://db.example':'server-secret'},serve(){}},
    createRemoteJWKSet:()=>({}),jwtVerify:async()=>{throw Error('invalid')},
    async fetch(url,options={}){
      calls.push({url,options});const u=new URL(url),q=u.searchParams;
      if(u.pathname.endsWith('/orbis_sessions'))return json([{google_sub:'owner',expires_at:'2099-01-01',max_expires_at:'2099-02-01'}]);
      if(u.pathname.endsWith('/rpc/orbis_save_workspace_raw')){
        assert.equal(options.headers['Content-Type'],'application/octet-stream');
        const data=JSON.parse(options.body);assert.equal(data.p_sub,'owner');
        if(data.p_version===0?!!row:!row||row.version!==data.p_version)return json(null);
        row={google_sub:data.p_sub,snapshot:data.p_snapshot,version:data.p_version+1,updated_at:'now'};
        return json({version:row.version,updatedAt:row.updated_at});
      }
      assert.equal(u.pathname,'/rest/v1/orbis_workspaces');
      if(options.method==='POST'){
        assert.equal(q.get('on_conflict'),'google_sub');assert.match(options.headers.Prefer,/ignore-duplicates/);
        if(row)return json([]);
        row=JSON.parse(options.body);assert.equal(row.google_sub,'owner');
        return json([{version:row.version,updated_at:row.updated_at}]);
      }
      assert.equal(q.get('google_sub'),'eq.owner');
      if(options.method==='PATCH'){
        if(!row||q.get('version')!==`eq.${row.version}`)return json([]);
        const value=JSON.parse(options.body);assert.equal(value.google_sub,undefined);
        row={...row,...value};return json([{version:row.version,updated_at:row.updated_at}]);
      }
      if(!row)return json([]);
      return json(q.get('select')==='version,updated_at'?[{version:row.version,updated_at:row.updated_at}]:[row]);
    }};
  const src=fs.readFileSync(path.join(root,'cloud-edge.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export async function handle','async function handle');
  vm.createContext(context);vm.runInContext(src,context);
  const request=(method='GET',data,query='',token='orbis_'+'a'.repeat(64))=>context.handle(new Request('https://sync.example/'+query,{method,headers:{Authorization:'Bearer '+token,Origin:'https://orbittraveljournal.github.io',...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}));
  return {request,calls,row:()=>row};
}
test('unchanged version returns metadata without fetching 10MB of photographs',async()=>{
  const b=backend({google_sub:'owner',version:275,updated_at:'today',snapshot:[trip('x'.repeat(10*1024*1024))]});
  const r=await b.request('GET',undefined,'?knownVersion=275');
  const text=await r.text();assert.ok(text.length<300);assert.equal(JSON.parse(text).unchanged,true);
  assert.equal(b.calls.filter(c=>c.url.includes('select=snapshot')).length,0);
});
test('changed version and old clients still receive full photograph data',async()=>{
  for(const query of ['','?knownVersion=274']){
    const b=backend({version:275,snapshot:[trip('data:image/jpeg;base64,photo')]});
    const r=await b.request('GET',undefined,query);assert.equal((await r.json()).snapshot[0].hotelMedia.Kyoto.photo,'data:image/jpeg;base64,photo');
  }
});
test('metadata endpoint requires a verified session',async()=>{
  const b=backend();const r=await b.request('GET',undefined,'?knownVersion=275','forged');
  assert.equal(r.status,401);assert.equal(b.calls.length,0);
});
test('11MB snapshot saves intact through the raw-body adapter',async()=>{
  const b=backend({google_sub:'owner',version:275});const image='x'.repeat(11*1024*1024);
  const r=await b.request('POST',{clientVersion:2,version:275,snapshot:[trip(image)]});
  assert.equal(r.status,200);assert.equal((await r.json()).version,276);assert.equal(b.row().snapshot[0].hotelMedia.Kyoto.photo,image);
});
test('concurrent same-version writes accept one and reject the other',async()=>{
  const b=backend({google_sub:'owner',version:275});
  const rs=await Promise.all(['first','second'].map(photo=>b.request('POST',{clientVersion:2,version:275,snapshot:[trip(photo)]})));
  assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal(b.row().version,276);
});
test('initial upload does not overwrite an existing account',async()=>{
  const b=backend({google_sub:'owner',version:275,snapshot:[trip('original')]});
  assert.equal((await b.request('POST',{clientVersion:2,version:0,snapshot:[trip('old')]})).status,409);
  assert.equal(b.row().snapshot[0].hotelMedia.Kyoto.photo,'original');
  const fresh=backend();assert.equal((await fresh.request('POST',{clientVersion:2,version:0,snapshot:[trip('new')]})).status,200);
  assert.equal(fresh.row().version,1);
});
test('oversized uploads leave the current workspace untouched',async()=>{
  const b=backend({version:275});const r=await b.request('POST',{clientVersion:2,version:275,snapshot:[trip('x'.repeat(12*1024*1024))]});
  assert.equal(r.status,413);assert.equal(b.row().version,275);
});
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setTimeout(resolve,2));};
function frontend({local,remote,meta,error,bodyError,status=200}={}){
  const localTrip=local||trip('photo');const snapshot=remote||[trip('photo')];
  const state={currentUserId:'user',currentTripId:'trip',users:[{id:'user',googleId:'owner'}],trips:[{...structuredClone(localTrip),ownerId:'user'}]};
  const values=new Map([['orbis-account-session',JSON.stringify({sub:'owner',token:'session',exp:Date.now()/1000+3600,persistent:true})],['tabi-workspace-v1',JSON.stringify(state)]]);
  if(meta)values.set('orbis-cloud-meta:owner',JSON.stringify(meta));
  const controls=new Map();const control=id=>{if(!controls.has(id))controls.set(id,{hidden:false,textContent:'',append(){}});return controls.get(id)};
  const calls=[];const timeouts=[];
  const db={transaction(){const tx={objectStore(){return {put(){const r={};setImmediate(()=>{r.onsuccess?.();tx.oncomplete?.()});return r}}}};return tx},close(){}};
  const context={console,TextEncoder,crypto:webcrypto,Date,Promise,JSON,Response,
    AbortSignal:{timeout:ms=>{timeouts.push(ms);return undefined}},
    localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},sessionStorage:{getItem:()=>null,removeItem(){}},
    document:{hidden:false,createElement:()=>({id:'',innerHTML:'',querySelector:control}),querySelector:control,addEventListener(){}},
    indexedDB:{open(){const r={result:db};setImmediate(()=>r.onsuccess());return r}},
    setInterval(){},clearTimeout(){},setTimeout:(fn,ms)=>ms===0?setImmediate(fn):0,
    async fetch(url,options){calls.push({url,options});if(error)throw error;
      if(bodyError)return {status:200,ok:true,json:async()=>{throw bodyError}};
      if(options.method==='POST')return json({version:276});
      return json(url.includes('knownVersion=275')?{unchanged:true,version:275}:{version:275,snapshot},status);
    }};
  context.window={addEventListener(){},TabiWorkspace:{state,ready:Promise.resolve(),persist(){values.set('tabi-workspace-v1',JSON.stringify(state));return true},loadTrip(){},renderTrips(){},openAuth(){},flush:async()=>{}}};
  vm.createContext(context);
  let src=fs.readFileSync(path.join(root,'cloud-sync.js'),'utf8');
  src=src.replace('if(valid()&&!session.persistent)', 'window.__testSync={check,upload,request}; if(valid()&&!session.persistent)');
  vm.runInContext(src,context);return {context,state,calls,timeouts,controls,api:context.window.__testSync};
}
test('unchanged polls do not download photographs',async()=>{
  const f=frontend({meta:{version:275,hash:hash([trip('photo')]),savedHash:hash([trip('photo')])}});await settle();
  assert.equal(f.calls.length,1);assert.match(f.calls[0].url,/knownVersion=275/);
  assert.match(f.controls.get('#cloud-sync-status').textContent,/资料一致/);
});
test('local photograph edits upload after a lightweight version check',async()=>{
  const f=frontend({local:trip('afternoon-photo'),meta:{version:275,hash:hash([trip('old-photo')])}});await settle();
  const post=f.calls.find(c=>c.options.method==='POST');assert.ok(post);
  assert.equal(JSON.parse(post.options.body).snapshot[0].hotelMedia.Kyoto.photo,'afternoon-photo');
  assert.ok(f.timeouts.every(ms=>ms===120000));
});
test('a restored stale local cache is downloaded again, never uploaded as an edit',async()=>{
  const f=frontend({local:trip('stale'),remote:[trip('new')],meta:{version:275,hash:hash([trip('new')]),savedHash:hash([trip('stale')])}});await settle();
  assert.equal(f.calls.filter(c=>c.options.method==='POST').length,0);
  assert.equal(f.calls.length,2);assert.equal(f.state.trips[0].hotelMedia.Kyoto.photo,'new');
});
test('request and response-body timeouts preserve local photographs with a clear message',async()=>{
  for(const type of ['error','bodyError']){
    const e=Object.assign(Error('signal timed out'),{name:'TimeoutError'});
    const f=frontend({[type]:e});await settle();
    assert.match(f.controls.get('#cloud-sync-status').textContent,/超时/);
    assert.equal(f.state.trips[0].hotelMedia.Kyoto.photo,'photo');
  }
});
test('an expired session and oversized snapshot show actionable errors',async()=>{
  for(const [status,message] of [[401,/Google/],[413,/12MB/]]){
    const f=frontend({status});await settle();assert.match(f.controls.get('#cloud-sync-status').textContent,message);
  }
});
