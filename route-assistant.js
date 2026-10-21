/* Free, explicit geographic route organiser. No LLM and no inferred travel times. */
(() => {
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 9c0 4-5 10-5 10S7 13 7 9a5 5 0 0 1 10 0Z"/><circle cx="12" cy="9" r="1.7"/><path d="M3 18v3h18v-3"/></svg>';
  const trigger=document.createElement('button');trigger.id='route-assistant-trigger';trigger.type='button';trigger.setAttribute('aria-label','打开路线整理助手');trigger.setAttribute('aria-haspopup','dialog');trigger.innerHTML=pin;
  const dialog=document.createElement('dialog');dialog.id='route-assistant-dialog';document.body.append(trigger,dialog);
  const clone=value=>JSON.parse(JSON.stringify(value)),identity=()=>[window.TabiWorkspace?.state.currentUserId,window.TabiWorkspace?.state.currentTripId].join(':');
  let context,day,source,points,modes,proposal,undo,busy=false;
  const valid=()=>context===identity()&&days.includes(day)&&JSON.stringify(day.items)===source;
  const status=text=>{dialog.querySelector('#route-status').textContent=text;};
  function clearPreview(){proposal=null;dialog.querySelector('#route-preview').replaceChildren();}
  function refresh(){
    const options=days.map((d,i)=>`<option value="${i}" ${i===selected?'selected':''}>Day ${i+1} · ${safe(d.iso||d.date)} · ${safe(d.city)}</option>`).join('');
    dialog.innerHTML=`<div class="route-header"><div><p>ROUTE ORGANISER</p><h2>路线整理助手</h2></div><button type="button" class="route-close" aria-label="关闭路线助手">×</button></div><p class="route-copy">先把想去的地点放进当天，再整理顺序。按地理位置减少折返；公交班次、道路和营业时间需在地图核对。</p><label>当天日程<select id="route-day">${options}</select></label><details class="route-library"><summary>从收藏挑选地点</summary><div id="route-library-list"></div><button type="button" id="route-add">加入当天（时间待安排）</button></details><div id="route-stops"></div><p id="route-status" role="status" aria-live="polite"></p><div id="route-preview"></div><div class="route-footer"><button type="button" id="route-plan">预览建议顺序</button><button type="button" id="route-undo" ${undo&&undo.context===identity()?'':'hidden'}>撤销上次调整</button></div>`;
    dialog.querySelector('.route-close').onclick=()=>dialog.close();dialog.querySelector('#route-day').onchange=e=>{if(busy){e.target.value=String(days.indexOf(day));return;}selected=Number(e.target.value);renderItinerary();loadDay();};
    dialog.querySelector('#route-add').onclick=addPlaces;dialog.querySelector('#route-plan').onclick=preview;dialog.querySelector('#route-undo').onclick=restore;loadDay();
  }
  function loadDay(){
    clearPreview();day=days[selected];context=identity();source=JSON.stringify(day?.items||[]);if(!day){status('请先创建行程和日期。');return;}
    points=day.items.map(item=>{const e=item[5]||{};return OrbisRouteOrder.coordinate(e.routeCoordinates||e.coordinates)||OrbisRouteOrder.fromMap(e.map);});
    let first=true;modes=day.items.map(item=>{const saved=item[5]?.routeMode;if(['move','fixed','skip'].includes(saved)){if(saved!=='skip')first=false;return saved;}if(!['Activity','Meal','Stay'].includes(item[1]))return 'skip';const mode=first||['Meal','Stay'].includes(item[1])?'fixed':'move';first=false;return mode;});
    renderStops();renderLibrary();status('首个地点默认固定为出发点。固定或不参与的卡片不会移动；原时间位置保留，不自动生成时间。');
  }
  function renderLibrary(){
    const list=savedPlaces.filter(p=>window.OrbisSavedLibrary.visible(p));
    dialog.querySelector('#route-library-list').innerHTML=list.map(p=>`<label class="route-library-choice"><input type="checkbox" value="${safe(p.key)}" ${day.items.some(item=>item[5]?.savedPlaceKey===p.key)?'disabled':''}><span>${safe(p.name)}<small>${safe([p.city,p.region].filter(Boolean).join(' · '))}</small></span></label>`).join('')||'<p>还没有收藏地点。</p>';
  }
  async function save(){persistTrip();if(window.TabiWorkspace.persist()===false)throw new Error('本机保存未完成，请先备份资料。');await window.TabiWorkspace.flush?.();renderItinerary();}
  async function addPlaces(){
    if(busy)return;if(!valid()){refresh();status('日程已变化，请重新选择。');return;}
    const keys=[...dialog.querySelectorAll('#route-library-list input:checked')].map(el=>el.value),places=keys.map(key=>savedPlaces.find(p=>p.key===key&&OrbisSavedLibrary.visible(p))).filter(Boolean);if(!places.length){status('先勾选想去的收藏地点。');return;}
    const previous=clone(day.items);busy=true;
    try{for(const p of places){const extra={place:p.name,city:p.city||'',country:p.country||'',region:p.region||'',address:p.address||'',map:p.map||'',website:p.website||'',photo:p.photo||'',photoSource:p.photoSource||'',photoCredit:p.photoCredit||'',lookupSource:p.lookupSource||'',savedPlaceKey:p.key,libraryCategory:OrbisSavedLibrary.category(p)};if(p.coordinates)extra.coordinates=p.coordinates;if(p.googlePlaceId)extra.googlePlaceId=p.googlePlaceId;const type=OrbisSavedLibrary.baseType(p);if(type==='Meal')extra.mealSlot='other';day.items.push(['',type,p.name,p.notes||p.description||'','—',extra]);}await save();loadDay();status(`已加入 ${places.length} 个地点，时间待安排。`);}catch(error){day.items=previous;persistTrip();loadDay();status(error.message);}finally{busy=false;}
  }
  function renderStops(){
    dialog.querySelector('#route-stops').innerHTML=day.items.map((item,i)=>`<article class="route-stop"><div class="route-stop-top"><b>${i+1}. ${safe(item[2])}</b><select data-route-mode="${i}" aria-label="${safe(item[2])}的排序方式"><option value="move" ${modes[i]==='move'?'selected':''}>可调整</option><option value="fixed" ${modes[i]==='fixed'?'selected':''}>固定位置</option><option value="skip" ${modes[i]==='skip'?'selected':''}>不参与路线</option></select></div><small>${safe(item[0]||'时间待安排')} · ${safe(item[5]?.city||day.city)}</small><div class="route-location"><span data-route-location="${i}">${points[i]?'坐标已确认':modes[i]==='skip'?'不参与定位':'需要确认位置'}</span><button type="button" data-route-lookup="${i}" aria-label="查找${safe(item[2])}的位置">${pin}</button></div><div data-route-results="${i}"></div></article>`).join('')||'<p>先从收藏挑选地点加入当天。</p>';
    dialog.querySelectorAll('[data-route-mode]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.routeMode);modes[i]=el.value;dialog.querySelector(`[data-route-location="${i}"]`).textContent=points[i]?'坐标已确认':el.value==='skip'?'不参与定位':'需要确认位置';clearPreview();});
    dialog.querySelectorAll('[data-route-lookup]').forEach(el=>el.onclick=()=>lookup(Number(el.dataset.routeLookup),el));
  }
  async function lookup(index,button){
    if(busy)return;if(!valid()){refresh();status('日程已变化，请重新确认。');return;}
    const results=dialog.querySelector(`[data-route-results="${index}"]`),item=day.items[index],stamp=source;button.disabled=true;status('正在查公开地点资料，请核对后选择。');
    try{const searchName=item[5]?.place||(/Stay/i.test(item[1])&&item[3]?item[3]:item[2]);const candidates=(await window.OrbisCloud.lookup(searchName)).map(p=>({...p,point:OrbisRouteOrder.fromMap(p.map)})).filter(p=>p.point);if(!dialog.open||!results.isConnected||source!==stamp||!valid())return;
      results.innerHTML=candidates.map((p,i)=>`<button type="button" data-route-candidate="${i}"><b>${safe(p.name)}</b><small>${safe([p.country,p.region,p.address].filter(Boolean).join(' · '))}</small><span>使用这个位置</span></button>`).join('')||'<p>未找到可靠坐标。可先到地图核对位置，再编辑卡片填入带经纬度的地图链接；不会猜测地点。</p>';
      results.querySelectorAll('[data-route-candidate]').forEach(el=>el.onclick=()=>{if(!valid()){status('日程已变化，请重新打开助手。');return;}points[index]=candidates[Number(el.dataset.routeCandidate)].point;results.replaceChildren();dialog.querySelector(`[data-route-location="${index}"]`).textContent='坐标已确认';clearPreview();status('位置已确认，应用顺序时会保存。');});status('请选择正确的地点位置。');
    }catch(error){status(error.message||'位置查询失败，请稍后重试。');}finally{button.disabled=false;}
  }
  function preview(){
    if(busy)return;if(!valid()){refresh();status('日程已变化，请重新整理。');return;}
    try{if(modes.filter(mode=>mode!=='skip').length<2)throw new Error('至少需要两个参与路线的地点。');proposal=OrbisRouteOrder.plan(points,modes);
      const included=proposal.indices.filter(i=>modes[i]!=='skip');const text=`地理连线：${proposal.before.toFixed(1)} → ${proposal.after.toFixed(1)} km。仅为直线距离，不是步行路程或公交耗时。`;
      dialog.querySelector('#route-preview').innerHTML=`<h3>建议顺序</h3><p>${safe(text)}</p><ol>${proposal.indices.map((i,pos)=>{const next=included[included.indexOf(i)+1],link=modes[i]!=='skip'&&next!==undefined?`https://www.google.com/maps/dir/?api=1&origin=${points[i].lat},${points[i].lng}&destination=${points[next].lat},${points[next].lng}&travelmode=transit`:'';return `<li><b>${safe(day.items[i][2])}</b><small>${modes[i]==='move'?'可调整':modes[i]==='fixed'?'固定位置':'不参与路线'} · ${safe(day.items[pos][0]||'时间待安排')}</small>${link?`<a href="${safe(link)}" target="_blank" rel="noreferrer">查看下一段公交 / 步行 ↗</a>`:''}</li>`;}).join('')}</ol><button type="button" id="route-apply">应用这个顺序</button>`;
      dialog.querySelector('#route-apply').onclick=apply;status(proposal.heuristic?'地点较多，使用近邻与局部改进建议，不保证全局最优。':'顺序按直线距离整理，未核对道路、公交或营业时间。请检查固定预订后再应用。');
    }catch(error){clearPreview();status(error.message);}
  }
  async function apply(){
    if(busy||!proposal)return;if(!valid()){refresh();status('日程已变化，旧建议未应用。');return;}const previous=clone(day.items),oldDay=day,oldContext=context;busy=true;
    try{day.items=proposal.indices.map((i,pos)=>{const item=clone(previous[i]);item[0]=previous[pos][0];item[5]={...(item[5]||{}),routeMode:modes[i],...(points[i]?{routeCoordinates:points[i]}:{})};return item;});await save();undo={context:oldContext,day:oldDay,items:previous,applied:JSON.stringify(day.items)};refresh();status('已调整顺序，原时间位置保留。可以撤销上次调整。');}catch(error){oldDay.items=previous;persistTrip();refresh();status(error.message);}finally{busy=false;}
  }
  async function restore(){
    if(busy||!undo)return;if(undo.context!==identity()||!days.includes(undo.day)||JSON.stringify(undo.day.items)!==undo.applied){status('日程已有新修改，不能用旧备份覆盖。');return;}
    busy=true;const current=undo,previous=clone(current.day.items);try{current.day.items=clone(current.items);await save();undo=null;refresh();status('已恢复调整前的顺序。');}catch(error){current.day.items=previous;persistTrip();status(error.message);}finally{busy=false;}
  }
  trigger.onclick=()=>{if(!window.TabiWorkspace?.state?.trips?.some(t=>t.id===window.TabiWorkspace.state.currentTripId&&t.ownerId===window.TabiWorkspace.state.currentUserId)){toast('请先打开一个行程。');return;}refresh();dialog.showModal();};
  document.addEventListener('orbis-account-changed',()=>{undo=null;if(dialog.open)dialog.close();});
})();
