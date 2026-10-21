/* A revocable server-issued session persists across visits; Google credentials are only used to establish it. */
(() => {
  const endpoint='https://owpxeksiaywnacomkwog.supabase.co/functions/v1/orbis-sync';
  const state=()=>window.TabiWorkspace.state;
  const user=()=>state().users.find(u=>u.id===state().currentUserId);
  const canonical=value=>JSON.stringify(sort(value));
  function sort(value){return Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])])):value;}
  function snapshot(){return state().trips.filter(t=>t.ownerId===user()?.id).map(t=>{const copy=JSON.parse(JSON.stringify(t));delete copy.ownerId;delete copy.updatedAt;return copy;});}
  async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value))))].map(v=>v.toString(16).padStart(2,'0')).join('');}
  async function recovery(mode,key,value){
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('orbis-sync-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('copies');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction('copies',mode==='get'?'readonly':'readwrite'),store=tx.objectStore('copies'),r=mode==='get'?store.get(key):store.put(value,key);let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result??null);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
  }
  let session=null,ctx=null,timer,busy=false;
  try{session=JSON.parse(localStorage.getItem('orbis-account-session')||sessionStorage.getItem('orbis-google-session')||'null')}catch{}
  const panel=document.createElement('section');panel.id='account-cloud-sync';
  panel.innerHTML='<h3>云端同步</h3><p id="cloud-sync-status" role="status" aria-live="polite">使用 Google 重新登录，连接此账号的云端资料。本地邮箱档案不具备云端身份验证。</p><div><button type="button" id="cloud-check">检查同步</button><button type="button" id="cloud-use-local" hidden>以本机资料开始同步</button><button type="button" id="cloud-use-remote" hidden>使用云端资料</button></div>';
  document.querySelector('#workspace-auth-form').append(panel);
  const status=panel.querySelector('#cloud-sync-status'),local=panel.querySelector('#cloud-use-local'),remote=panel.querySelector('#cloud-use-remote');
  function say(text){status.textContent=text;}
  function valid(){return session&&user()?.googleId===session.sub&&session.exp*1000>Date.now();}
  function current(c){return !!c&&ctx===c&&valid()&&user()?.id===c.owner;}
  async function saveMeta(c){try{const version=c.version,cloudHash=c.hash,stored=JSON.parse(localStorage.getItem('tabi-workspace-v1')||'null');const saved=stored?.trips?.filter(t=>t.ownerId===c.owner).map(t=>{const copy={...t};delete copy.ownerId;delete copy.updatedAt;return copy;});const savedHash=saved?await hash(saved):null;if(!current(c)||version!==c.version)return;localStorage.setItem('orbis-cloud-meta:'+c.sub,JSON.stringify({version,hash:cloudHash,savedHash}));c.savedHash=savedHash;}catch{}}
  function choices(c,message){if(!current(c))return;c.ready=false;local.hidden=false;remote.hidden=!c.cloud?.snapshot;local.textContent=c.cloud?.version?'保留本机版本并上传':'以本机资料开始同步';say(message);window.TabiWorkspace.openAuth();}
  async function request(c,method='GET',body){
    const url=method==='GET'&&c.hash&&c.version>0?endpoint+'?knownVersion='+encodeURIComponent(c.version):endpoint;
    const transfer=method==='GET'||Array.isArray(body?.snapshot)||['photos-upload','photos-migrate'].includes(body?.action);
    let r;
    try{r=await fetch(url,{method,headers:{Authorization:'Bearer '+c.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({...body,clientVersion:2})}:{}),signal:AbortSignal.timeout(transfer?120000:body?.action==='files-upload'?90000:20000)});}
    catch(e){if(e.name==='TimeoutError'||e.name==='AbortError')throw new Error('云端同步超时，照片较多时可能需要更长时间。资料仍保留在本机，请保持页面打开，稍后点「检查同步」重试。');throw e;}
    if(r.status===401)throw Object.assign(new Error('Google 验证已过期，请重新点上方 Google 登录。资料仍保留在本机。'),{code:401});
    if(r.status===426)throw new Error('同步版本已更新，请先下载本机备份，再刷新网页。');
    if(r.status===409)throw Object.assign(new Error('另一台设备已更新，请选择要保留的版本。'),{code:409});
    if(body?.action?.startsWith('photos-')&&!r.ok){let message;try{message=(await r.json()).error}catch{}throw Object.assign(new Error(message||'照片暂未上传，原照片保留，请稍后重试。'),{name:'PhotoUploadError'});}
    if(r.status===413)throw new Error('行程文字与链接超过12MB上限，尚未上传。请先下载本机备份，再分开保存行程。');
    if(body?.action?.startsWith('files-')&&!r.ok){let message;try{message=(await r.json()).error}catch{}throw new Error(message||'文件操作暂未完成，请稍后重试。');}
    if(body?.action?.startsWith('planner-')&&!r.ok){let message;try{message=(await r.json()).error}catch{}throw new Error(message||'地图查询暂不可用，请改用 Google Maps。');}
    if(body?.action==='lookup'&&!r.ok)throw new Error('公开资料暂不可用，可以继续手动填写，稍后再查。');
    if(!r.ok)throw new Error('云端暂不可用，修改仍保留在本机。稍后点「检查同步」重试。');
    let data;
    try{data=await r.json();}catch(e){if(e.name==='TimeoutError'||e.name==='AbortError')throw new Error('云端照片下载超时，资料仍保留在本机。请保持页面打开，稍后点「检查同步」重试。');throw e;}
    if(data.sessionExpiresAt&&session?.token===c.token){session.exp=Date.parse(data.sessionExpiresAt)/1000;try{localStorage.setItem('orbis-account-session',JSON.stringify(session))}catch{}}
    return data;
  }
  async function preparePhotos(c){
    if(!window.OrbisPhotos)return;
    const before=snapshot(),beforeHash=await hash(before);
    const result=await window.OrbisPhotos.prepare(before,(done,total)=>{if(current(c))say(`正在迁移照片 ${done}/${total}…`)});
    if(!current(c)||!result.map.size)return;
    // Keep a recovery copy before replacing local image bytes with durable links.
    await recovery('put','photos:'+c.sub,snapshot());if(!current(c))return;
    const normalizedHash=await hash(result.snapshot);if(!current(c))return;
    window.OrbisPhotos.commit(result.map,c.owner);
    if(c.hash===beforeHash)c.hash=normalizedHash;
    if(c.savedHash===beforeHash)c.savedHash=normalizedHash;
  }
  async function applyRemote(c){
    if(!current(c)||!Array.isArray(c.cloud?.snapshot))return;
    const fingerprint=await hash(c.cloud.snapshot),beforeHash=await hash(snapshot());if(!current(c))return;
    const s=state(),old=s.trips,oldId=s.currentTripId;
    const own=old.filter(t=>t.ownerId===c.owner);
    // Preserve the overwritten local version outside the main workspace before applying cloud data.
    try{if(own.length)await recovery('put',c.sub,JSON.parse(JSON.stringify(own)));}
    catch{say('本机空间不足，无法保留旧版。请先下载本机备份，再清理空间后重试；资料没有被覆盖。');return;}
    if(!current(c))return;if(await hash(snapshot())!==beforeHash){say('本机资料刚有修改，请重新检查同步后选择。');return;}
    s.trips=[...old.filter(t=>t.ownerId!==c.owner),...c.cloud.snapshot.map(t=>({...t,ownerId:c.owner}))];
    s.currentTripId=s.trips.some(t=>t.id===oldId&&t.ownerId===c.owner)?oldId:s.trips.find(t=>t.ownerId===c.owner)?.id||null;
    c.hash=fingerprint;
    c.version=c.cloud.version;c.ready=true;
    if(window.TabiWorkspace.persist()===false){s.trips=old;s.currentTripId=oldId;c.ready=false;say('本机空间不足，云端资料未载入。原资料保留。');return;}
    saveMeta(c);local.hidden=true;remote.hidden=true;
    if(s.currentTripId)window.TabiWorkspace.loadTrip(s.trips.find(t=>t.id===s.currentTripId));
    else{window.loadTripScopedData?.(null);window.TabiWorkspace.renderTrips();window.showPage?.('trips');}
    say('已同步 · '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  }
  async function check(){
    await window.TabiWorkspace.ready;
    if(!valid()){ctx=null;local.hidden=true;remote.hidden=true;say('请使用上方 Google 登录以连接云端；仅填写邮箱不会启用同步。');return;}
    if(busy)return;busy=true;
    let c=ctx;
    if(!c||c.sub!==session.sub||c.owner!==user().id){c={sub:session.sub,owner:user().id,token:session.token,version:0,hash:null,ready:false};ctx=c;try{const meta=JSON.parse(localStorage.getItem('orbis-cloud-meta:'+c.sub)||'null');if(meta){c.version=meta.version;c.hash=meta.hash;c.savedHash=meta.savedHash}}catch{}}
    c.token=session.token;
    try{
      await preparePhotos(c);if(!current(c))return;
      if(window.OrbisPhotos&&!c.photosMigrated){
        let migration;
        do{migration=await request(c,'POST',{action:'photos-migrate'});if(!current(c))return;}while(migration.pending);
        c.photosMigrated=true;
      }
      let cloud=await request(c);if(!current(c))return;
      if(cloud.unchanged===true&&cloud.version===c.version&&c.hash){
        const localHash=await hash(snapshot());if(!current(c))return;
        if(c.savedHash&&localHash===c.savedHash&&localHash!==c.hash){
          // A restored old localStorage cache is not a new edit to upload.
          cloud=await request({...c,hash:null});if(!current(c))return;
        }else{
          c.ready=true;local.hidden=true;remote.hidden=true;
          if(localHash!==c.hash)setTimeout(upload,0);else say('已同步 · 云端与本机资料一致');
          return;
        }
      }
      c.cloud=cloud;
      const localHash=await hash(snapshot()),cloudHash=cloud.snapshot?await hash(cloud.snapshot):null;if(!current(c))return;
      if(cloud.snapshot&&localHash===cloudHash){c.version=cloud.version;c.hash=cloudHash;c.ready=true;saveMeta(c);local.hidden=true;remote.hidden=true;say('已同步 · 云端与本机资料一致');return;}
      if(cloud.snapshot&&c.savedHash&&localHash===c.savedHash&&localHash!==c.hash){await applyRemote(c);return;}
      if(c.hash&&cloud.version===c.version){c.ready=true;if(localHash!==c.hash)setTimeout(upload,0);else say('已同步');return;}
      if(cloud.snapshot&&(snapshot().length===0||(c.hash&&localHash===c.hash))){await applyRemote(c);return;}
      choices(c,cloud.snapshot?'发现云端资料。请先下载本机备份，再选择使用云端，或明确保留本机版本上传。手机有最新版时，请先在手机上传。':'云端尚无资料。请在保存最新版的手机上点「以本机资料开始同步」；电脑暂时不要上传旧版。');
    }catch(e){if(current(c)){say(e.message);if(e.code===401)c.ready=false;}}
    finally{busy=false;}
  }
  async function upload(){
    const c=ctx;if(!c||!current(c)||!c.ready||busy)return;
    busy=true;say('正在同步…');
    try{
      try{await window.TabiWorkspace.flush?.()}catch{say('本机保存未完成，正在尝试保存到云端。')}
      await preparePhotos(c);if(!current(c))return;
      const data=snapshot(),fingerprint=await hash(data);if(!current(c)||fingerprint===c.hash)return;
      const result=await request(c,'POST',{snapshot:data,version:c.version});if(!current(c))return;
      c.version=result.version;c.hash=fingerprint;saveMeta(c);say('已同步 · '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
      if(await hash(snapshot())!==c.hash)timer=setTimeout(upload,1500);
    }catch(e){if(current(c)){say(e.message);if(e.code===409){c.ready=false;setTimeout(check,0)}if(e.code===401)c.ready=false;}}
    finally{busy=false;}
  }
  local.onclick=async()=>{
    const c=ctx;if(!current(c)||busy)return;
    if(!confirm(c.cloud.version?'这会用本机资料替换云端版本。请确认这台设备保存的是最新版，且已经下载备份。':'确认以这台设备的资料建立云端版本？请在保存最新版的手机上执行。'))return;
    c.version=c.cloud.version;c.hash=null;c.ready=true;local.hidden=true;remote.hidden=true;await upload();
  };
  remote.onclick=async()=>{const c=ctx;if(!current(c)||busy)return;if(confirm('使用云端资料？本机旧版会保留为恢复副本。建议先下载本机备份。'))await applyRemote(c);};
  panel.querySelector('#cloud-check').onclick=check;
  window.addEventListener('orbis-workspace-saved',()=>{clearTimeout(timer);if(ctx?.ready)timer=setTimeout(upload,1500);});
  window.addEventListener('orbis-account-changed',()=>{ctx=null;clearTimeout(timer);local.hidden=true;remote.hidden=true;check();});
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  setInterval(()=>{if(!document.hidden&&user()?.googleId)check();},30000);
  window.OrbisCloud={connect:async token=>{
    try{
      const result=await request({token},'POST',{action:'session'});
      if(user()?.googleId!==result.account)return;
      session={token:result.sessionToken,sub:result.account,exp:Date.parse(result.expiresAt)/1000,persistent:true};
      localStorage.setItem('orbis-account-session',JSON.stringify(session));sessionStorage.removeItem('orbis-google-session');ctx=null;
      while(busy)await new Promise(resolve=>setTimeout(resolve,50));await check();
    }catch{say('持续登录未建立，请重新 Google 登录。当前资料仍在本机。');}
  },planner:async(action,payload={})=>{await window.TabiWorkspace.ready;if(!valid())throw new Error('请先用 Google 登录，或使用免费的 Google Maps 链接。');const owner=state().currentUserId,token=session.token,result=await request({token},'POST',{...payload,action:'planner-'+action});if(state().currentUserId!==owner||session?.token!==token)throw new Error('账号已切换，请重新打开当天路线。');return result;},photos:async(action,payload={})=>{await window.TabiWorkspace.ready;if(!valid())throw Object.assign(new Error('请先用 Google 登录，再上传或查看照片。'),{name:'PhotoUploadError'});const owner=state().currentUserId,token=session.token,result=await request({token},'POST',{...payload,action:'photos-'+action});if(state().currentUserId!==owner||session?.token!==token)throw new Error('账号已切换，原照片保留。');return result;},files:async(action,payload={})=>{await window.TabiWorkspace.ready;if(!valid())throw new Error('请先用 Google 登录，再上传或打开预订文件。');const owner=state().currentUserId,token=session.token,result=await request({token},'POST',{...payload,action:'files-'+action});if(state().currentUserId!==owner||session?.token!==token)throw new Error('账号已切换，请重新打开文件栏目。');return result;},lookup:async query=>{await window.TabiWorkspace.ready;if(!valid())throw new Error('请先用 Google 登录，或继续手动填写。');return (await request({token:session.token},'POST',{action:'lookup',query})).places;},disconnect:()=>{
    const previous=session;session=null;ctx=null;clearTimeout(timer);localStorage.removeItem('orbis-account-session');sessionStorage.removeItem('orbis-google-session');
    if(previous?.persistent)request({token:previous.token},'POST',{action:'logout'}).catch(()=>{});
  },getPreviousCopy:async()=>{const sub=user()?.googleId;if(!sub)return null;try{return await recovery('get',sub)}catch{return null}}};
  window.dispatchEvent?.(new Event('orbis-photos-ready'));
  if(valid()&&!session.persistent)window.OrbisCloud.connect(session.token);else check();
})();

