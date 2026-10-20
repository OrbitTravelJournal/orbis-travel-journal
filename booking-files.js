/* Booking PDFs are private cloud objects, separate from trip share snapshots. */
(() => {
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pdf='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8m-8 4h5"/></svg>';
  const page=document.createElement('section');page.id='booking-files';page.className='page booking-files-page';document.querySelector('main').append(page);
  const nav=document.createElement('a');nav.className='nav-link';nav.href='#booking-files';nav.dataset.page='booking-files';nav.setAttribute('aria-label','预订文件');nav.textContent='预订文件';document.querySelector('.main-nav').append(nav);
  const mobile=nav.cloneNode(true);mobile.innerHTML=pdf+'<span>预订文件</span>';document.querySelector('.mobile-nav').append(mobile);[nav,mobile].forEach(link=>link.onclick=e=>{e.preventDefault();showPage('booking-files');});
  const fallback=document.querySelector('.item-menu-panel [data-fallback-page="journal"]');
  if(fallback){const entry=document.createElement('button');entry.type='button';entry.dataset.fallbackPage='booking-files';entry.textContent='预订文件';entry.onclick=()=>{showPage('booking-files');const panel=entry.closest('.item-menu-panel');if(panel)panel.hidden=true;};fallback.after(entry);}
  const key=()=>{const s=TabiWorkspace.state;return JSON.stringify([s.currentUserId,s.currentTripId]);};
  const trip=()=>{const s=TabiWorkspace.state;return s.trips.find(t=>t.id===s.currentTripId&&t.ownerId===s.currentUserId);};
  let generation=0,busy=false;
  const status=message=>{const output=page.querySelector('#booking-files-status');if(output)output.textContent=message;};
  const size=bytes=>bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.ceil(bytes/1024)+' KB';
  function card(file,deleted=false){return `<article class="booking-file-card"><button type="button" class="booking-file-open" data-file-open="${safe(file.id)}" ${deleted?'disabled':''}>${pdf}<span><b>${safe(file.name)}</b><small>PDF · ${size(file.size)} · ${safe(new Date(file.createdAt).toLocaleDateString())}</small></span></button><button type="button" class="booking-file-action" ${deleted?`data-file-restore="${safe(file.id)}" aria-label="恢复${safe(file.name)}" title="恢复文件">↶`:`data-file-trash="${safe(file.id)}" aria-label="删除${safe(file.name)}" title="移到已删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6"/></svg>`}</button>${deleted?`<button type="button" class="booking-file-action" data-file-delete="${safe(file.id)}" aria-label="永久删除${safe(file.name)}" title="永久删除">×</button>`:''}</article>`;}
  async function load(){
    const turn=++generation,active=trip(),expected=key();
    const reuse=page.dataset.filesContext===expected&&!!page.querySelector('#booking-files-list');
    if(!reuse){delete page.dataset.filesSignature;}
    if(!reuse)page.innerHTML=`<div class="booking-files-head"><div><p class="eyebrow">BOOKING DOCUMENTS</p><h1>预订文件</h1><p>${safe(active?.name||'请先选择一趟旅行')} · PDF 机票、酒店及其他预订凭证</p></div><button type="button" id="booking-files-upload" aria-label="上传 PDF 文件" title="上传 PDF 文件" ${active?'':'disabled'}>${pdf}<span>上传 PDF</span></button></div><p class="booking-files-hint">每个文件最大5MB。文件单独保存到云端，同一 Google 账号可在手机和电脑打开。</p><input type="file" id="booking-files-input" accept="application/pdf,.pdf" multiple hidden><p id="booking-files-status" role="status" aria-live="polite"></p><div id="booking-files-list"></div>`;
    page.dataset.filesContext=expected;
    const input=page.querySelector('#booking-files-input');page.querySelector('#booking-files-upload').onclick=()=>{if(!busy)input.click();};input.onchange=()=>upload([...input.files],expected,active);
    if(!active){status('请先创建或打开一个行程。');return;}
    if(!reuse)status('正在读取文件…');
    try{const data=await OrbisCloud.files('list',{tripId:active.id});if(turn!==generation||expected!==key())return;
      const signature=JSON.stringify(data.files||[]);page.querySelector('.booking-files-login')?.remove();if(reuse&&page.dataset.filesSignature===signature)return;page.dataset.filesSignature=signature;
      const files=data.files||[],visible=files.filter(f=>!f.deletedAt),deleted=files.filter(f=>f.deletedAt);
      page.querySelector('#booking-files-list').innerHTML=visible.map(f=>card(f)).join('')||'<div class="booking-files-empty">还没有预订文件，点击上方上传 PDF。</div>';
      if(deleted.length)page.querySelector('#booking-files-list').insertAdjacentHTML('beforeend',`<details class="booking-files-trash"><summary>已删除 · ${deleted.length}</summary>${deleted.map(f=>card(f,true)).join('')}</details>`);
      page.querySelectorAll('[data-file-open]').forEach(button=>button.onclick=()=>open(button.dataset.fileOpen,active.id,expected));
      for(const operation of ['trash','restore','delete'])page.querySelectorAll(`[data-file-${operation}]`).forEach(button=>button.onclick=async()=>{if(busy||expected!==key())return;if(operation==='delete'&&!confirm('永久删除这个 PDF？文件将无法恢复。'))return;button.disabled=true;try{await OrbisCloud.files(operation,{tripId:active.id,id:button.dataset[operation==='trash'?'fileTrash':operation==='restore'?'fileRestore':'fileDelete']});if(expected===key()){await load();status(operation==='trash'?'文件已移到已删除，可随时恢复。':operation==='restore'?'文件已恢复。':'文件已永久删除。');}}catch(error){status(error.message);}finally{button.disabled=false;}});
      status('');
    }catch(error){if(turn!==generation||expected!==key())return;status(error.message);const login=document.createElement('button');login.type='button';login.className='booking-files-login';login.textContent='账户与登录';login.onclick=()=>TabiWorkspace.openAuth();page.querySelector('#booking-files-list').append(login);}
  }
  async function upload(files,expected,active){
    if(busy||!active||expected!==key()||!files.length)return;
    busy=true;const control=page.querySelector('#booking-files-upload');control.disabled=true;let uploaded=0,duplicate=0;
    try{for(const file of files){if(expected!==key())return;if(!/\.pdf$/i.test(file.name))throw new Error('请选择 PDF 文件。');if(file.size>5*1024*1024)throw new Error(file.name+' 超过5MB，请压缩后上传。');
        status(`正在上传 ${uploaded+duplicate+1}/${files.length}：${file.name}`);
        const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('文件读取失败，请重试。'));reader.readAsDataURL(file);});
        if(expected!==key())return;const result=await OrbisCloud.files('upload',{tripId:active.id,name:file.name,content});if(result.duplicate)duplicate++;else uploaded++;
      }
      if(expected===key()){await load();status(`已上传 ${uploaded} 个文件${duplicate?`，${duplicate} 个已存在，未重复上传`:''}。`);}
    }catch(error){if(expected===key()){await load();status((uploaded?`已上传 ${uploaded} 个文件。`:'')+error.message);}}
    finally{busy=false;if(expected===key())control.disabled=false;}
  }
  async function open(id,tripId,expected){
    if(expected!==key())return;
    const viewer=window.open('about:blank','_blank');if(viewer)viewer.opener=null;status('正在打开 PDF…');
    try{const result=await OrbisCloud.files('open',{tripId,id});if(expected!==key()){viewer?.close();return;}
      if(viewer&&!viewer.closed){viewer.location.replace(result.url);status('已在新页面打开 PDF。');}
      else{status('点击这里打开 PDF：');const link=document.createElement('a');link.href=result.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='打开 PDF（链接5分钟内有效）';page.querySelector('#booking-files-status').append(link);}
    }catch(error){viewer?.close();if(expected===key())status(error.message);}
  }
  const base=window.showPage;window.showPage=function(id){base(id);if(id==='booking-files'){document.querySelector('#top-location').textContent='预订文件';load();}};
  window.addEventListener('orbis-account-changed',()=>{generation++;page.replaceChildren();if(page.classList.contains('active'))load();});
  window.addEventListener('focus',()=>{if(page.classList.contains('active')&&!busy)load();});
  setInterval(()=>{if(page.classList.contains('active')&&!document.hidden&&!busy)load();},30000);
})();
