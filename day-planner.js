/* Routes and restaurant discovery are explicit actions. Google responses stay in this dialog only. */
(() => {
  const C=window.OrbisDayPlannerCore;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state=()=>window.TabiWorkspace?.state;
  const identity=()=>[state()?.currentUserId,state()?.currentTripId].join(':');
  const owned=()=>state()?.trips?.some(t=>t.id===state().currentTripId&&t.ownerId===state().currentUserId);
  const dialog=document.createElement('dialog');dialog.id='day-planner-dialog';document.body.append(dialog);
  let day,context,source,stops=[],configured=false,epoch=0,working=false;
  const current=stamp=>dialog.open&&stamp===epoch&&context===identity()&&days.includes(day)&&source===JSON.stringify(day.items);
  const message=text=>{const el=dialog.querySelector('#planner-status');if(el)el.textContent=text;};
  const valid=()=>{if(current(epoch))return true;message('行程已有变化，请重新打开当天路线，避免使用旧资料。');return false;};
  const button=(text,attrs='')=>`<button type="button" ${attrs}>${text}</button>`;
  const link=(label,url)=>`<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
  const links=(a,b)=>a.needsLocation||b.needsLocation?`<p>餐厅分享短链接还需确认具体位置，请先在地图打开地点，再查看两地路线。</p><div class="planner-links">${a.map?link('打开出发地点',a.map):''}${b.map?link('打开目的地点',b.map):''}</div>`:`<div class="planner-links">${link('徒步',C.directions(a,b,'walking'))}${link('公交 / 地铁优先',C.directions(a,b,'transit'))}${link('打车参考',C.directions(a,b,'driving'))}</div>`;
  function open(index=selected,focusFood=null){
    if(!owned()){toast('请先打开一个行程。');return;}
    day=days[index];if(!day){toast('请先添加一个日期。');return;}context=identity();source=JSON.stringify(day.items);stops=day.items.map((item,index)=>({item,index,...C.stop(item,day)})).filter(p=>['Activity','Meal','Stay','Shop','Other'].includes(p.item[1]));epoch++;working=false;configured=false;
    const stamp=epoch;
    dialog.innerHTML=`<header class="planner-head"><div><p class="eyebrow">DAY ROUTE & FOOD</p><h2>当天路线 · 附近美食</h2></div>${button('×','class="planner-close" aria-label="关闭当天路线"')}</header><label class="planner-day-label">行程日期<select id="planner-day">${days.map((d,i)=>`<option value="${i}" ${d===day?'selected':''}>Day ${i+1} · ${safe(d.iso||d.date)} · ${safe(d.city)}</option>`).join('')}</select></label><p id="planner-status" role="status" aria-live="polite">免费地图模式：路线、班次和美食在 Google Maps 查看，不产生 Google Maps API 调用费。</p><div class="planner-rule"><label>步行阈值<select id="planner-threshold"><option value="400">400 米</option><option value="500" selected>500 米</option><option value="600">600 米</option></select></label><p>已知实际步行距离在阈值内选徒步；超过时优先地铁 / 火车，再考虑公交，最后打车。免费模式请在地图核对距离后选择。</p></div><div id="planner-api-tools" hidden><p>按实际步行路线判断交通方式；轨道交通优先，无合适公共交通时提供打车参考。</p><label>出发时区<select id="planner-offset"><option value="+09:00">日本 UTC+09:00</option><option value="+08:00">UTC+08:00</option><option value="+11:00">UTC+11:00</option><option value="+10:00">UTC+10:00</option><option value="+00:00">UTC</option></select></label>${button('计算当天交通','id="planner-compute"')}</div><div class="planner-tabs" role="group" aria-label="查看内容">${button('逐段路线','data-planner-tab="routes" aria-pressed="true"')}${button('附近美食','data-planner-tab="food" aria-pressed="false"')}</div><section id="planner-routes">${renderRoutes()}</section><section id="planner-food" hidden>${renderFood()}</section><details class="planner-about"><summary>地图服务与隐私</summary><p>免费入口会在新窗口打开 Google Maps。站内查询仅在管理员连接 Google API 后启用，按点击查询，达到保护上限会停止。查询会把所选地点和出发时间交给 Google，不传照片或完整行程。收藏仅保留你填写的名称、备注和地图引用。</p><p>${link('Google Maps 使用条款','https://www.google.com/help/terms_maps/')}${link('Google 隐私政策','https://policies.google.com/privacy')}</p></details>`;
    dialog.querySelector('.planner-close').onclick=()=>dialog.close();
    dialog.querySelector('#planner-day').onchange=e=>open(+e.target.value);
    dialog.querySelectorAll('[data-planner-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.plannerTab));
    dialog.querySelector('#planner-compute').onclick=compute;
    dialog.querySelector('#planner-food-stop').onchange=foodLinks;
    dialog.querySelector('#planner-food-type').onchange=foodLinks;
    dialog.querySelector('#planner-nearby-query').onclick=searchFood;
    dialog.querySelector('#planner-import').onsubmit=importPlace;
    foodLinks();
    dialog.querySelectorAll('[data-leg-compute]').forEach(b=>b.onclick=()=>computeLeg(+b.dataset.legCompute,b));
    if(!dialog.open)dialog.showModal();
    if(focusFood!==null){const p=stops.findIndex(p=>p.index===focusFood);if(p>=0)dialog.querySelector('#planner-food-stop').value=String(p);foodLinks();tab('food');}
    // Small status request only after the user opens this feature. No provider call.
    window.OrbisCloud?.planner('status').then(result=>{if(!current(stamp))return;configured=result.configured===true;dialog.querySelector('#planner-api-tools').hidden=!configured;dialog.querySelectorAll('.planner-leg-input').forEach(b=>b.hidden=!configured);dialog.querySelector('#planner-radius-label').hidden=!configured;dialog.querySelectorAll('[data-leg-compute]').forEach(b=>b.hidden=!configured);dialog.querySelector('#planner-nearby-query').hidden=!configured;if(configured)message('已连接 Google Maps。仅点击查询时使用；达到保护上限后使用免费地图链接。');}).catch(()=>{});
  }
  function tab(name){dialog.querySelector('#planner-routes').hidden=name!=='routes';dialog.querySelector('#planner-food').hidden=name!=='food';dialog.querySelectorAll('[data-planner-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.plannerTab===name)));}
  function renderRoutes(){
    if(stops.length<2)return '<p>当天至少需要两个景点、餐厅或酒店。你可以先把收藏加入当天。</p>';
    return `<p class="planner-hint">按当前日程顺序出发。每段分别打开地图，原有行程不会被改动。</p>${stops.slice(0,-1).map((a,i)=>{const b=stops[i+1],time=/^\d\d:\d\d$/.test(a.item[0])?a.item[0]:'09:00';return `<article class="planner-leg"><span class="planner-leg-number">${i+1}</span><div><h3>${safe(a.name)} → ${safe(b.name)}</h3>${links(a,b)}<div class="planner-leg-input" hidden><label>本段出发时间（请核对游览后时间）<input type="datetime-local" data-leg-time="${i}" value="${safe(day.iso||'')}T${time}"></label>${button('查询本段',`data-leg-compute="${i}" hidden`)}</div><div data-leg-result="${i}" aria-live="polite"></div></div></article>`;}).join('')}<p class="planner-hint">“打车参考”打开驾车路线；实际车费和叫车需到打车平台确认。</p>`;
  }
  function renderFood(){return `<p>选择景点或酒店，查看周围餐厅；找到喜欢的店后，复制它的分享链接，加入下方收藏。</p><div class="planner-food-controls"><label>以哪里为中心<select id="planner-food-stop">${stops.map((p,i)=>`<option value="${i}">${safe(p.name)}</option>`).join('')||'<option value="-1">当天城市</option>'}</select></label><label>想吃什么<select id="planner-food-type"><option value="restaurant">餐厅 / 美食</option><option value="cafe">咖啡店</option><option value="bakery">面包 / 甜点</option></select></label><label id="planner-radius-label" hidden>站内查询范围<select id="planner-radius"><option value="500">500 米</option><option value="1000" selected>1 公里</option><option value="1500">1.5 公里</option></select></label></div><div id="planner-food-links" class="planner-links"></div>${button('在网站内搜索','id="planner-nearby-query" hidden')}<p id="planner-food-status" role="status"></p><div id="planner-food-results"></div><form id="planner-import" class="planner-import"><h3>加入餐厅收藏</h3><label>收藏名称<input name="name" required maxlength="120" placeholder="例如：京都想吃的拉面"></label><label>Google Maps 分享链接<input name="map" required type="text" inputmode="url" autocapitalize="off" placeholder="粘贴 Google Maps 的分享链接"></label><label>自己的备注<textarea name="notes" maxlength="1000" placeholder="想吃什么、预算或预订提醒"></textarea></label><p class="planner-import-status" role="status"></p><button type="submit">♡ 加入我的收藏</button></form>`;}
  function anchor(){return stops[+dialog.querySelector('#planner-food-stop').value]||{name:day.city,address:[day.city,day.country].filter(Boolean).join(', ')};}
  function foodLinks(){const p=anchor();dialog.querySelector('#planner-food-links').innerHTML=p.needsLocation?link('打开此地点，在地图搜索周边',p.map):link('在 Google Maps 找附近美食',C.nearby(p,dialog.querySelector('#planner-food-type').value));dialog.querySelector('#planner-food-results').replaceChildren();dialog.querySelector('#planner-food-status').textContent='';}
  async function importPlace(e){
    e.preventDefault();if(!valid())return;const form=e.currentTarget,status=form.querySelector('.planner-import-status'),b=form.querySelector('[type="submit"]'),data=new FormData(form),name=String(data.get('name')).trim(),notes=String(data.get('notes')).trim();
    let map;try{map=C.mapLink(data.get('map'));if(!name)throw new Error('请填写收藏名称。');}catch(error){status.textContent=error.message;return;}
    const key=savedKey(name,day.city),existing=savedPlaces.find(p=>p.key===key&&window.OrbisSavedLibrary.visible(p));
    if(existing){status.textContent='已有这个名称的收藏，请改个名称，或在收藏库中编辑原卡片。';return;}
    const stamp=epoch,record={key,name,city:day.city||'',country:day.country||'',type:'Meal',libraryCategory:'Meal',map,notes,savedAt:Date.now()};
    // A Place ID is a durable reference; provider ratings/photos/addresses never enter the workspace.
    const id=new URL(map).searchParams.get('query_place_id');if(id&&/^[A-Za-z0-9_-]{10,250}$/.test(id))record.googlePlaceId=id;
    b.disabled=true;
    try{savedPlaces.unshift(record);if(persistSavedPlaces()===false)throw new Error('本机保存未完成，请先备份资料，暂不要刷新。');await window.TabiWorkspace.flush?.();if(!current(stamp))return;renderSavedPlaces();renderItinerary();status.textContent='已加入当前行程的餐饮收藏。你也可以把它加入当天日程。';const add=document.createElement('button');add.type='button';add.textContent='加入这一天（时间待安排）';add.onclick=()=>{if(!valid())return;const extra={place:name,city:day.city||'',map,savedPlaceKey:key,libraryCategory:'Meal',mealSlot:'other',...(record.googlePlaceId?{googlePlaceId:record.googlePlaceId}:{})};day.items.push(['','Meal',name,notes,'—',extra]);persistTrip();window.TabiWorkspace.persist();source=JSON.stringify(day.items);renderItinerary();add.disabled=true;add.textContent='已加入当天';};status.append(document.createElement('br'),add);form.reset();}
    catch(error){if(context===identity()&&savedPlaces.includes(record)){savedPlaces.splice(savedPlaces.indexOf(record),1);persistSavedPlaces();}status.textContent=error.message;}
    finally{b.disabled=false;}
  }
  async function searchFood(){
    if(!valid()||working)return;const p=anchor(),status=dialog.querySelector('#planner-food-status'),stamp=epoch;
    if(!p.coordinates){status.textContent='此地点还没有确认坐标。请用免费地图搜索，或先在路线整理助手确认位置。';return;}
    const queryType=dialog.querySelector('#planner-food-type').value,queryRadius=+dialog.querySelector('#planner-radius').value;const control=dialog.querySelector('#planner-nearby-query');control.disabled=true;status.textContent='正在搜索附近美食…';
    try{const value=await window.OrbisCloud.planner('nearby',{center:p.coordinates,radius:queryRadius,type:queryType});if(!current(stamp)||anchor()!==p||dialog.querySelector('#planner-food-type').value!==queryType||+dialog.querySelector('#planner-radius').value!==queryRadius)return;if(value.fallback){status.textContent=value.reason;return;}
      const places=value.places||[];status.textContent=places.length?'按 Google 的人气排序。评分和营业状态仅供当前查询参考。':'这个范围没有找到结果，可以扩大范围或打开地图。';
      dialog.querySelector('#planner-food-results').innerHTML=`<p class="GMP-attribution" translate="no">Google Maps</p>${places.map((p,i)=>`<article class="planner-food-card"><h3>${safe(p.name)}</h3><p>${safe(p.address)}</p><p>${p.rating?`★ ${safe(p.rating)} · ${safe(p.ratingCount||0)} 条评分`:''} ${p.openNow===true?'· 目前营业':p.openNow===false?'· 目前未营业':''}</p><div class="planner-links">${link('地图详情','https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:p.name,query_place_id:p.id}))}${button('♡ 收藏',`data-food-save="${i}" aria-label="收藏${safe(p.name)}"`)}</div>${(p.attributions||[]).map(a=>a.uri?link(safe(a.name),a.uri):`<small>${safe(a.name)}</small>`).join('')}</article>`).join('')}`;
      dialog.querySelectorAll('[data-food-save]').forEach(b=>b.onclick=()=>{const p=places[+b.dataset.foodSave],form=dialog.querySelector('#planner-import');form.elements.map.value='https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:'restaurant',query_place_id:p.id});form.elements.name.placeholder='给这家店起个收藏名';form.scrollIntoView({block:'nearest',behavior:'smooth'});form.elements.name.focus();});
    }catch(error){if(current(stamp))status.textContent=error.message;}finally{control.disabled=false;}
  }
  const distance=m=>Number.isFinite(m)?m<1000?`${Math.round(m)} 米`:`${(m/1000).toFixed(1)} 公里`:'';
  async function computeLeg(i,control){
    if(!valid()||!configured)return false;const stamp=epoch,out=dialog.querySelector(`[data-leg-result="${i}"]`);control.disabled=true;out.textContent='正在查询实际道路与公共交通…';
    try{if(stops[i].needsLocation||stops[i+1].needsLocation)throw new Error('请先补充餐厅的完整地址或地点ID，再计算路线。');const offset=dialog.querySelector('#planner-offset').value,value=await window.OrbisCloud.planner('route',{origin:{address:stops[i].address,coordinates:stops[i].coordinates,placeId:stops[i].placeId},destination:{address:stops[i+1].address,coordinates:stops[i+1].coordinates,placeId:stops[i+1].placeId},threshold:+dialog.querySelector('#planner-threshold').value,departureTime:C.transitTime(dialog.querySelector(`[data-leg-time="${i}"]`).value,offset)});if(!current(stamp))return false;
      if(value.fallback){out.textContent=value.reason;return false;}const route=value.route;
      out.innerHTML=`<div class="planner-google-result"><p class="GMP-attribution" translate="no">Google Maps</p><h4>${value.mode==='WALK'?'徒步':value.mode==='TRANSIT'?value.preference==='RAIL'?'地铁 / 火车优先':'公共交通':value.mode==='DRIVE'?'打车备选 · 驾车参考':'无可用路线'}</h4>${route?`<p>${safe(distance(route.distanceMeters))}${route.durationSeconds?' · 约 '+Math.ceil(route.durationSeconds/60)+' 分钟':''}</p><ol>${route.steps.map(s=>`<li>${safe(s.line?[s.line,s.from&&'从 '+s.from,s.to&&'到 '+s.to].filter(Boolean).join(' · '):s.instruction||s.mode)}${s.departureTime?`<small>${safe(new Date(Date.parse(s.departureTime)+Number(offset.slice(0,3))*3600000).toISOString().slice(11,16))} 出发（所选时区）</small>`:''}</li>`).join('')}</ol>${route.warnings.map(w=>`<small>${safe(w)}</small>`).join('')}`:''}${value.note?`<p>${safe(value.note)}</p>`:''}</div>`;return true;
    }catch(error){if(current(stamp))out.textContent=error.message;return false;}finally{control.disabled=false;}
  }
  async function compute(){if(working||!valid())return;working=true;const stamp=epoch,control=dialog.querySelector('#planner-compute');control.disabled=true;try{for(let i=0;i<stops.length-1;i++){if(!current(stamp)||!await computeLeg(i,dialog.querySelector(`[data-leg-compute="${i}"]`)))break;}}finally{if(stamp===epoch)working=false;control.disabled=false;}}
  function mount(){
    const head=document.querySelector('#itinerary .page-head')||document.querySelector('#itinerary .page-heading')||document.querySelector('#itinerary');
    if(head&&!head.querySelector('#day-planner-open')){const b=document.createElement('button');b.type='button';b.id='day-planner-open';b.className='planner-open';b.textContent='当天路线 · 附近美食';b.onclick=()=>open();head.prepend(b);}
    document.querySelectorAll('#timeline .timeline-item').forEach((row,index)=>{if(!['Activity','Meal','Stay','Shop','Other'].includes(days[selected]?.items[index]?.[1]))return;const actions=row.querySelector('.reader-card-actions')||row.querySelector('.item-actions');if(!actions||actions.querySelector('[data-planner-food]'))return;const b=document.createElement('button');b.type='button';b.dataset.plannerFood=index;b.className='planner-food-icon';b.setAttribute('aria-label','查找附近美食');b.title='附近美食';b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 3v7m3-7v7m-6-7v7c0 3 6 3 6 0M5 12v9M17 3c-3 5-3 9 1 9V3m0 9v9"/></svg>';b.onclick=()=>open(selected,index);actions.append(b);});
  }
  const render=window.renderItinerary;window.renderItinerary=function(...args){const value=render.apply(this,args);mount();return value;};mount();
  document.addEventListener('click',e=>{if(e.target.closest('#route-assistant-trigger')){const footer=document.querySelector('#route-assistant-dialog .route-footer');if(footer&&!footer.querySelector('[data-open-day-planner]')){const b=document.createElement('button');b.type='button';b.dataset.openDayPlanner='';b.textContent='当天交通 · 附近美食';b.onclick=()=>{document.querySelector('#route-assistant-dialog').close();open();};footer.prepend(b);}}});
  dialog.addEventListener('close',()=>{epoch++;dialog.querySelector('#planner-food-results')?.replaceChildren();});
  window.addEventListener('orbis-account-changed',()=>{if(dialog.open)dialog.close();epoch++;});
  window.OrbisDayPlanner={open};
})();
