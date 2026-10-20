const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {webcrypto,createHash}=require('node:crypto');
const root=path.join(__dirname,'..');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC9sAAAAASUVORK5CYII=';
const digest=v=>createHash('sha256').update(v).digest('hex');
const base='https://owpxeksiaywnacomkwog.supabase.co';
const objectRoot=base+'/storage/v1/object/orbis-trip-photos/';
const trip=photo=>[{id:'trip',name:'Trip',days:[{items:[['','','','','',{photo,journalPhotos:[photo]}]]}],hotels:[],hotelMedia:{hotel:{photo}},saved:[{photo}]}];
function service(initial,{failUpload=false,conflict=false}={}){
  let row=initial?structuredClone(initial):null;const objects=new Map(),calls=[];
  const context={crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa,AbortSignal,
    async fetch(url,options={}){
      calls.push({url,options});const u=new URL(url);
      if(u.pathname.startsWith('/storage/v1/object/sign/'))return new Response(JSON.stringify({signedURL:u.pathname.slice('/storage/v1'.length)+'?token=short-lived'}));
      if(u.pathname.startsWith('/storage/v1/object/')){
        if(failUpload&&u.pathname.includes('/orbis-trip-photos/'))return new Response('{}',{status:503});
        if(objects.has(u.pathname))return new Response(JSON.stringify({error:'Duplicate'}),{status:409});
        objects.set(u.pathname,typeof options.body==='string'?Buffer.from(options.body):Buffer.from(options.body));return new Response('{}');
      }
      if(u.pathname==='/rest/v1/orbis_workspaces')return new Response(JSON.stringify(row?[row]:[]));
      assert.equal(u.pathname,'/rest/v1/rpc/orbis_save_workspace_raw');
      const value=JSON.parse(options.body);assert.equal(value.p_sub,'owner');
      if(conflict||value.p_version!==row.version)return new Response('null');
      row={snapshot:value.p_snapshot,version:row.version+1};return new Response(JSON.stringify({version:row.version}));
    }};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'photo-service.js'),'utf8').replace('export async function photoStore','async function photoStore'),context);
  return {store:()=>context.photoStore({base,headers:{Authorization:'server-only'},sub:'owner'}),objects,calls,row:()=>row};
}
test('embedded photographs become one deduplicated stable private link everywhere',async()=>{
  const s=service(),store=await s.store(),value=trip(png),result=await store.externalize(value);
  assert.equal(result.count,1);assert.equal(s.objects.size,1);
  const link=result.snapshot[0].hotelMedia.hotel.photo;
  assert.ok(link.startsWith(objectRoot+digest('owner')+'/'));assert.ok(!link.includes('?'));
  assert.equal(result.snapshot[0].saved[0].photo,link);assert.equal(result.snapshot[0].days[0].items[0][5].journalPhotos[0],link);
  assert.ok(!JSON.stringify(result.snapshot).includes('data:image'));assert.equal(value[0].saved[0].photo,png);
});
test('repeated uploads are idempotent and preserve image bytes',async()=>{
  const s=service(),store=await s.store();
  const a=await store.upload(png),b=await store.upload(png);assert.equal(a.url,b.url);assert.equal(s.objects.size,1);
  assert.equal([...s.objects.values()][0].toString('base64'),png.split(',')[1]);
});
test('external image links need no upload',async()=>{
  const s=service(),result=await (await s.store()).externalize(trip('https://images.example/photo.jpg'));
  assert.equal(result.count,0);assert.equal(s.calls.length,0);
});
test('migration backs up the original before replacing the cloud version',async()=>{
  const original={snapshot:trip(png),version:7};const s=service(original),result=await (await s.store()).migrate();
  assert.equal(result.migrated,true);assert.equal(s.row().version,8);assert.ok(!JSON.stringify(s.row()).includes('data:image'));
  const backup=[...s.objects].find(([key])=>key.includes('orbis-workspace-backups'));
  assert.deepEqual(JSON.parse(backup[1].toString()),original);
  const again=await (await s.store()).migrate();assert.equal(again.migrated,false);assert.equal(s.row().version,8);
});
test('an upload failure leaves the original cloud photos intact',async()=>{
  const original={snapshot:trip(png),version:7},s=service(original,{failUpload:true});
  await assert.rejects(() => s.store().then(p=>p.migrate()),/原照片保留/);assert.deepEqual(s.row(),original);
});
test('migration never overwrites a concurrently updated cloud version',async()=>{
  const original={snapshot:trip(png),version:7},s=service(original,{conflict:true});
  await assert.rejects(()=>s.store().then(p=>p.migrate()),e=>e.status===409);assert.deepEqual(s.row(),original);
});
test('private signing is restricted to the current account and does not persist expiring URLs',async()=>{
  const s=service(),store=await s.store(),uploaded=await store.upload(png);
  const signed=await store.sign([uploaded.url]);assert.match(signed.photos[0].signedUrl,/short-lived/);
  const foreign=uploaded.url.replace(digest('owner'),digest('other'));
  await assert.rejects(()=>store.sign([foreign]),e=>e.status===403);
  await assert.rejects(()=>store.sign(['https://attacker.example/picture']),e=>e.status===403);
  await assert.rejects(()=>store.externalize(trip(foreign)),e=>e.status===403);
  assert.ok(!uploaded.url.includes('token='));
});
test('mismatched MIME types, SVG and oversized files are rejected',async()=>{
  const store=await service().store();
  await assert.rejects(()=>store.upload(png.replace('image/png','image/jpeg')),/不一致/);
  await assert.rejects(()=>store.upload('data:image/svg+xml;base64,PHN2Zy8+'),/JPG/);
  await assert.rejects(()=>store.upload('x'.repeat(12*1024*1024)),e=>e.status===413);
});
test('WebP signatures use fixed byte offsets even when size bytes form UTF-8',async()=>{
  const store=await service().store();
  const bytes=Buffer.from([82,73,70,70,195,169,0,0,87,69,66,80,86,80,56,76]);
  const photo=await store.upload('data:image/webp;base64,'+bytes.toString('base64'));
  assert.match(photo.url,/\.webp$/);
});
function client({switchDuringUpload=false}={}){
  const state={currentUserId:'owner',currentTripId:'trip',trips:[{...trip(png)[0],ownerId:'owner'},{...trip(png)[0],id:'other-trip',ownerId:'other'}]};
  const calls=[],events=new Map();const link=objectRoot+digest('owner')+'/'+digest('photo')+'.png';
  const context={TextEncoder,Uint8Array,btoa,Date,setTimeout,clearTimeout,
    window:{TabiWorkspace:{state,persist(){}},addEventListener:(name,fn)=>events.set(name,fn),OrbisCloud:{async photos(action,data){calls.push({action,data});if(switchDuringUpload)state.currentUserId='other';return {url:link}}}},
    document:{querySelectorAll:()=>[]}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'photo-links.js'),'utf8'),context);
  return {api:context.window.OrbisPhotos,state,calls,link};
}
test('client migration deduplicates uploads and commits only the current account',async()=>{
  const c=client(),snapshot=structuredClone(c.state.trips.slice(0,1));
  const result=await c.api.prepare(snapshot);assert.equal(c.calls.length,1);
  c.api.commit(result.map,'owner');assert.equal(c.state.trips[0].saved[0].photo,c.link);assert.equal(c.state.trips[1].saved[0].photo,png);
});
test('edits made while migration uploads are not overwritten',async()=>{
  const c=client(),result=await c.api.prepare(structuredClone(c.state.trips.slice(0,1)));
  c.state.trips[0].saved[0].photo='https://images.example/newer.jpg';c.api.commit(result.map,'owner');
  assert.equal(c.state.trips[0].saved[0].photo,'https://images.example/newer.jpg');
});
test('switching accounts cancels an in-flight image migration',async()=>{
  const c=client({switchDuringUpload:true});await assert.rejects(()=>c.api.prepare(trip(png)),/账号已切换/);
  assert.equal(c.state.trips[0].saved[0].photo,png);
});
