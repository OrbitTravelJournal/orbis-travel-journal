/* Workspace values contain permanent private object links, never signed URLs. */
(() => {
  const root='https://owpxeksiaywnacomkwog.supabase.co/storage/v1/object/orbis-trip-photos/';
  const pattern=/https:\/\/owpxeksiaywnacomkwog\.supabase\.co\/storage\/v1\/object\/orbis-trip-photos\/[a-f0-9]{64}\/[a-f0-9]{64}\.(?:jpg|png|webp|gif|avif)/g;
  const isPrivate=value=>typeof value==='string'&&value.startsWith(root);
  const owner=()=>window.TabiWorkspace?.state?.currentUserId;
  const cache=new Map(),images=new Map(),styles=new Map();let epoch=0,scheduled=false,running=false;
  function values(value,result=new Set()){
    if(typeof value==='string')result.add(value);
    else if(value&&typeof value==='object')Object.values(value).forEach(v=>values(v,result));
    return result;
  }
  function replace(value,map){
    if(!value||typeof value!=='object')return map.get(value)||value;
    for(const key of Object.keys(value))value[key]=replace(value[key],map);
    return value;
  }
  const bytesToData=(bytes,mime)=>{
    let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return `data:${mime};base64,${btoa(binary)}`;
  };
  async function uploadData(data){
    if(!window.OrbisCloud?.photos)throw new Error('请先用 Google 登录，再上传照片。');
    const result=await window.OrbisCloud.photos('upload',{data});return result.url;
  }
  async function uploadFile(file){
    if(file.size>8*1024*1024)throw new Error('每张照片最大8MB，请选择较小的图片。');
    if(!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type))throw new Error('请使用 JPG、PNG、WebP、GIF 或 AVIF 图片。');
    return uploadData(bytesToData(new Uint8Array(await file.arrayBuffer()),file.type));
  }
  async function prepare(snapshot,onProgress){
    const current=owner(),embedded=[...values(snapshot)].filter(v=>v.startsWith('data:image/')),map=new Map();
    for(const data of embedded){
      if(owner()!==current)throw new Error('账号已切换，原照片保留。');
      map.set(data,await uploadData(data));onProgress?.(map.size,embedded.length);
    }
    if(owner()!==current)throw new Error('账号已切换，原照片保留。');
    return {snapshot:replace(snapshot,map),map};
  }
  function commit(map,expected){
    if(!map.size||owner()!==expected)return;
    const s=window.TabiWorkspace.state;
    s.trips.filter(t=>t.ownerId===expected).forEach(t=>replace(t,map));
    // The legacy views hold separate live arrays: update matching values only,
    // preserving edits, deletions or a trip switch during an upload.
    if(typeof days!=='undefined')replace(days,map);
    if(typeof hotels!=='undefined')replace(hotels,map);
    if(typeof hotelMedia!=='undefined')replace(hotelMedia,map);
    if(typeof savedPlaces!=='undefined')replace(savedPlaces,map);
    if(typeof restaurantBookings!=='undefined')replace(restaurantBookings,map);
    window.persistTrip?.();window.TabiWorkspace.persist();
    for(const fn of ['renderHotels','renderSavedPlaces','renderItinerary','renderJournal','renderSavedMap']){
      try{window[fn]?.()}catch{} // A hidden view may have no active day yet.
    }
    schedule();
  }
  async function signed(urls){
    const missing=[...new Set(urls)].filter(url=>!cache.has(url)||cache.get(url).expiresAt<Date.now()+60000);
    const generation=epoch;
    for(let i=0;i<missing.length;i+=50){
      const result=await window.OrbisCloud.photos('sign',{urls:missing.slice(i,i+50)});
      if(generation!==epoch)throw new Error('账号已切换');
      result.photos.forEach(p=>cache.set(p.url,p));
    }
    return urls.map(url=>cache.get(url)?.signedUrl);
  }
  async function portable(snapshot){
    const current=owner(),refs=[...values(snapshot)].filter(isPrivate),map=new Map();
    const urls=await signed(refs);
    for(let i=0;i<refs.length;i++){
      const r=await fetch(urls[i],{signal:AbortSignal.timeout(60000)});
      if(!r.ok)throw new Error('备份中的照片未下载完成，请重试。');
      map.set(refs[i],bytesToData(new Uint8Array(await r.arrayBuffer()),r.headers.get('Content-Type')?.split(';')[0]||'image/jpeg'));
    }
    if(owner()!==current)throw new Error('账号已切换，请重新下载备份。');
    return replace(snapshot,map);
  }
  function scan(node=document){
    const nodes=[...(node.nodeType===1?[node]:[]),...(node.querySelectorAll?.('img,[style]')||[])];
    for(const el of nodes){
      if(el.tagName==='IMG'){
        const src=el.getAttribute('src'),old=images.get(el);
        if(isPrivate(src)){images.set(el,{url:src,display:null,retries:0});el.removeAttribute('src');}
        else if(src&&old&&src!==old.display)images.delete(el);
      }
      const style=el.getAttribute?.('style');
      if(style?.includes(root))styles.set(el,{original:style,urls:[...new Set(style.match(pattern)||[])]});
      else if(styles.has(el)&&style!==styles.get(el).display)styles.delete(el);
    }
  }
  function schedule(){if(!scheduled){scheduled=true;setTimeout(flush,0)}}
  async function flush(){
    scheduled=false;if(running||!window.OrbisCloud?.photos)return;
    for(const [el] of images)if(!el.isConnected)images.delete(el);
    for(const [el] of styles)if(!el.isConnected)styles.delete(el);
    const refs=[...images.values()].map(v=>v.url).concat([...styles.values()].flatMap(v=>v.urls));
    if(!refs.length)return;running=true;const generation=epoch;
    try{
      await signed(refs);if(generation!==epoch)return;
      for(const [el,value] of images){const url=cache.get(value.url)?.signedUrl;if(url&&el.isConnected&&el.getAttribute('src')!==url){value.display=url;el.setAttribute('src',url);}}
      for(const [el,value] of styles){let text=value.original;for(const ref of value.urls)text=text.split(ref).join(cache.get(ref)?.signedUrl||'');value.display=text;if(el.isConnected&&el.getAttribute('style')!==text)el.setAttribute('style',text);}
    }catch{/* Sign-in and network errors leave stored links intact. Focus retries. */}
    finally{running=false;}
  }
  if(typeof MutationObserver!=='undefined'){
    new MutationObserver(records=>{for(const r of records){if(r.type==='childList')r.addedNodes.forEach(scan);else scan(r.target)}schedule()}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','style']});
    document.addEventListener('error',event=>{
      const value=images.get(event.target);if(!value)return;
      event.stopImmediatePropagation();if(value.retries++<1){cache.delete(value.url);event.target.removeAttribute('src');schedule();}
    },true);
    scan();schedule();
  }
  window.addEventListener('focus',()=>{scan();schedule()});
  window.addEventListener('orbis-photos-ready',()=>{scan();schedule()});
  window.addEventListener('orbis-account-changed',()=>{
    epoch++;cache.clear();
    for(const [el] of images)el.removeAttribute('src');
    for(const [el,value] of styles){value.display=value.original.replace(pattern,'');el.setAttribute('style',value.display)}
    scan();schedule();
  });
  const context=()=>[owner(),window.TabiWorkspace?.state?.currentTripId].join(':');
  window.OrbisPhotos={isPrivate,uploadFile,uploadData,prepare,commit,portable,signed,context};
})();
