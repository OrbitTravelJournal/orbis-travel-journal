/* Manual place library: preserve existing records and use explicit map links. */
(() => {
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categories={Activity:'景点',Stay:'酒店',Meal:'餐饮',Other:'其他地点'};
  const category=p=>/meal|restaurant|餐饮|餐厅|food/i.test(p.type||'')?'Meal':/stay|hotel|酒店|住宿/i.test(p.type||'')?'Stay':/activity|landmark|attraction|景点|place/i.test(p.type||'')?'Activity':'Other';
  const url=p=>/^https?:\/\//i.test(p.map||'')?p.map:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name,p.address,p.region,p.city,p.country].filter(Boolean).join(', '))}`;
  window.OrbisSavedLibrary={category};
  const page=document.querySelector('#restaurants');
  page.innerHTML='<div class="library-head"><div><p class="eyebrow">SAVED PLACES · 收藏地点</p><h1>你的地点卡片库</h1><p>按类别、城市和区域整理，随时加入当天行程。</p></div><button type="button" id="library-add">＋ 添加地点</button></div><div id="saved-place-list"></div>';
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
    const p=savedPlaces.find(x=>x.key===key);if(!p)return;
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
      const places=savedPlaces.filter(p=>category(p)===kind);if(kind==='Other'&&!places.length)return '';
      const groups=new Map();for(const p of places){const group=[p.country,p.city,p.region].filter(Boolean).join(' · ')||'区域待填写';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(p);}
      return `<section class="library-category" data-library-kind="${kind}"><header><h2>${label}<small>${places.length}</small></h2><button type="button" data-library-new="${kind}">＋ 添加${label}</button></header>${[...groups].map(([group,items])=>`<section class="library-region"><h3>${safe(group)}</h3><div class="library-grid">${items.map(p=>`<article class="library-card">${/^https?:\/\/|^data:image\//i.test(p.photo||'')?`<img src="${safe(p.photo)}" alt="" loading="lazy">`:''}<h4>${safe(p.name)}</h4>${p.zh?`<p>${safe(p.zh)}</p>`:''}${p.address?`<p>${safe(p.address)}</p>`:''}${p.notes||p.description?`<details><summary>备注</summary><p>${safe(p.notes||p.description)}</p></details>`:''}<div class="library-card-actions"><a href="${safe(url(p))}" target="_blank" rel="noreferrer">导航 ↗</a><button type="button" data-library-edit="${safe(p.key)}">修改</button><button type="button" data-saved-add="${safe(p.key)}">加入日程</button></div></article>`).join('')}</div></section>`).join('')||'<p class="library-empty">还没有地点，点击上方添加。</p>'}</section>`;
    }).join('');
    list.querySelectorAll('[data-library-new]').forEach(b=>b.onclick=()=>edit(null,b.dataset.libraryNew));
    list.querySelectorAll('[data-library-edit]').forEach(b=>b.onclick=()=>edit(savedPlaces.find(p=>p.key===b.dataset.libraryEdit)));
    list.querySelectorAll('[data-saved-add]').forEach(b=>b.onclick=()=>addSavedPlaceToDay(b.dataset.savedAdd));
  };
  document.querySelector('#library-add').onclick=()=>edit();
  const search=document.querySelector('#open-search');if(search){search.onclick=()=>edit();search.setAttribute('aria-label','添加收藏地点');search.textContent='＋ 添加地点';}
  const old=document.querySelector('#search-dialog');if(old){old.close();old.remove();}
  renderSavedPlaces();
})();
