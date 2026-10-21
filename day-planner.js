/* Routes and restaurant discovery are explicit actions. Google responses stay in this page only. */
(() => {
  const C=window.OrbisDayPlannerCore;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state=()=>window.TabiWorkspace?.state;
  const identity=()=>[state()?.currentUserId,state()?.currentTripId].join(':');
  const owned=()=>state()?.trips?.some(t=>t.id===state().currentTripId&&t.ownerId===state().currentUserId);
  const panel=document.querySelector('#day-planner-page');
  let day,context,source,stops=[],configured=false,epoch=0,currentLocation=null,locationEpoch=0,foodWorking=false,foodEpoch=0,embedKey='';
  const current=stamp=>document.querySelector('#map').classList.contains('active')&&stamp===epoch&&context===identity()&&days.includes(day)&&source===JSON.stringify(day.items);
  const message=text=>{const el=panel.querySelector('#planner-status');if(el)el.textContent=text;};
  const valid=()=>{if(current(epoch))return true;message('行程已有变化，请重新进入地图页，避免使用旧资料。');return false;};
  const button=(text,attrs='')=>`<button type="button" ${attrs}>${text}</button>`;
  const link=(label,url)=>`<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
  const links=(a,b,i)=>a.needsLocation||b.needsLocation?`<p>请先补充餐厅完整地址或地点 ID，才能显示两地路线。</p>`:`<div class="planner-links" role="group" aria-label="本段交通方式">${['walking','transit','driving'].map((mode,j)=>button(['徒步','公交 / 地铁','打车参考'][j],`data-leg-map-mode="${mode}" data-leg="${i}" aria-pressed="false"`)).join('')}</div>`;
  function showLegMap(i,mode){
    if(!valid())return;const out=panel.querySelector(`[data-leg-map="${i}"]`);
    if(!embedKey){out.textContent='站内地图尚未连接，请稍后重试。';return;}
    if(stops[i].needsLocation||stops[i+1].needsLocation){out.textContent='请先补充完整地点或地点 ID。';return;}
    out.innerHTML=`<iframe class="planner-route-map" title="${safe(stops[i].name)}至${safe(stops[i+1].name)}的${mode==='transit'?'公共交通':mode==='walking'?'徒步':'驾车'}路线" src="${safe(C.embedDirections(stops[i],stops[i+1],mode,embedKey))}" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><p class="planner-hint">地图显示 Google 当前可用的路线，具体班次和出发时间请在地图内核对。${mode==='driving'?'驾车仅供打车参考，不含车费或叫车服务。':''}</p>`;
    panel.querySelectorAll(`[data-leg-map-mode][data-leg="${i}"]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.legMapMode===mode)));
  }
  function render(index=selected){
    if(!owned()){clear();panel.innerHTML='<p>请先打开一个行程，再查看当天路线和附近美食。</p>';return;}
    day=days[index];if(!day){clear();panel.innerHTML='<p>行程尚未添加日期，请先在行程页添加日期。</p>';return;}context=identity();source=JSON.stringify(day.items);stops=day.items.map((item,index)=>({item,index,...C.stop(item,day)})).filter(p=>['Activity','Meal','Stay','Shop','Other'].includes(p.item[1]));epoch++;configured=false;currentLocation=null;locationEpoch++;foodEpoch++;foodWorking=false;embedKey='';
    const stamp=epoch;
    panel.innerHTML=`<header class="planner-head"><div><p class="eyebrow">DAY ROUTE & FOOD</p><h2>当天路线 · 附近美食</h2></div>${button('返回当天行程','id="planner-back"')}</header><label class="planner-day-label">行程日期<select id="planner-day">${days.map((d,i)=>`<option value="${i}" ${d===day?'selected':''}>Day ${i+1} · ${safe(d.iso||d.date)} · ${safe(d.city)}</option>`).join('')}</select></label><p id="planner-status" role="status" aria-live="polite">正在连接地图服务…</p><div class="planner-tabs" role="group" aria-label="查看内容">${button('逐段路线','data-planner-tab="routes" aria-pressed="true"')}${button('附近美食','data-planner-tab="food" aria-pressed="false"')}</div><section id="planner-routes">${renderRoutes()}</section><section id="planner-food" hidden>${renderFood()}</section><details class="planner-about"><summary>地图服务与隐私</summary><p>免费入口会在新窗口打开 Google Maps。站内查询仅在管理员连接 Google API 后启用，按点击查询，达到保护上限会停止。附近美食可使用日程地点坐标或设备当前位置；仅点击当前定位时请求浏览器授权，搜索时将所选坐标交给 Google。坐标不会保存到行程或云端。路线查询会把所选地点和出发时间交给 Google，不传照片或完整行程。收藏仅保留你填写的名称、备注和地图引用。</p><p>${link('Google Maps 使用条款','https://www.google.com/help/terms_maps/')}${link('Google 隐私政策','https://policies.google.com/privacy')}</p></details>`;
    panel.querySelector('#planner-back').onclick=()=>showPage('itinerary');
    panel.querySelector('#planner-day').onchange=e=>{selected=+e.target.value;renderItinerary();renderMap();};
    panel.querySelectorAll('[data-planner-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.plannerTab));
    panel.querySelectorAll('[data-leg-map-mode]').forEach(b=>b.onclick=()=>showLegMap(+b.dataset.leg,b.dataset.legMapMode));
    panel.querySelector('#planner-location-refresh').onclick=()=>{foodLinks();locateFood();};
    panel.querySelector('#planner-food-center').onchange=changeCenter;
    panel.querySelector('#planner-food-stop').onchange=changeCenter;
    panel.querySelector('#planner-radius').onchange=foodLinks;
    panel.querySelector('#planner-food-type').onchange=foodLinks;
    panel.querySelector('#planner-nearby-query').onclick=searchFood;
    panel.querySelector('#planner-food-map-open').onclick=browseFoodMap;
    panel.querySelector('#planner-import').onsubmit=importPlace;
    foodLinks();
    // Small status request only after the user opens this feature. No provider call.
    window.OrbisCloud?.planner('status').then(result=>{if(!current(stamp))return;configured=result.configured===true;embedKey=typeof result.embedKey==='string'?result.embedKey:'';panel.querySelector('#planner-radius-label').hidden=!configured;panel.querySelector('#planner-nearby-query').hidden=!configured;panel.querySelector('#planner-food-map-open').hidden=!embedKey;if(embedKey)message('选择交通方式，直接在本页查看路线；附近美食可按日程地点或当前位置搜索。');}).catch(error=>{if(current(stamp))message(error.message||'地图服务暂不可用，请稍后重新进入地图页。');});
  }
  function tab(name){panel.querySelector('#planner-routes').hidden=name!=='routes';panel.querySelector('#planner-food').hidden=name!=='food';panel.querySelectorAll('[data-planner-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.plannerTab===name)));}
  function renderRoutes(){
    if(stops.length<2)return '<p>当天至少需要两个景点、餐厅或酒店。你可以先把收藏加入当天。</p>';
    return `<p class="planner-hint">按当前日程顺序出发。点击交通方式即可在本段卡片内查看地图，原有行程不会被改动。</p>${stops.slice(0,-1).map((a,i)=>{const b=stops[i+1];return `<article class="planner-leg"><span class="planner-leg-number">${i+1}</span><div><h3>${safe(a.name)} → ${safe(b.name)}</h3>${links(a,b,i)}<div data-leg-map="${i}"></div></div></article>`;}).join('')}<p class="planner-hint">“打车参考”在此显示驾车路线；实际车费和叫车需到打车平台确认。</p>`;
  }
  function renderFood(){return `<p>选择日程地点或设备当前位置，查找附近餐厅并加入收藏。</p><div class="planner-food-controls"><label>搜索中心<select id="planner-food-center"><option value="current">当前坐标</option><option value="schedule">日程坐标</option></select></label><label id="planner-food-stop-label" hidden>日程地点<select id="planner-food-stop" aria-label="日程地点">${stops.map((p,i)=>`<option value="${i}">${safe(p.item[0])} · ${safe(p.name)}</option>`).join('')||'<option value="-1">当天暂无日程地点</option>'}</select><span id="planner-stop-coordinates"></span></label><div id="planner-current-center"><span>当前坐标</span><p id="planner-location-status" role="status" aria-live="polite">尚未获取当前位置</p>${button('获取当前位置','id="planner-location-refresh"')}</div><label>想吃什么<select id="planner-food-type"><option value="restaurant">餐厅 / 美食</option><option value="cafe">咖啡店</option><option value="bakery">面包 / 甜点</option></select></label><label id="planner-radius-label" hidden>站内查询范围<select id="planner-radius"><option value="500">500 米</option><option value="1000" selected>1 公里</option><option value="1500">1.5 公里</option></select></label></div><div class="planner-links">${button('搜索附近美食','id="planner-nearby-query" hidden')}${button('在本页地图浏览','id="planner-food-map-open" hidden')}</div><p id="planner-food-status" role="status"></p><div id="planner-food-map"></div><div id="planner-food-results"></div><form id="planner-import" class="planner-import"><h3>加入餐厅收藏</h3><label>收藏名称<input name="name" required maxlength="120" placeholder="例如：京都想吃的拉面"></label><label>Google Maps 分享链接<input name="map" required type="text" inputmode="url" autocapitalize="off" placeholder="粘贴 Google Maps 的分享链接"></label><label>自己的备注<textarea name="notes" maxlength="1000" placeholder="想吃什么、预算或预订提醒"></textarea></label><p class="planner-import-status" role="status"></p><button type="submit">♡ 加入我的收藏</button></form>`;}
  const usingCurrent=()=>panel.querySelector('#planner-food-center').value==='current';
  function anchor(){return usingCurrent()?currentLocation:stops[+panel.querySelector('#planner-food-stop').value]||null;}
  function changeCenter(){locationEpoch++;const control=panel.querySelector('#planner-location-refresh');control.disabled=false;if(!currentLocation){panel.querySelector('#planner-location-status').textContent='尚未获取当前位置';control.textContent='获取当前位置';}foodLinks();}
  function foodLinks(invalidate=true){
    if(invalidate!==false){foodEpoch++;foodWorking=false;panel.querySelector('#planner-nearby-query').disabled=false;}
    const currentCenter=usingCurrent(),p=anchor();
    panel.querySelector('#planner-current-center').hidden=!currentCenter;panel.querySelector('#planner-food-stop-label').hidden=currentCenter;
    panel.querySelector('#planner-stop-coordinates').textContent=p?.coordinates?`${p.coordinates.lat.toFixed(5)}, ${p.coordinates.lng.toFixed(5)}`:'此地点暂无坐标，可先在路线整理助手确认位置，或改用当前坐标。';
    panel.querySelector('#planner-food-map').replaceChildren();
    panel.querySelector('#planner-food-results').replaceChildren();panel.querySelector('#planner-food-status').textContent='';
  }
  async function locateFood(){
    if(!valid()||!usingCurrent())return null;
    const stamp=epoch,request=++locationEpoch,control=panel.querySelector('#planner-location-refresh'),status=panel.querySelector('#planner-location-status');
    currentLocation=null;foodLinks(false);control.disabled=true;status.textContent='正在获取设备当前位置…';
    try{
      if(!navigator.geolocation)throw new Error('此浏览器不支持定位，请使用支持定位的浏览器。');
      const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:30000}));
      if(!current(stamp)||request!==locationEpoch)return null;
      const {latitude:lat,longitude:lng,accuracy}=position.coords;
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error('未能取得有效坐标，请重新定位。');
      currentLocation={name:'当前位置',coordinates:{lat,lng}};foodLinks(false);
      status.textContent=`${lat.toFixed(5)}, ${lng.toFixed(5)}${Number.isFinite(accuracy)?' · 精度约 '+Math.ceil(accuracy)+' 米':''}`;
      control.textContent='更新当前位置';return currentLocation;
    }catch(error){
      if(current(stamp)&&request===locationEpoch)status.textContent=error.code===1?'定位权限未开启，请在浏览器的网站设置中允许位置访问，再重试。':error.code===2?'暂时无法获取当前位置，请检查设备定位服务后重试。':error.code===3?'定位超时，请到信号较好的位置再试。':error.message||'定位失败，请重试。';
      return null;
    }finally{if(current(stamp)&&request===locationEpoch)control.disabled=false;}
  }
  async function importPlace(e){
    e.preventDefault();if(!valid())return;const form=e.currentTarget,status=form.querySelector('.planner-import-status'),b=form.querySelector('[type="submit"]'),data=new FormData(form),name=String(data.get('name')).trim(),notes=String(data.get('notes')).trim();
    let map;try{map=C.mapLink(data.get('map'));if(!name)throw new Error('请填写收藏名称。');}catch(error){status.textContent=error.message;return;}
    const key=savedKey(name,day.city),existing=savedPlaces.find(p=>p.key===key&&window.OrbisSavedLibrary.visible(p));
    if(existing){status.textContent='已有这个名称的收藏，请改个名称，或在收藏库中编辑原卡片。';return;}
    const stamp=epoch,record={key,name,city:day.city||'',country:day.country||'',type:'Meal',libraryCategory:'Meal',map,notes,savedAt:Date.now()};
    // A Place ID is a durable reference; provider ratings/photos/addresses never enter the workspace.
    const id=new URL(map).searchParams.get('query_place_id');if(id&&/^[A-Za-z0-9_-]{10,250}$/.test(id))record.googlePlaceId=id;
    b.disabled=true;
    try{savedPlaces.unshift(record);if(persistSavedPlaces()===false)throw new Error('本机保存未完成，请先备份资料，暂不要刷新。');await window.TabiWorkspace.flush?.();if(!current(stamp))return;renderSavedPlaces();renderItinerary();status.textContent='已加入当前行程的餐饮收藏。你也可以把它加入当天日程。';const add=document.createElement('button');add.type='button';add.textContent='加入这一天（时间待安排）';add.onclick=()=>{if(!valid())return;const extra={place:name,city:day.city||'',map,savedPlaceKey:key,libraryCategory:'Meal',mealSlot:'other',...(record.googlePlaceId?{googlePlaceId:record.googlePlaceId}:{})};day.items.push(['','Meal',name,notes,'—',extra]);persistTrip();window.TabiWorkspace.persist();source=JSON.stringify(day.items);stops=day.items.map((item,index)=>({item,index,...C.stop(item,day)})).filter(p=>['Activity','Meal','Stay','Shop','Other'].includes(p.item[1]));panel.querySelector('#planner-routes').innerHTML=renderRoutes();panel.querySelectorAll('[data-leg-map-mode]').forEach(b=>b.onclick=()=>showLegMap(+b.dataset.leg,b.dataset.legMapMode));renderItinerary();add.disabled=true;add.textContent='已加入当天';};status.append(document.createElement('br'),add);form.reset();}
    catch(error){if(context===identity()&&savedPlaces.includes(record)){savedPlaces.splice(savedPlaces.indexOf(record),1);persistSavedPlaces();}status.textContent=error.message;}
    finally{b.disabled=false;}
  }
  async function browseFoodMap(){
    if(!valid()||!embedKey)return;const stamp=epoch,query=foodEpoch,control=panel.querySelector('#planner-food-map-open'),status=panel.querySelector('#planner-food-status');control.disabled=true;
    try{
      const p=usingCurrent()?await locateFood():anchor();if(!p||!current(stamp)||query!==foodEpoch||anchor()!==p)return;
      if(!p.coordinates){status.textContent='请先确认这个日程地点的坐标，或切换到当前坐标。';return;}
      const type=panel.querySelector('#planner-food-type').value,radius=+panel.querySelector('#planner-radius').value;
      panel.querySelector('#planner-food-map').innerHTML=`<iframe class="planner-route-map" title="所选坐标附近的餐厅地图" src="${safe(C.embedNearby(p,type,embedKey,radius))}" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><p class="planner-hint">地图以所选坐标为中心浏览周边店铺；按米筛选和收藏请使用「搜索附近美食」。</p>`;
    }catch(error){if(current(stamp)&&query===foodEpoch)status.textContent=error.message;}
    finally{if(current(stamp))control.disabled=false;}
  }
  async function searchFood(){
    if(!valid()||foodWorking)return;const status=panel.querySelector('#planner-food-status'),stamp=epoch,query=++foodEpoch;
    const control=panel.querySelector('#planner-nearby-query');foodWorking=true;control.disabled=true;
    try{
      const p=usingCurrent()?await locateFood():anchor();if(!p||!current(stamp)||query!==foodEpoch)return;
      if(!p.coordinates){status.textContent='这个日程地点还没有坐标，请先在路线整理助手确认位置，或切换到当前坐标。';return;}
      const queryType=panel.querySelector('#planner-food-type').value,queryRadius=+panel.querySelector('#planner-radius').value;status.textContent=usingCurrent()?'正在搜索当前位置附近的美食…':`正在搜索 ${p.name} 附近的美食…`;
      const value=await window.OrbisCloud.planner('nearby',{center:p.coordinates,radius:queryRadius,type:queryType});if(!current(stamp)||query!==foodEpoch||anchor()!==p||panel.querySelector('#planner-food-type').value!==queryType||+panel.querySelector('#planner-radius').value!==queryRadius)return;if(value.fallback){status.textContent=value.reason;return;}
      const places=value.places||[];status.textContent=places.length?'按 Google 的人气排序。评分和营业状态仅供当前查询参考。':'这个范围没有找到结果，可以扩大范围或点击「在本页地图浏览」。';
      panel.querySelector('#planner-food-results').innerHTML=`<p class="GMP-attribution" translate="no">Google Maps</p>${places.map((p,i)=>`<article class="planner-food-card"><h3>${safe(p.name)}</h3><p>${safe(p.address)}</p><p>${p.rating?`★ ${safe(p.rating)} · ${safe(p.ratingCount||0)} 条评分`:''} ${p.openNow===true?'· 目前营业':p.openNow===false?'· 目前未营业':''}</p><div class="planner-links">${link('地图详情','https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:p.name,query_place_id:p.id}))}${button('♡ 收藏',`data-food-save="${i}" aria-label="收藏${safe(p.name)}"`)}</div>${(p.attributions||[]).map(a=>a.uri?link(safe(a.name),a.uri):`<small>${safe(a.name)}</small>`).join('')}</article>`).join('')}`;
      panel.querySelectorAll('[data-food-save]').forEach(b=>b.onclick=()=>{const p=places[+b.dataset.foodSave],form=panel.querySelector('#planner-import');form.elements.map.value='https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:'restaurant',query_place_id:p.id});form.elements.name.placeholder='给这家店起个收藏名';form.scrollIntoView({block:'nearest',behavior:'smooth'});form.elements.name.focus();});
    }catch(error){if(current(stamp)&&query===foodEpoch)status.textContent=error.message;}finally{if(current(stamp)&&query===foodEpoch){foodWorking=false;control.disabled=false;}}
  }
  function mount(){
    document.querySelectorAll('#timeline .timeline-item').forEach((row,index)=>{if(!['Activity','Meal','Stay','Shop','Other'].includes(days[selected]?.items[index]?.[1]))return;const actions=row.querySelector('.reader-card-actions')||row.querySelector('.item-actions');if(!actions||actions.querySelector('[data-planner-food]'))return;const b=document.createElement('button');b.type='button';b.dataset.plannerFood=index;b.className='planner-food-icon';b.setAttribute('aria-label','查找附近美食');b.title='附近美食';b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 3v7m3-7v7m-6-7v7c0 3 6 3 6 0M5 12v9M17 3c-3 5-3 9 1 9V3m0 9v9"/></svg>';b.onclick=()=>open(selected,index);actions.append(b);});
  }
  const baseItinerary=window.renderItinerary;window.renderItinerary=function(...args){const value=baseItinerary.apply(this,args);mount();return value;};mount();
  function clear(){epoch++;locationEpoch++;currentLocation=null;foodWorking=false;embedKey='';panel.replaceChildren();}
  function open(index=selected,focusFood=null){selected=index;showPage('map');if(focusFood!==null&&panel.querySelector('#planner-food')){panel.querySelector('#planner-food-center').value='schedule';const i=stops.findIndex(p=>p.index===focusFood);panel.querySelector('#planner-food-stop').value=String(i);changeCenter();tab('food');}}
  const previousShow=window.showPage;
  window.showPage=function(page){if(page!=='map')clear();return previousShow.apply(this,arguments);};
  window.addEventListener('orbis-account-changed',clear);
  window.OrbisDayPlanner={open,render};
  if(document.querySelector('#map').classList.contains('active'))render();
})();
