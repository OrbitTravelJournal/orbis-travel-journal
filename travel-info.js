/* Passenger and flight notes belong to the active trip, using its existing persistence. */
(() => {
  const trip = () => { const state=window.TabiWorkspace?.state; return state?.trips?.find(t=>t.id===state.currentTripId); };
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const page=document.createElement('section'); page.id='travel-info'; page.className='page travel-info-page'; document.querySelector('main').append(page);
  const nav=document.createElement('a'); nav.className='nav-link'; nav.href='#travel-info'; nav.dataset.page='travel-info'; nav.textContent='个人与航班'; nav.setAttribute('aria-label','个人与航班'); document.querySelector('.main-nav').append(nav);
  const mobile=nav.cloneNode(true); mobile.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m21 3-6 18-3-9-9-3zM12 12l9-9"/></svg><span>个人航班</span>'; document.querySelector('.mobile-nav').append(mobile);
  [nav,mobile].forEach(link=>link.onclick=event=>{event.preventDefault();showPage('travel-info');});
  const fallback=document.querySelector('.item-menu-panel [data-fallback-page="journal"]');
  if(fallback){const button=document.createElement('button');button.type='button';button.textContent='个人与航班';button.onclick=()=>showPage('travel-info');fallback.after(button);}
  const fields={
    travelers:[['name','姓名'],['englishName','英文姓名'],['nationality','国籍'],['phone','联系电话','tel'],['notes','个人备注','textarea']],
    flights:[['airline','航空公司'],['number','航班号'],['departureAirport','出发机场 / 航站楼'],['departureAt','出发日期与时间','datetime-local'],['arrivalAirport','到达机场 / 航站楼'],['arrivalAt','到达日期与时间','datetime-local'],['reference','预订编号'],['bookingLink','机票 / 预订链接','url'],['notes','行李、座位及其他备注','textarea']]
  };
  function card(kind,item,index){
    const heading=kind==='travelers'?(item.name||`旅客 ${index+1}`):(item.number|| (index===0?'去程航班':index===1?'返程航班':`航班 ${index+1}`));
    const subtitle=kind==='flights'?[item.departureAirport,item.arrivalAirport].filter(Boolean).join(' → '):item.englishName||'';
    return `<details class="travel-info-card" data-kind="${kind}" ${!Object.values(item).some(Boolean)&&index===0?'open':''}><summary><b>${escape(heading)}</b>${subtitle?`<span>${escape(subtitle)}</span>`:''}</summary><div class="travel-info-fields">${fields[kind].map(([key,label,type='text'])=>`<label>${label}${type==='textarea'?`<textarea data-field="${key}" rows="3">${escape(item[key])}</textarea>`:`<input data-field="${key}" type="${type}" value="${escape(item[key])}">`}</label>`).join('')}${kind==='flights'?'<p class="travel-info-time-note">出发与到达时间均填写对应机场的当地时间。</p>':''}</div></details>`;
  }
  function render(){
    const active=trip(); if(!active){page.innerHTML='<h1>个人与航班</h1><p>请先选择一趟旅行。</p>';return;}
    const info=active.travelInfo||{};
    page.innerHTML=`<p class="eyebrow">TRAVEL DETAILS</p><h1>个人与航班</h1><p class="travel-info-caption">${escape(active.name)}</p><form id="travel-info-form"><button class="travel-info-save" type="submit">保存信息</button><p id="travel-info-status" role="status" aria-live="polite"></p><section><div class="travel-info-section-title"><h2>旅客信息</h2><button type="button" data-add-info="travelers">＋ 添加旅客</button></div><div data-info-list="travelers">${(info.travelers?.length?info.travelers:[{},{}]).map((item,i)=>card('travelers',item,i)).join('')}</div></section><section><div class="travel-info-section-title"><h2>航班信息</h2><button type="button" data-add-info="flights">＋ 添加航班</button></div><div data-info-list="flights">${(info.flights?.length?info.flights:[{},{}]).map((item,i)=>card('flights',item,i)).join('')}</div></section></form>`;
    page.querySelectorAll('[data-add-info]').forEach(button=>button.onclick=()=>{const kind=button.dataset.addInfo,list=page.querySelector(`[data-info-list="${kind}"]`);list.insertAdjacentHTML('beforeend',card(kind,{},list.children.length));});
    page.querySelector('form').onsubmit=event=>{
      event.preventDefault(); if(trip()?.id!==active.id)return;
      const updated={...active.travelInfo};
      for(const kind of ['travelers','flights'])updated[kind]=Array.from(page.querySelectorAll(`[data-kind="${kind}"]`)).map((entry,index)=>{
        const item={...(active.travelInfo?.[kind]?.[index]||{})};entry.querySelectorAll('[data-field]').forEach(input=>item[input.dataset.field]=input.value.trim());return item;
      });
      active.travelInfo=updated;active.updatedAt=Date.now();window.TabiWorkspace.persist();
      page.querySelector('#travel-info-status').textContent='已保存';
      page.querySelectorAll('[data-kind]').forEach((entry,index)=>{const kind=entry.dataset.kind,items=Array.from(page.querySelectorAll(`[data-kind="${kind}"]`)),item=updated[kind][items.indexOf(entry)];entry.querySelector('summary b').textContent=item.name||item.number||(kind==='travelers'?`旅客 ${items.indexOf(entry)+1}`:items.indexOf(entry)===0?'去程航班':items.indexOf(entry)===1?'返程航班':`航班 ${items.indexOf(entry)+1}`);});
    };
  }
  const baseShow=window.showPage;
  window.showPage=function(id){baseShow(id);if(id==='travel-info'){render();document.querySelector('#top-location').textContent='个人与航班';}};
})();
