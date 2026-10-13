/* Manual place library: preserve existing records and use explicit map links. */
(() => {
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categories={Activity:'景点',Stay:'酒店',Meal:'餐饮',Other:'其他地点'};
  const category=p=>/meal|restaurant|餐饮|餐厅|food/i.test(p.type||'')?'Meal':/stay|hotel|酒店|住宿/i.test(p.type||'')?'Stay':/activity|landmark|attraction|景点|place/i.test(p.type||'')?'Activity':'Other';
  const url=p=>/^https?:\/\//i.test(p.map||'')?p.map:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name,p.address,p.region,p.city,p.country].filter(Boolean).join(', '))}`;
  const paths={plus:'<path d="M12 5v14M5 12h14"/>',photo:'<path d="M4 7h4l2-3h4l2 3h4v12H3V7z"/><circle cx="12" cy="13" r="3"/>',edit:'<path d="m14 4 6 6M4 20l5-1L20 8a2 2 0 0 0-4-4L5 15zM4 20h16"/>',pin:'<path d="M18 9c0 5-6 12-6 12S6 14 6 9a6 6 0 0 1 12 0z"/><circle cx="12" cy="9" r="2"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="4"/><path d="M8 3v4m8-4v4M4 10h16m-3 5h-6m3-3v6"/>',trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6"/>',back:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>'};
  const colors={plus:'#13b982',photo:'#4b83f6',edit:'#ab55ec',pin:'#ef7046',calendar:'#9762ff',trash:'#fa5a48',back:'#18beac'};
  const icon=(kind,label,attrs='')=>`<button type="button" class="library-icon" style="--library-accent:${colors[kind]}" aria-label="${safe(label)}" title="${safe(label)}" ${attrs}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg></button>`;
  const visible=p=>!p.libraryDeletedAt;
  window.OrbisSavedLibrary={category,visible};
  window.isSavedPlace=(name,city)=>savedPlaces.some(p=>p.key===savedKey(name,city)&&visible(p));
  const saveBase=window.savePlace;
  window.savePlace=place=>{const old=savedPlaces.find(p=>p.key===savedKey(place.name,place.city)&&!visible(p));if(old){delete old.libraryDeletedAt;Object.assign(old,place);persistSavedPlaces();renderSavedPlaces();}else saveBase(place);};
  const page=document.querySelector('#restaurants');
  page.innerHTML='<div class="library-head"><div><p class="eyebrow">SAVED PLACES · 收藏地点</p><h1>你的地点卡片库</h1><p>按类别、城市和区域整理，随时加入当天行程。</p></div>'+icon('plus','添加地点','id="library-add"')+'</div><div id="saved-place-list"></div>';
  const dialog=document.createElement('dialog');dialog.id='saved-library-dialog';document.body.append(dialog);
  function openForm(title,fields,submit){
    dialog.innerHTML=`<form class="library-form"><div class="library-dialog-head"><h2>${safe(title)}</h2><button type="button" class="library-close" aria-label="关闭地点表单">×</button></div>${fields}<div class="library-form-actions"><button type="button" class="library-cancel">取消</button><button type="submit">保存</button></div></form>`;
    dialog.querySelector('.library-close').onclick=dialog.querySelector('.library-cancel').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();submit(new FormData(e.target));};dialog.showModal();
  }
  const field=(label,name,value='',type='text',required=false)=>`<label>${safe(label)}<input name="${name}" type="${type}" value="${safe(value)}" ${required?'required':''}></label>`;
  function edit(place=null,type='Activity'){
    const p=place||{},kind=place?category(p):type;
    openForm(place?'修改收藏地点':'添加收藏地点',`${field('地点名称','name',p.name,'text',true)}<label>类别<select name="type">${Object.entries(categories).map(([key,label])=>`<option value="${key}" ${key===kind?'selected':''}>${label}</option>`).join('')}</select></label><div class="library-field-row">${field('城市','city',p.city)}${field('区域 / 地标分组','region',p.region)}</div>${field('国家 / 地区','country',p.country)}${field('地址','address',p.address)}${field('Google Maps 链接（可选）','map',p.map,'url')}${field('网站链接（可选）','website',p.website,'url')}<label>备注<textarea name="notes">${safe(p.notes||p.description||'')}</textarea></label>`,data=>{
      const values=Object.fromEntries([...data].map(([k,v])=>[k,String(v).trim()]));if(!values.name)return;
      const key=savedKey(values.name,values.city);
      if(savedPlaces.some(x=>x!==place&&x.key===key)){toast('这个地点已经在收藏中');return;}
      if(place){Object.assign(place,values,{key});persistSavedPlaces();renderSavedPlaces();}
      else savePlace({...values,savedAt:Date.now()});
      dialog.close();renderItinerary();toast('地点已保存');
    });
  }
  window.addSavedPlaceToDay=key=>{
    const p=savedPlaces.find(x=>x.key===key&&visible(x));if(!p)return;
    openForm('加入日程',`<p>${safe(p.name)}</p><label>选择日期<select name="day">${days.map((d,i)=>`<option value="${i}" ${i===selected?'selected':''}>Day ${i+1} · ${safe(d.iso||d.date)} · ${safe(d.city)}</option>`).join('')}</select></label>${field('计划时间','time','','time',true)}${category(p)==='Meal'?'<label>用餐安排<select name="mealSlot"><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="other">用餐 / 茶歇</option></select></label>':''}`,data=>{
      const day=days[+data.get('day')],time=String(data.get('time')),kind=category(p);if(!day||!time)return;
      const extra={place:p.name,city:p.city||'',country:p.country||'',region:p.region||'',address:p.address||'',map:p.map||'',website:p.website||'',photo:p.photo||'',savedPlaceKey:p.key};
      if(kind==='Meal')extra.mealSlot=String(data.get('mealSlot'));if(p.coordinates)extra.coordinates=p.coordinates;
      const item=[time,kind==='Other'?'Activity':kind,p.name,p.notes||p.description||'','—',extra];
      const at=day.items.findIndex(x=>x[0]>time);day.items.splice(at<0?day.items.length:at,0,item);persistTrip();renderItinerary();dialog.close();toast('已加入所选日期');
    });
  };
  window.renderSavedPlaces=()=>{
    const list=document.querySelector('#saved-place-list');if(!list)return;
    list.innerHTML=Object.entries(categories).map(([kind,label])=>{
      const places=savedPlaces.filter(p=>visible(p)&&category(p)===kind);if(kind==='Other'&&!places.length)return '';
      const groups=new Map();for(const p of places){const group=[p.country,p.city,p.region].filter(Boolean).join(' · ')||'区域待填写';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(p);}
      return `<section class="library-category" data-library-kind="${kind}"><header><h2>${label}<small>${places.length}</small></h2>${icon('plus','添加'+label,`data-library-new="${kind}"`)}</header>${[...groups].map(([group,items])=>`<section class="library-region"><h3>${safe(group)}</h3><div class="library-grid">${items.map(p=>`<article class="library-card">${/^https?:\/\/|^data:image\//i.test(p.photo||'')?`<img src="${safe(p.photo)}" alt="" loading="lazy">`:''}<h4>${safe(p.name)}</h4>${p.zh?`<p>${safe(p.zh)}</p>`:''}${p.address?`<p>${safe(p.address)}</p>`:''}${p.notes||p.description?`<details><summary>备注</summary><p>${safe(p.notes||p.description)}</p></details>`:''}<div class="library-card-actions"><a class="library-icon" style="--library-accent:#ef7046" href="${safe(url(p))}" target="_blank" rel="noreferrer" aria-label="导航" title="导航"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.pin}</svg></a>${icon('photo',p.photo?'更换图片':'添加图片',`data-library-photo="${safe(p.key)}"`)}${icon('edit','修改地点',`data-library-edit="${safe(p.key)}"`)}${icon('calendar','加入日程',`data-saved-add="${safe(p.key)}"`)}${icon('trash','删除地点',`data-library-delete="${safe(p.key)}"`)}</div></article>`).join('')}</div></section>`).join('')||'<p class="library-empty">还没有地点，点击上方添加。</p>'}</section>`;
    }).join('');
    const deleted=savedPlaces.filter(p=>!visible(p));
    if(deleted.length)list.insertAdjacentHTML('beforeend',`<details class="library-trash"><summary>已删除 · ${deleted.length}</summary>${deleted.map(p=>`<div><span>${safe(p.name)}</span>${icon('back','恢复 '+p.name,`data-library-restore="${safe(p.key)}"`)}</div>`).join('')}</details>`);
    list.querySelectorAll('[data-library-delete]').forEach(b=>b.onclick=()=>{const p=savedPlaces.find(p=>p.key===b.dataset.libraryDelete&&visible(p));if(!p)return;p.libraryDeletedAt=Date.now();persistSavedPlaces();renderSavedPlaces();renderItinerary();toast('已删除，可在底部恢复');});
    list.querySelectorAll('[data-library-restore]').forEach(b=>b.onclick=()=>{const p=savedPlaces.find(p=>p.key===b.dataset.libraryRestore&&!visible(p));if(!p)return;delete p.libraryDeletedAt;persistSavedPlaces();renderSavedPlaces();renderItinerary();toast('地点已恢复');});
    list.querySelectorAll('[data-library-photo]').forEach(b=>b.onclick=()=>{photoTarget=savedPlaces.find(p=>p.key===b.dataset.libraryPhoto&&visible(p));photoInput.value='';photoInput.click();});
    list.querySelectorAll('[data-library-new]').forEach(b=>b.onclick=()=>edit(null,b.dataset.libraryNew));
    list.querySelectorAll('[data-library-edit]').forEach(b=>b.onclick=()=>edit(savedPlaces.find(p=>p.key===b.dataset.libraryEdit)));
    list.querySelectorAll('[data-saved-add]').forEach(b=>b.onclick=()=>addSavedPlaceToDay(b.dataset.savedAdd));
  };
  let photoTarget;
  const photoInput=document.createElement('input');photoInput.type='file';photoInput.accept='image/*';photoInput.hidden=true;document.body.append(photoInput);
  photoInput.onchange=async()=>{
    const file=photoInput.files?.[0],p=photoTarget;if(!file||!p)return;
    const previous=p.photo;
    try{
      const photo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{try{const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.82));}catch(error){reject(error)}};image.src=reader.result;};reader.readAsDataURL(file);});
      p.photo=photo;persistSavedPlaces();renderSavedPlaces();renderItinerary();toast('图片已保存');
    }catch{p.photo=previous;toast('图片未保存，请选择较小的 JPG 或 PNG 图片');}
    photoInput.value='';
  };
  document.querySelector('#library-add').onclick=()=>edit();
  const search=document.querySelector('#open-search');if(search){search.onclick=()=>edit();search.setAttribute('aria-label','添加收藏地点');search.innerHTML=icon('plus','添加收藏地点').replace(/^<button[^>]*>/,'').replace(/<\/button>$/,'');search.classList.add('library-icon');search.style.setProperty('--library-accent',colors.plus);}
  const old=document.querySelector('#search-dialog');if(old){old.close();old.remove();}
  renderSavedPlaces();
})();
