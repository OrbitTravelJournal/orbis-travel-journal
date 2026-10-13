/* Manual place library: preserve existing records and use explicit map links. */
(() => {
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaults={Activity:{label:'景点',color:'#a175e7',baseType:'Activity'},Stay:{label:'酒店',color:'#60b69d',baseType:'Stay'},Meal:{label:'餐饮',color:'#ff9e4a',baseType:'Meal'},Other:{label:'其他地点',color:'#91a6bc',baseType:'Activity'}};
  const definitions=()=>Object.fromEntries(savedPlaces.filter(p=>p.libraryCategoryDefinition).map(p=>[p.categoryId,{label:p.name,color:p.color,baseType:p.baseType||'Activity'}]));
  const specs=()=>({...defaults,...definitions()});
  const categories=()=>Object.fromEntries(Object.entries(specs()).map(([id,spec])=>[id,spec.label]));
  const spec=id=>specs()[id]||defaults.Other;
  const category=p=>p.libraryCategory||(/meal|restaurant|餐饮|餐厅|food/i.test(p.type||'')?'Meal':/stay|hotel|酒店|住宿/i.test(p.type||'')?'Stay':/activity|landmark|attraction|景点|place/i.test(p.type||'')?'Activity':'Other');
  const url=p=>/^https?:\/\//i.test(p.map||'')?p.map:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name,p.address,p.region,p.city,p.country].filter(Boolean).join(', '))}`;
  const paths={placeAdd:'<path d="M14 9c0 4-5 10-5 10S4 13 4 9a5 5 0 0 1 10 0z"/><circle cx="9" cy="9" r="1.6"/><path d="M18 3v6m-3-3h6"/>',categoryAdd:'<path d="M3 8V5a1 1 0 0 1 1-1h5l3 4h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z"/><path d="M12 11v6m-3-3h6"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',palette:'<circle cx="12" cy="12" r="9"/><circle cx="8" cy="8" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="17" cy="13" r="1"/><path d="M4 15h5l3 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',photo:'<path d="M4 7h4l2-3h4l2 3h4v12H3V7z"/><circle cx="12" cy="13" r="3"/>',edit:'<path d="m14 4 6 6M4 20l5-1L20 8a2 2 0 0 0-4-4L5 15zM4 20h16"/>',pin:'<path d="M18 9c0 5-6 12-6 12S6 14 6 9a6 6 0 0 1 12 0z"/><circle cx="12" cy="9" r="2"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="4"/><path d="M8 3v4m8-4v4M4 10h16m-3 5h-6m3-3v6"/>',trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6"/>',back:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>'};
  const colors={placeAdd:'#13b982',categoryAdd:'#ab55ec',more:'#7e79ad',palette:'#ab55ec',plus:'#13b982',photo:'#4b83f6',edit:'#ab55ec',pin:'#ef7046',calendar:'#9762ff',trash:'#fa5a48',back:'#18beac'};
  const icon=(kind,label,attrs='')=>`<button type="button" class="library-icon" style="--library-accent:${colors[kind]}" aria-label="${safe(label)}" title="${safe(label)}" ${attrs}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg></button>`;
  const visible=p=>!p.libraryDeletedAt&&!p.libraryCategoryDefinition;
  window.OrbisSavedLibrary={category,visible,baseType:p=>spec(category(p)).baseType,decorateItinerary};
  window.isSavedPlace=(name,city)=>savedPlaces.some(p=>p.key===savedKey(name,city)&&visible(p));
  const saveBase=window.savePlace;
  window.savePlace=place=>{const old=savedPlaces.find(p=>p.key===savedKey(place.name,place.city)&&p.libraryDeletedAt);if(old){delete old.libraryDeletedAt;Object.assign(old,place);persistSavedPlaces();renderSavedPlaces();}else saveBase(place);};
  const page=document.querySelector('#restaurants');
  page.innerHTML='<div class="library-head"><div><p class="eyebrow">SAVED PLACES · 收藏地点</p><h1>你的地点卡片库</h1><p>按类别、城市和区域整理，随时加入当天行程。</p></div><div class="library-head-actions">'+icon('placeAdd','添加地点','id="library-add"')+icon('categoryAdd','添加新分类','id="library-add-category"')+'</div></div><div id="saved-place-list"></div>';
  const dialog=document.createElement('dialog');dialog.id='saved-library-dialog';document.body.append(dialog);
  function openForm(title,fields,submit){
    dialog.innerHTML=`<form class="library-form"><div class="library-dialog-head"><h2>${safe(title)}</h2><button type="button" class="library-close" aria-label="关闭地点表单">×</button></div>${fields}<div class="library-form-actions"><button type="button" class="library-cancel">取消</button><button type="submit">保存</button></div></form>`;
    dialog.querySelector('.library-close').onclick=dialog.querySelector('.library-cancel').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();submit(new FormData(e.target));};dialog.showModal();
  }
  const field=(label,name,value='',type='text',required=false)=>`<label>${safe(label)}<input name="${name}" type="${type}" value="${safe(value)}" ${required?'required':''}></label>`;
  function edit(place=null,type='Activity'){
    const p=place||{},kind=place?category(p):type;
    openForm(place?'修改收藏地点':'添加收藏地点',`${field('地点名称','name',p.name,'text',true)}<label>类别<select name="libraryCategory">${Object.entries(categories()).map(([key,label])=>`<option value="${key}" ${key===kind?'selected':''}>${label}</option>`).join('')}</select></label><div class="library-field-row">${field('城市','city',p.city)}${field('区域 / 地标分组','region',p.region)}</div>${field('国家 / 地区','country',p.country)}${field('地址','address',p.address)}${field('Google Maps 链接（可选）','map',p.map,'url')}${field('网站链接（可选）','website',p.website,'url')}<label>备注<textarea name="notes">${safe(p.notes||p.description||'')}</textarea></label>`,data=>{
      const values=Object.fromEntries([...data].map(([k,v])=>[k,String(v).trim()]));if(!values.name)return;
      values.type=spec(values.libraryCategory).baseType;
      const key=savedKey(values.name,values.city);
      if(savedPlaces.some(x=>x!==place&&x.key===key)){toast('这个地点已经在收藏中');return;}
      if(place){Object.assign(place,values,{key});persistSavedPlaces();renderSavedPlaces();}
      else savePlace({...values,savedAt:Date.now()});
      dialog.close();renderItinerary();toast('地点已保存');
    });
  }
  window.addSavedPlaceToDay=key=>{
    const p=savedPlaces.find(x=>x.key===key&&visible(x));if(!p)return;
    openForm('加入日程',`<p>${safe(p.name)}</p><label>选择日期<select name="day">${days.map((d,i)=>`<option value="${i}" ${i===selected?'selected':''}>Day ${i+1} · ${safe(d.iso||d.date)} · ${safe(d.city)}</option>`).join('')}</select></label>${field('计划时间','time','','time',true)}${spec(category(p)).baseType==='Meal'?'<label>用餐安排<select name="mealSlot"><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="other">用餐 / 茶歇</option></select></label>':''}`,data=>{
      const day=days[+data.get('day')],time=String(data.get('time')),kind=spec(category(p)).baseType;if(!day||!time)return;
      const extra={place:p.name,city:p.city||'',country:p.country||'',region:p.region||'',address:p.address||'',map:p.map||'',website:p.website||'',photo:p.photo||'',savedPlaceKey:p.key,libraryCategory:category(p)};
      if(kind==='Meal')extra.mealSlot=String(data.get('mealSlot'));if(p.coordinates)extra.coordinates=p.coordinates;
      const item=[time,kind==='Other'?'Activity':kind,p.name,p.notes||p.description||'','—',extra];
      const at=day.items.findIndex(x=>x[0]>time);day.items.splice(at<0?day.items.length:at,0,item);persistTrip();renderItinerary();dialog.close();toast('已加入所选日期');
    });
  };
  window.renderSavedPlaces=()=>{
    const list=document.querySelector('#saved-place-list');if(!list)return;
    list.innerHTML=Object.entries(categories()).map(([kind,label])=>{
      const places=savedPlaces.filter(p=>visible(p)&&category(p)===kind);if(kind==='Other'&&!places.length)return '';
      const groups=new Map();for(const p of places){const group=[p.country,p.city,p.region].filter(Boolean).join(' · ')||'区域待填写';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(p);}
      return `<section class="library-category" data-library-kind="${safe(kind)}" style="--library-color:${safe(spec(kind).color)}"><header><h2>${safe(label)}<small>${places.length}</small></h2><div class="library-category-actions">${icon('palette','修改分类 '+label,`data-library-category-edit="${safe(kind)}"`)}${icon('plus','添加'+label,`data-library-new="${safe(kind)}"`)}</div></header>${[...groups].map(([group,items])=>`<section class="library-region"><h3>${safe(group)}</h3><div class="library-grid">${items.map(p=>`<article class="library-card">${/^https?:\/\/|^data:image\//i.test(p.photo||'')?`<img src="${safe(p.photo)}" alt="" loading="lazy">`:''}<h4>${safe(p.name)}</h4>${p.zh?`<p>${safe(p.zh)}</p>`:''}${p.address?`<p>${safe(p.address)}</p>`:''}${p.notes||p.description?`<details><summary>备注</summary><p>${safe(p.notes||p.description)}</p></details>`:''}<div class="library-card-tools">${icon('more','展开地点操作','data-library-toggle aria-expanded="false"')}<div class="library-card-actions" hidden inert><a class="library-icon" style="--library-accent:#ef7046" href="${safe(url(p))}" target="_blank" rel="noreferrer" aria-label="导航" title="导航"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.pin}</svg></a>${icon('photo',p.photo?'更换图片':'添加图片',`data-library-photo="${safe(p.key)}"`)}${icon('edit','修改地点',`data-library-edit="${safe(p.key)}"`)}${icon('calendar','加入日程',`data-saved-add="${safe(p.key)}"`)}${icon('trash','删除地点',`data-library-delete="${safe(p.key)}"`)}</div></div></article>`).join('')}</div></section>`).join('')||'<p class="library-empty">还没有地点，点击上方添加。</p>'}</section>`;
    }).join('');
    const deleted=savedPlaces.filter(p=>p.libraryDeletedAt);
    if(deleted.length)list.insertAdjacentHTML('beforeend',`<details class="library-trash"><summary>已删除 · ${deleted.length}</summary>${deleted.map(p=>`<div><span>${safe(p.name)}</span>${icon('back','恢复 '+p.name,`data-library-restore="${safe(p.key)}"`)}</div>`).join('')}</details>`);
    list.querySelectorAll('[data-library-toggle]').forEach(b=>b.onclick=()=>{const panel=b.nextElementSibling,open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'收起地点操作':'展开地点操作');panel.hidden=!open;panel.inert=!open;b.parentElement.classList.toggle('is-open',open);});
    list.querySelectorAll('[data-library-category-edit]').forEach(b=>b.onclick=()=>editCategory(b.dataset.libraryCategoryEdit));
    list.querySelectorAll('[data-library-delete]').forEach(b=>b.onclick=()=>{const p=savedPlaces.find(p=>p.key===b.dataset.libraryDelete&&visible(p));if(!p)return;p.libraryDeletedAt=Date.now();persistSavedPlaces();renderSavedPlaces();renderItinerary();toast('已删除，可在底部恢复');});
    list.querySelectorAll('[data-library-restore]').forEach(b=>b.onclick=()=>{const p=savedPlaces.find(p=>p.key===b.dataset.libraryRestore&&p.libraryDeletedAt);if(!p)return;delete p.libraryDeletedAt;persistSavedPlaces();renderSavedPlaces();renderItinerary();toast('地点已恢复');});
    list.querySelectorAll('[data-library-photo]').forEach(b=>b.onclick=()=>{if(photoBusy){toast('图片正在处理，请稍候');return;}photoTarget=savedPlaces.find(p=>p.key===b.dataset.libraryPhoto&&visible(p));photoInput.value='';photoInput.click();});
    list.querySelectorAll('[data-library-new]').forEach(b=>b.onclick=()=>edit(null,b.dataset.libraryNew));
    list.querySelectorAll('[data-library-edit]').forEach(b=>b.onclick=()=>edit(savedPlaces.find(p=>p.key===b.dataset.libraryEdit)));
    list.querySelectorAll('[data-saved-add]').forEach(b=>b.onclick=()=>addSavedPlaceToDay(b.dataset.savedAdd));
  };
  function editCategory(id=null){
    const current=id?spec(id):{label:'',color:'#a175e7',baseType:'Activity'};
    openForm(id?'修改分类':'添加分类',`${field('分类名称','label',current.label,'text',true)}${field('分类颜色','color',current.color,'color')}<label>用于行程<select name="baseType"><option value="Activity" ${current.baseType==='Activity'?'selected':''}>普通地点</option><option value="Meal" ${current.baseType==='Meal'?'selected':''}>餐饮（早餐 / 午餐 / 晚餐）</option><option value="Stay" ${current.baseType==='Stay'?'selected':''}>住宿</option></select></label>`,data=>{
      const label=String(data.get('label')).trim();if(!label)return;
      const categoryId=id||'custom-'+crypto.randomUUID();
      let definition=savedPlaces.find(p=>p.libraryCategoryDefinition&&p.categoryId===categoryId);
      if(!definition){definition={key:'category:'+categoryId,libraryCategoryDefinition:true,categoryId};savedPlaces.push(definition);}
      Object.assign(definition,{name:label,color:String(data.get('color')),baseType:String(data.get('baseType'))});persistSavedPlaces();renderSavedPlaces();renderItinerary();dialog.close();toast('分类与行程颜色已更新');
    });
  }
  function decorateItinerary(){
    const day=days[selected];if(!day)return;
    document.querySelectorAll('#timeline .timeline-item').forEach((row,index)=>{
      const item=day.items[index],card=row.querySelector('.item-card');if(!item||!card)return;
      const linked=savedPlaces.find(p=>(p.key===item[5]?.savedPlaceKey||p.key===savedKey(item[2],item[5]?.city||day.city))&&!p.libraryCategoryDefinition);
      const id=linked?category(linked):(item[5]?.libraryCategory||item[1]);
      if(!specs()[id])return;
      const info=spec(id),color=/^#[\da-f]{6}$/i.test(info.color)?info.color:defaults.Activity.color;
      const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(' ');card.style.setProperty('--category-rgb',rgb);card.style.setProperty('--category-ink','#41414a');
      card.dataset.libraryCategory=id;card.dataset.stopKind=String(info.baseType).toLowerCase();const tag=card.querySelector('.item-type');if(tag)tag.textContent=info.label+(info.baseType==='Meal'&&item[5]?.mealSlot?' · '+({breakfast:'早餐',lunch:'午餐',dinner:'晚餐',other:'茶歇'}[item[5].mealSlot]||''): '');
    });
    document.querySelectorAll('#timeline .reader-card-actions').forEach(panel=>{
      if(panel.parentElement.classList.contains('reader-action-group'))return;
      const group=document.createElement('div');group.className='reader-action-group';panel.before(group);group.innerHTML=icon('more','展开卡片操作','data-reader-action-toggle aria-expanded="false"');group.append(panel);panel.hidden=true;panel.inert=true;
      const button=group.querySelector('button');button.onclick=()=>{document.querySelectorAll('#timeline .reader-action-group.is-open').forEach(other=>{if(other!==group){other.classList.remove('is-open');other.querySelector('.reader-card-actions').hidden=true;other.querySelector('.reader-card-actions').inert=true;other.querySelector('[data-reader-action-toggle]').setAttribute('aria-expanded','false');}});const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'收起卡片操作':'展开卡片操作');panel.hidden=!open;panel.inert=!open;group.classList.toggle('is-open',open);};
    });
    document.querySelector('#library-itinerary-picker')?.remove();
    const available=savedPlaces.filter(visible);if(!available.length)return;
    const picker=document.createElement('details');picker.id='library-itinerary-picker';picker.className='meal-options';
    picker.innerHTML=`<summary>从收藏选择地点</summary><label class="meal-city-filter">分类<select aria-label="选择收藏分类"><option value="">全部分类</option>${Object.entries(categories()).filter(([id])=>available.some(p=>category(p)===id)).map(([id,label])=>`<option value="${safe(id)}">${safe(label)}</option>`).join('')}</select></label><div class="meal-choice-rail">${available.map(p=>`<article class="meal-choice" data-library-choice="${safe(category(p))}"><small>${safe(spec(category(p)).label)} · ${safe(p.city||'')}</small><b>${safe(p.name)}</b>${icon('calendar','加入日程 '+p.name,`data-library-plan="${safe(p.key)}"`)}</article>`).join('')}</div>`;
    picker.querySelector('select').onchange=e=>picker.querySelectorAll('[data-library-choice]').forEach(card=>card.hidden=!!e.target.value&&card.dataset.libraryChoice!==e.target.value);
    picker.querySelectorAll('[data-library-plan]').forEach(b=>b.onclick=()=>addSavedPlaceToDay(b.dataset.libraryPlan));document.querySelector('#timeline').before(picker);
  }
  let photoTarget;
  const photoInput=document.createElement('input');photoInput.type='file';photoInput.accept='image/*';photoInput.hidden=true;document.body.append(photoInput);
  const photoError=(name,message)=>Object.assign(new Error(message),{name});
  const readPhoto=file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(photoError('PhotoReadError','无法读取图片'));
    reader.onload=()=>{const image=new Image();image.onerror=()=>reject(photoError('PhotoFormatError','图片格式无法解码'));image.onload=()=>resolve(image);image.src=reader.result;};reader.readAsDataURL(file);
  });
  function thumbnail(image,maxSide,quality){
    const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');if(!context)throw photoError('PhotoReadError','无法处理图片');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',quality);
  }
  let photoBusy=false;
  photoInput.onchange=async()=>{
    const file=photoInput.files?.[0],p=photoTarget;if(!file||!p||photoBusy)return;
    photoBusy=true;const previous=p.photo,state=window.TabiWorkspace?.state,tripId=state?.currentTripId,trip=state?.trips.find(t=>t.id===state.currentTripId&&t.ownerId===state.currentUserId),tripSaved=trip?.saved;
    toast('正在处理图片…');
    try{
      const image=await readPhoto(file);let saved=false,lastError;
      for(const [side,quality] of [[960,.72],[800,.65],[640,.58],[480,.5],[320,.45]]){
        const photo=thumbnail(image,side,quality);if(photo.length>180000&&side>320)continue;
        try{
          if(window.TabiWorkspace?.state?.currentTripId!==tripId||!savedPlaces.includes(p))throw photoError('PhotoTargetError','当前地点已变化');
          p.photo=photo;persistSavedPlaces();
          if(trip){trip.saved=JSON.parse(JSON.stringify(savedPlaces));if(window.TabiWorkspace.persist()===false)throw photoError('QuotaExceededError','存储空间不足');}
          saved=true;break;
        }catch(error){lastError=error;if(!['QuotaExceededError','NS_ERROR_DOM_QUOTA_REACHED'].includes(error?.name))throw error;}
      }
      if(!saved)throw lastError||photoError('QuotaExceededError','存储空间不足');
      renderSavedPlaces();renderItinerary();toast('图片已保存');
    }catch(error){
      if(previous===undefined)delete p.photo;else p.photo=previous;
      if(trip)trip.saved=tripSaved;
      try{persistSavedPlaces();window.TabiWorkspace?.persist();}catch{}
      const message=error?.name==='PhotoFormatError'?'浏览器无法读取这张图片，请先转换成 JPG 或 PNG。':error?.name==='QuotaExceededError'||error?.name==='NS_ERROR_DOM_QUOTA_REACHED'?'浏览器存储空间不足，图片未保存。已有攻略和图片保留。':error?.name==='PhotoTargetError'?'地点已切换，请重新选择图片。':'图片读取失败，请重新选择 JPG 或 PNG。';
      toast(message);
    }finally{photoInput.value='';photoBusy=false;}
  };
  document.querySelector('#library-add-category').onclick=()=>editCategory();
  const showBase=window.showPage;window.showPage=function(id){showBase(id);if(id==='restaurants')document.querySelector('#top-location').textContent='SAVED PLACES';};
  if(page.classList.contains('active'))document.querySelector('#top-location').textContent='SAVED PLACES';
  document.querySelector('#library-add').onclick=()=>edit();
  const search=document.querySelector('#open-search');if(search){search.onclick=()=>edit();search.setAttribute('aria-label','添加收藏地点');search.innerHTML=icon('plus','添加收藏地点').replace(/^<button[^>]*>/,'').replace(/<\/button>$/,'');search.classList.add('library-icon');search.style.setProperty('--library-accent',colors.plus);}
  const old=document.querySelector('#search-dialog');if(old){old.close();old.remove();}
  renderSavedPlaces();
})();
