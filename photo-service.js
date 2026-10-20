/* Private, content-addressed photographs. No user credential is stored in links. */
const bucket='orbis-trip-photos',backupBucket='orbis-workspace-backups',maxBytes=8*1024*1024;
const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const digest=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
function kind(bytes){
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return ['image/jpeg','jpg'];
  if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return ['image/png','png'];
  // Size bytes are binary: UTF-8 decoding can shift the signature offsets.
  const ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
  if(/^GIF8[79]a/.test(ascii(0,6)))return ['image/gif','gif'];
  if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return ['image/webp','webp'];
  if(ascii(4,8)==='ftyp'&&/avif|avis/.test(ascii(8,16)))return ['image/avif','avif'];
  fail('图片格式无法识别，请使用 JPG、PNG、WebP、GIF 或 AVIF。');
}
function strings(value,result=new Set()){
  if(typeof value==='string')result.add(value);
  else if(value&&typeof value==='object')Object.values(value).forEach(v=>strings(v,result));
  return result;
}
function replace(value,map){
  if(typeof value==='string')return map.get(value)||value;
  if(Array.isArray(value))return value.map(v=>replace(v,map));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,replace(v,map)]));
  return value;
}
export async function photoStore({base,headers,sub}){
  const owner=await digest(new TextEncoder().encode(sub));
  const root=`${base}/storage/v1/object/${bucket}/`,prefix=root+owner+'/';
  const own=url=>typeof url==='string'&&url.startsWith(prefix)&&/^[0-9a-f]{64}\.(jpg|png|webp|gif|avif)$/.test(url.slice(prefix.length));
  async function put(target,path,bytes,mime){
    const r=await fetch(`${base}/storage/v1/object/${target}/${path}`,{method:'POST',headers:{...headers,'Content-Type':mime,'x-upsert':'false','Cache-Control':'private, max-age=3600'},body:bytes,signal:AbortSignal.timeout(45000)});
    if(!r.ok){let error={};try{error=await r.json()}catch{}
      if(r.status!==409&&error.error!=='Duplicate'&&error.code!=='Duplicate')fail('照片上传未完成，原照片保留，请稍后重试。',503);
    }
  }
  async function upload(data){
    if(typeof data!=='string'||data.length>Math.ceil(maxBytes/3)*4+100)fail('每张照片最大8MB。',413);
    const match=/^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/]*={0,2})$/.exec(data);
    if(!match)fail('请使用 JPG、PNG、WebP、GIF 或 AVIF 图片。');
    let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))}catch{fail('图片内容无法读取。')}
    if(bytes.length>maxBytes)fail('每张照片最大8MB。',413);
    if(bytes.length<12)fail('图片内容不完整。');
    const [mime,extension]=kind(bytes);if(mime!==match[1])fail('图片格式与文件内容不一致。');
    const sha=await digest(bytes),path=`${owner}/${sha}.${extension}`;
    await put(bucket,path,bytes,mime);
    return {url:root+path,bytes:bytes.length};
  }
  async function externalize(snapshot,limit=Infinity){
    const values=[...strings(snapshot)];
    for(const v of values)if(v.startsWith(root)&&!own(v))fail('照片链接不属于当前账号。',403);
    const embedded=values.filter(v=>v.startsWith('data:image/')),map=new Map();
    for(const data of embedded.slice(0,limit))map.set(data,(await upload(data)).url);
    return {snapshot:replace(snapshot,map),count:map.size,pending:embedded.length>map.size};
  }
  async function sign(urls){
    if(!Array.isArray(urls)||urls.length>50||urls.some(v=>!own(v)))fail('照片链接不存在或不属于当前账号。',403);
    const photos=[];
    // Bound concurrent upstream work; URLs expire and are never saved in snapshots.
    for(let i=0;i<urls.length;i+=4)await Promise.all(urls.slice(i,i+4).map(async url=>{
      const r=await fetch(`${base}/storage/v1/object/sign/${bucket}/${url.slice(root.length)}`,{method:'POST',headers,body:JSON.stringify({expiresIn:3600}),signal:AbortSignal.timeout(15000)});
      if(!r.ok)fail('照片暂时无法显示，请稍后重试。',503);
      const value=await r.json();if(!value.signedURL?.startsWith('/object/sign/'))fail('照片链接暂不可用。',503);
      photos.push({url,signedUrl:base+'/storage/v1'+value.signedURL,expiresAt:Date.now()+3600000});
    }));
    return {photos};
  }
  async function migrate(){
    const r=await fetch(`${base}/rest/v1/orbis_workspaces?google_sub=eq.${encodeURIComponent(sub)}&select=snapshot,version,updated_at`,{headers,signal:AbortSignal.timeout(30000)});
    if(!r.ok)fail('暂时无法读取旧照片，请稍后重试。',503);
    const row=(await r.json())[0];if(!row)return {migrated:false,pending:false};
    if(![...strings(row.snapshot)].some(v=>v.startsWith('data:image/')))return {migrated:false,pending:false,version:row.version};
    // Recovery copy must exist before a version can be replaced.
    await put(backupBucket,`${owner}/before-photo-links-v${row.version}.json`,JSON.stringify(row),'application/json');
    const changed=await externalize(row.snapshot,10);
    const saved=await fetch(`${base}/rest/v1/rpc/orbis_save_workspace_raw`,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:JSON.stringify({p_sub:sub,p_snapshot:changed.snapshot,p_version:row.version}),signal:AbortSignal.timeout(45000)});
    if(!saved.ok)fail('照片迁移暂未完成，原资料和恢复副本保留。',503);
    const result=await saved.json();if(!result)fail('另一台设备刚有更新，请重新检查同步。',409);
    return {migrated:true,pending:changed.pending,count:changed.count,version:result.version};
  }
  return {upload,sign,externalize,migrate};
}
