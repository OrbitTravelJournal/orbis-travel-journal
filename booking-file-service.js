/* Private PDFs: caller identity is verified by cloud-edge before this module runs. */
const bucket='orbis-booking-files',maxBytes=5*1024*1024;
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export async function handleBookingFiles(data,{base,headers,sub}){
  const tripId=typeof data.tripId==='string'?data.tripId.trim():'';
  if(!tripId||tripId.length>160)fail('请先选择行程。');
  const filter=`google_sub=eq.${encodeURIComponent(sub)}&trip_id=eq.${encodeURIComponent(tripId)}`;
  async function rows(extra=''){
    const r=await fetch(`${base}/rest/v1/orbis_booking_files?${filter}${extra}`,{headers,signal:AbortSignal.timeout(15000)});
    if(!r.ok)fail('文件资料暂不可用，请稍后重试。',503);return r.json();
  }
  const publicFile=row=>({id:row.id,name:row.name,size:row.byte_size,createdAt:row.created_at,deletedAt:row.deleted_at});
  if(data.action==='files-list')return {files:(await rows('&order=created_at.desc')).map(publicFile)};
  if(data.action==='files-upload'){
    const name=typeof data.name==='string'?data.name.trim():'';
    if(!name||name.length>200||!/^.+\.pdf$/i.test(name))fail('请选择 PDF 文件，文件名最长200字。');
    if(typeof data.content!=='string'||data.content.length>Math.ceil(maxBytes/3)*4)fail('每个 PDF 最大5MB。',413);
    let bytes;try{bytes=Uint8Array.from(atob(data.content),c=>c.charCodeAt(0));}catch{fail('文件内容无法读取，请重新选择。');}
    if(bytes.length<5||bytes.length>maxBytes)fail('每个 PDF 最大5MB。',413);
    if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')fail('这个文件不是有效的 PDF。');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const all=await rows(),same=all.find(row=>row.sha256===hash&&!row.deleted_at);if(same)return {file:publicFile(same),duplicate:true};
    if(all.reduce((sum,row)=>sum+row.byte_size,0)+bytes.length>100*1024*1024)fail('这个行程的文件已超过100MB，请先整理文件。',413);
    const id=crypto.randomUUID(),folder=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sub)))].map(b=>b.toString(16).padStart(2,'0')).join(''),path=`${folder}/${id}.pdf`;
    const storage=`${base}/storage/v1/object/${bucket}/${path}`;
    const upload=await fetch(storage,{method:'POST',headers:{...headers,'Content-Type':'application/pdf','Cache-Control':'private, no-store','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(30000)});
    if(!upload.ok)fail('PDF 上传未完成，请稍后重试。',503);
    const record={id,google_sub:sub,trip_id:tripId,name,object_path:path,byte_size:bytes.length,sha256:hash};
    let added;try{added=await fetch(`${base}/rest/v1/orbis_booking_files`,{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify(record),signal:AbortSignal.timeout(15000)});}catch{}
    if(!added?.ok){await fetch(`${base}/storage/v1/object/${bucket}`,{method:'DELETE',headers,body:JSON.stringify({prefixes:[path]})}).catch(()=>{});fail('文件记录未保存，请重新上传。',503);}
    return {file:publicFile((await added.json())[0])};
  }
  if(!/^[0-9a-f-]{36}$/i.test(data.id||''))fail('文件编号无效。');
  const row=(await rows(`&id=eq.${encodeURIComponent(data.id)}`))[0];if(!row)fail('文件不存在或不属于当前账号。',404);
  if(data.action==='files-open'){
    if(row.deleted_at)fail('文件已移到已删除列表，请先恢复。',404);
    const r=await fetch(`${base}/storage/v1/object/sign/${bucket}/${row.object_path}`,{method:'POST',headers,body:JSON.stringify({expiresIn:300}),signal:AbortSignal.timeout(15000)});
    if(!r.ok)fail('文件暂时打不开，请重试。',503);
    const signed=await r.json();if(typeof signed.signedURL!=='string'||!signed.signedURL.startsWith('/object/sign/'))fail('文件链接暂不可用。',503);
    return {url:`${base}/storage/v1${signed.signedURL}`,expiresIn:300};
  }
  if(data.action==='files-delete'){
    if(!row.deleted_at)fail('请先把文件移到已删除列表，再永久删除。',409);
    const removed=await fetch(`${base}/storage/v1/object/${bucket}`,{method:'DELETE',headers,body:JSON.stringify({prefixes:[row.object_path]}),signal:AbortSignal.timeout(15000)});
    if(!removed.ok)fail('文件未删除，请稍后重试。',503);
    const r=await fetch(`${base}/rest/v1/orbis_booking_files?${filter}&id=eq.${row.id}`,{method:'DELETE',headers,signal:AbortSignal.timeout(15000)});
    if(!r.ok)fail('文件已移除，清理记录暂未完成，请重试。',503);return {ok:true};
  }
  if(data.action==='files-trash'||data.action==='files-restore'){
    const r=await fetch(`${base}/rest/v1/orbis_booking_files?${filter}&id=eq.${row.id}`,{method:'PATCH',headers,body:JSON.stringify({deleted_at:data.action==='files-trash'?new Date().toISOString():null}),signal:AbortSignal.timeout(15000)});
    if(!r.ok)fail('文件状态未保存，请重试。',503);return {ok:true};
  }
  fail('未知文件操作。');
}
