/* Meal choices reuse trip data; existing arrangements remain available for restoration. */
(() => {
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={breakfast:'早餐',lunch:'午餐',dinner:'晚餐',other:'用餐 / 茶歇'};
  const slot=item=>item[5]?.mealSlot||(/breakfast|早餐/i.test(item[2])?'breakfast':/lunch|午餐/i.test(item[2])?'lunch':/dinner|晚餐/i.test(item[2])?'dinner':'other');
  const area=day=>window.OrbisStays?.areaForDay(hotels,day,hiddenHotelBookings)||day.city;
  const normalize=v=>String(v||'').trim().toLowerCase();
  function choices(day,mealSlot){
    const city=normalize(area(day)),list=[];
    for(const place of savedPlaces||[])if(/meal|restaurant|餐厅|餐饮/i.test(place.type||'')&&normalize(place.city)===city)list.push({...place,note:place.notes||place.description||'',source:'收藏'});
    for(const d of days)for(const item of d.items||[])if(item[1]==='Meal'&&(mealSlot==='other'||slot(item)==='other'||slot(item)===mealSlot)&&(d===day||normalize(item[5]?.city||area(d))===city)){
      const e=item[5]||{};list.push({name:item[2],note:item[3],city:e.city||area(d),country:e.country||d.country,map:e.map,website:e.website,photo:e.photo,address:e.address,coordinates:e.coordinates,duration:item[4],source:'已有攻略'});
    }
    return list.filter((p,i)=>p.name&&list.findIndex(x=>normalize(x.name)===normalize(p.name))===i);
  }
  function chooser(day,mealSlot,item){
    const candidates=choices(day,mealSlot),details=document.createElement('details');details.className='meal-options';
    details.innerHTML=`<summary>${item?'更换餐厅':'选择餐厅'}</summary>${item?'':`<label class="meal-time-label">用餐时间<input type="time" aria-label="${labels[mealSlot]}时间" required></label>`}<div class="meal-choice-rail">${candidates.map((p,i)=>`<article class="meal-choice"><small>${safe(p.source)} · ${safe(p.city||'')}</small><b>${safe(p.name)}</b><p>${safe(p.note||'')}</p><a href="${safe(/^https?:\/\//i.test(p.map||'')?p.map:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name,p.address,p.city].filter(Boolean).join(', '))}`)}" target="_blank" rel="noreferrer">导航 ↗</a><button type="button" data-meal-choice="${i}">选这家</button></article>`).join('')||'<p class="meal-empty">暂时没有该区域的餐厅。先在收藏中保存餐厅，或按原方式添加用餐地点。</p>'}</div>${item?.[5]?.mealOriginal?'<button type="button" class="meal-restore">恢复原安排</button>':''}`;
    details.querySelectorAll('[data-meal-choice]').forEach(button=>button.onclick=()=>{
      const time=details.querySelector('input');if(time&&!time.reportValidity())return;
      const p=candidates[+button.dataset.mealChoice];
      if(item&&normalize(item[2])===normalize(p.name)){details.open=false;return;}
      const original=item?(item[5]?.mealOriginal||JSON.parse(JSON.stringify(item))):null;
      const extra={...(item?.[5]||{}),mealSlot,place:p.name,city:p.city||area(day),country:p.country||day.country||'',address:p.address||'',map:p.map||'',website:p.website||'',photo:p.photo||''};
      delete extra.coordinates;delete extra.locationKey;delete extra.booked;delete extra.bookingStatus;
      if(p.coordinates)extra.coordinates=p.coordinates;if(original)extra.mealOriginal=original;
      if(item){item[2]=p.name;item[3]=p.note||'';item[5]=extra;}
      else{const next=[time.value,'Meal',p.name,p.note||'',p.duration||'—',extra];let index=day.items.findIndex(x=>x[0]>time.value);day.items.splice(index<0?day.items.length:index,0,next);}
      persistTrip();renderItinerary();toast('用餐安排已保存');
    });
    const restore=details.querySelector('.meal-restore');if(restore)restore.onclick=()=>{const original=JSON.parse(JSON.stringify(item[5].mealOriginal));item.splice(0,item.length,...original);persistTrip();renderItinerary();};
    if(item?.[5]?.mealOriginal){const original=item[5].mealOriginal,p=document.createElement('p');p.className='meal-original';p.textContent=`原安排：${original[2]} · ${original[3]||''}`;details.append(p);}
    return details;
  }
  function render(){
    const day=days[selected];if(!day)return;
    document.querySelector('#meal-day-picker')?.remove();
    const picker=document.createElement('section');picker.id='meal-day-picker';picker.setAttribute('aria-label','当天用餐选择');
    const title=document.createElement('p');title.className='meal-picker-title';title.textContent='当天用餐 · 时间跟着当天安排走';picker.append(title);
    const slots=document.createElement('div');slots.className='meal-slot-grid';picker.append(slots);
    for(const mealSlot of ['breakfast','lunch','dinner']){
      const meals=day.items.filter(x=>x[1]==='Meal'&&slot(x)===mealSlot),entry=document.createElement('div');entry.className='meal-slot';
      const label=document.createElement('b');label.textContent=labels[mealSlot];entry.append(label);
      if(meals.length){const note=document.createElement('small');note.textContent=meals.map(x=>`${x[0]} · ${x[2]}`).join(' / ');entry.append(note);}
      else entry.append(chooser(day,mealSlot,null));slots.append(entry);
    }
    document.querySelector('#timeline').before(picker);
    document.querySelectorAll('#timeline .timeline-item').forEach((row,index)=>{
      const item=day.items[index];if(item?.[1]!=='Meal')return;
      const card=row.querySelector('.item-card');card.classList.add('meal-card');
      const type=card.querySelector('.item-type');if(type)type.textContent=`餐饮 · ${labels[slot(item)]}`;
      card.append(chooser(day,slot(item),item));
    });
  }
  const base=window.renderItinerary;window.renderItinerary=function(){base();render();};
  if(days[selected])renderItinerary();
})();
