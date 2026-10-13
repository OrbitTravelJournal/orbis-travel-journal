/* Empty accounts never render another account's legacy trip DOM. */
(() => {
  const active=()=>{const s=window.TabiWorkspace?.state;return s?.currentUserId&&s.trips.find(t=>t.id===s.currentTripId&&t.ownerId===s.currentUserId);};
  function sync(){
    window.TabiWorkspace?.renderAccountAvatar?.();const empty=!active();document.body.classList.toggle('account-empty',empty);
    for(const id of ['itinerary','map','stays','restaurants','journal','travel-info']){
      const page=document.getElementById(id);if(!page)continue;
      if(!page.querySelector('.account-empty-panel')){
        const panel=document.createElement('section');panel.className='account-empty-panel';panel.innerHTML='<h1>还没有行程</h1><p>创建一趟旅行，或打开分享链接，将行程副本加入你的账号。</p><button type="button">创建行程</button>';panel.querySelector('button').onclick=()=>window.TabiWorkspace.openTripDialog();page.append(panel);
      }
    }
    if(empty){document.querySelector('#workspace-trip-caption')?.replaceChildren();document.querySelector('#reader-home')?.setAttribute('hidden','');}
    return empty;
  }
  window.OrbisAccountUI={sync};
  const show=window.showPage;window.showPage=function(id){
    if(sync()&&id!=='trips'){
      document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===id));
      const label=document.querySelector('#top-location');if(label)label.textContent=id==='restaurants'?'SAVED PLACES':id.toUpperCase();window.scrollTo({top:0});return;
    }show(id);
  };
  const render=window.renderItinerary;window.renderItinerary=function(){if(sync())return;render();};
  sync();
})();
