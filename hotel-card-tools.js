/* Booking order and explicit copies to the account-scoped place library. */
(() => {
  const icons={drag:'<circle cx="8" cy="5" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/>',bookmark:'<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4z"/>'};
  const context=()=>[TabiWorkspace.state.currentUserId,TabiWorkspace.state.currentTripId].join(':');
  function button(kind,label){const el=document.createElement('button');el.type='button';el.className='library-icon hotel-'+kind;el.setAttribute('aria-label',label);el.title=label;el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[kind]}</svg>`;return el;}
  async function reorder(hotel,target,expected){
    if(expected!==context()||hotel===target)return;
    const from=hotels.indexOf(hotel),to=hotels.indexOf(target);if(from<0||to<0)return;
    const previous=hotels.slice();hotels.splice(from,1);hotels.splice(to,0,hotel);
    persistTrip();if(TabiWorkspace.persist()===false){hotels.splice(0,hotels.length,...previous);persistTrip();toast('排序未保存，请检查本机空间。');renderHotels();return;}
    try{await TabiWorkspace.flush?.();if(expected===context()){renderHotels();toast('酒店顺序已更新');}}catch{if(expected===context()){hotels.splice(0,hotels.length,...previous);persistTrip();renderHotels();toast('排序未保存，已恢复原顺序。');}}
  }
  function drag(handle,card,hotel){
    let gesture;
    handle.style.touchAction='none';
    handle.onpointerdown=e=>{if(e.button!==0)return;gesture={id:e.pointerId,y:e.clientY,target:hotel,context:context(),moved:false};handle.setPointerCapture(e.pointerId);};
    handle.onpointermove=e=>{
      if(!gesture||e.pointerId!==gesture.id)return;
      if(Math.abs(e.clientY-gesture.y)>8){gesture.moved=true;card.classList.add('is-hotel-dragging');}
      if(!gesture.moved)return;
      const list=[...document.querySelectorAll('#hotel-list .hotel-card')];let nearest=null,distance=Infinity;
      for(const candidate of list){const box=candidate.getBoundingClientRect(),d=Math.abs(e.clientY-(box.top+box.height/2));if(d<distance){distance=d;nearest=candidate;}}
      list.forEach(candidate=>candidate.classList.toggle('is-hotel-drop',candidate===nearest&&candidate!==card));
      if(nearest)gesture.target=hotels[Number(nearest.dataset.hotelOrder)];
      if(e.clientY<100)window.scrollBy(0,-12);else if(e.clientY>innerHeight-100)window.scrollBy(0,12);
    };
    function finish(e,cancel=false){if(!gesture||e.pointerId!==gesture.id)return;const old=gesture;gesture=null;card.classList.remove('is-hotel-dragging');document.querySelectorAll('.is-hotel-drop').forEach(el=>el.classList.remove('is-hotel-drop'));if(!cancel&&old.moved)reorder(hotel,old.target,old.context);}
    handle.onpointerup=e=>finish(e);handle.onpointercancel=e=>finish(e,true);
    handle.onkeydown=e=>{if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const visible=[...document.querySelectorAll('#hotel-list .hotel-card')].map(el=>hotels[Number(el.dataset.hotelOrder)]),index=visible.indexOf(hotel),target=visible[index+(e.key==='ArrowUp'?-1:1)];if(target)reorder(hotel,target,context());};
  }
  async function collect(hotel,control){
    const expected=context(),name=hotel[1],info=hotel[4]||{},media=hotelMedia[name]||{},city=OrbisStays.area(hotel)||'',key=savedKey(name,city),country=info.country||cityCountry(city)||'';
    const existing=savedPlaces.find(p=>p.key===key&&!p.libraryCategoryDefinition);
    if(existing&&!existing.libraryDeletedAt){toast('这家酒店已在收藏地点中');return;}
    const values={key,name,zh:hotelChinese[name]||'',city,country:country==='Unsorted'?'':country,region:info.region||'',address:info.address||'',map:info.map||media.map||'',website:hotel[3]||media.website||'',photo:media.photo||'',type:'Stay',libraryCategory:'Stay',savedAt:Date.now()};
    const before=existing?{...existing}:null;
    if(existing){delete existing.libraryDeletedAt;for(const [field,value] of Object.entries(values))if(value||['type','libraryCategory'].includes(field))existing[field]=value;}else savedPlaces.unshift(values);
    if(persistSavedPlaces()===false){if(existing){for(const field of Object.keys(existing))delete existing[field];Object.assign(existing,before);}else savedPlaces.splice(savedPlaces.indexOf(values),1);persistSavedPlaces();toast('收藏未保存，请检查本机空间');return;}
    control.disabled=true;
    try{await TabiWorkspace.flush?.();if(expected===context()){renderSavedPlaces();control.setAttribute('aria-pressed','true');control.setAttribute('aria-label','酒店已收藏');control.title='酒店已收藏';control.classList.add('is-saved');toast('已加入收藏地点的酒店分类');}}finally{control.disabled=false;}
  }
  const base=window.renderHotels;
  window.renderHotels=function(){
    base();document.querySelectorAll('#hotel-list [data-delete-hotel]').forEach(remove=>{
      const index=Number(remove.dataset.deleteHotel),hotel=hotels[index],card=remove.closest('.hotel-card');if(!hotel||!card)return;
      card.dataset.hotelOrder=String(index);
      const top=document.createElement('div');top.className='hotel-card-controls';
      const handle=button('drag','拖动酒店排序；键盘 Alt 加上下箭头'),save=button('bookmark','收藏这家酒店');
      const key=savedKey(hotel[1],OrbisStays.area(hotel)||''),saved=savedPlaces.some(p=>p.key===key&&OrbisSavedLibrary.visible(p));
      save.setAttribute('aria-pressed',String(saved));save.classList.toggle('is-saved',saved);if(saved){save.title='酒店已收藏';save.setAttribute('aria-label','酒店已收藏');}
      save.onclick=()=>collect(hotel,save).catch(()=>toast('收藏保存未完成，请稍后重试'));
      top.append(handle,save);card.prepend(top);drag(handle,card,hotel);
    });
  };renderHotels();
})();
