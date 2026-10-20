/* Manual place library: preserve existing records and use explicit map links. */
(() => {
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaults={Activity:{label:'景点',color:'#a175e7',baseType:'Activity'},Stay:{label:'酒店',color:'#60b69d',baseType:'Stay'},Meal:{label:'餐饮',color:'#ff9e4a',baseType:'Meal'},Shop:{label:'商铺',color:'#e5ad56',baseType:'Shop'},Other:{label:'其他地点',color:'#91a6bc',baseType:'Activity'}};
  const definitions=()=>Object.fromEntries(savedPlaces.filter(p=>p.libraryCategoryDefinition).map(p=>[p.categoryId,{label:p.name,color:p.color,baseType:p.baseType||'Activity'}]));
  const specs=()=>{const custom=definitions(),all={...defaults,...custom};if(Object.entries(custom).some(([id,value])=>id!=='Shop'&&value.label==='商铺'))delete all.Shop;return all;};
  const categories=()=>Object.fromEntries(Object.entries(specs()).map(([id,spec])=>[id,spec.label]));
  const spec=id=>specs()[id]||defaults.Other;
  const category=p=>p.libraryCategory||(/shop|store|shopping|商铺|商店|购物/i.test(p.type||'')?'Shop':/meal|restaurant|餐饮|餐厅|food/i.test(p.type||'')?'Meal':/stay|hotel|酒店|住宿/i.test(p.type||'')?'Stay':/activity|landmark|attraction|景点|place/i.test(p.type||'')?'Activity':'Other');
  const url=p=>/^https?:\/\//i.test(p.map||'')?p.map:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name,p.address,p.region,p.city,p.country].filter(Boolean).join(', '))}`;
  const paths={previous:'<path d="m15 5-7 7 7 7"/>',next:'<path d="m9 5 7 7-7 7"/>',placeAdd:'<path d="M14 9c0 4-5 10-5 10S4 13 4 9a5 5 0 0 1 10 0z"/><circle cx="9" cy="9" r="1.6"/><path d="M18 3v6m-3-3h6"/>',categoryAdd:'<path d="M3 8V5a1 1 0 0 1 1-1h5l3 4h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z"/><path d="M12 11v6m-3-3h6"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',palette:'<circle cx="12" cy="12" r="9"/><circle cx="8" cy="8" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="17" cy="13" r="1"/><path d="M4 15h5l3 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',photo:'<path d="M4 7h4l2-3h4l2 3h4v12H3V7z"/><circle cx="12" cy="13" r="3"/>',edit:'<path d="m14 4 6 6M4 20l5-1L20 8a2 2 0 0 0-4-4L5 15zM4 20h16"/>',pin:'<path d="M18 9c0 5-6 12-6 12S6 14 6 9a6 6 0 0 1 12 0z"/><circle cx="12" cy="9" r="2"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="4"/><path d="M8 3v4m8-4v4M4 10h16m-3 5h-6m3-3v6"/>',trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6"/>',back:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>'};
  const colors={previous:'#7e79ad',next:'#7e79ad',placeAdd:'#13b982',categoryAdd:'#ab55ec',more:'#7e79ad',palette:'#ab55ec',plus:'#13b982',photo:'#4b83f6',edit:'#ab55ec',pin:'#ef7046',calendar:'#9762ff',trash:'#fa5a48',back:'#18beac'};
  const icon=(kind,label,attrs='')=>`<button type="button" class="library-icon" style="--library-accent:${colors[kind]}" aria-label="${safe(label)}" title="${safe(label)}" ${attrs}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg></button>`;
  const ratingOf=p=>Number.isInteger(Number(p.rating))&&Number(p.rating)>=1&&Number(p.rating)<=5?Number(p.rating):0;
  const stars=p=>`<div class="library-stars" role="group" aria-label="${safe(p.name)}的评分，满分5星">${[1,2,3,4,5].map(n=>`<button type="button" class="library-star ${n<=ratingOf(p)?'is-lit':''}" data-library-rate="${safe(p.key)}" data-stars="${n}" aria-label="评${n}星" aria-pressed="${n===ratingOf(p)}" title="${n}星，再次点击可取消评分"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.55 4.43 1.08 6.27L12 17.34l-5.63 2.96 1.08-6.27L2.9 9.6l6.3-.9z"/></svg></button>`).join('')}</div>`;
  const visible=p=>!p.libraryDeletedAt&&!p.libraryCategoryDefinition;
  function itineraryCategory(item,day){
    const type=String(item[1]||''),extra=item[5]||{};
    const linked=savedPlaces.find(p=>visible(p)&&(p.key===extra.savedPlaceKey||p.key===savedKey(item[2],extra.city||day.city)));
    // A saved category may decorate a stop only while its behaviour matches
    // the stop's explicit type; old meal metadata must never relabel transport.
    const candidates=[extra.libraryCategory,linked?category(linked):null,type];
    return candidates.find(id=>id&&specs()[id]?.baseType===type)||null;
  }
  window.OrbisSavedLibrary={category,visible,itineraryCategory,specs,baseType:p=>spec(category(p)).baseType,decorateItinerary};
  window.isSavedPlace=(name,city)=>savedPlaces.some(p=>p.key===savedKey(name,city)&&visible(p));
  const saveBase=window.savePlace;
  window.savePlace=place=>{const old=savedPlaces.find(p=>p.key===savedKey(place.name,place.city)&&p.libraryDeletedAt);if(old){delete old.libraryDeletedAt;Object.assign(old,place);persistSavedPlaces();renderSavedPlaces();}else saveBase(place);};
  const page=document.querySelector('#restaurants');
  page.innerHTML='<div class="library-head"><div><p class="eyebrow">SAVED PLACES · 收藏地点</p><h1>你的地点卡片库</h1><p>按类别和城市归纳，左右翻阅地点卡片。</p></div><div class="library-head-actions">'+icon('placeAdd','添加地点','id="library-add"')+icon('categoryAdd','添加新分类','id="library-add-category"')+'</div></div><div id="saved-place-list"></div>';
  const dialog=document.createElement('dialog');dialog.id='saved-library-dialog';document.body.append(dialog);
  function updateLibraryViewport(){const view=window.visualViewport;if(!view)return;dialog.style.maxHeight=Math.max(120,view.height-24)+'px';dialog.style.setProperty('--library-top',(view.offsetTop+12)+'px');}
  window.visualViewport?.addEventListener('resize',()=>{if(dialog.open)updateLibraryViewport()});window.visualViewport?.addEventListener('scroll',()=>{if(dialog.open)updateLibraryViewport()});
  function openForm(title,fields,submit){
    dialog.innerHTML=`<form class="library-form" novalidate><div class="library-dialog-head"><h2>${safe(title)}</h2><button type="button" class="library-close" aria-label="关闭地点表单">×</button></div>${fields}<p class="library-form-status" role="status" aria-live="polite"></p><div class="library-form-actions"><button type="button" class="library-cancel">取消</button><button type="submit">保存</button></div></form>`;
    dialog.querySelector('.library-close').onclick=dialog.querySelector('.library-cancel').onclick=()=>dialog.close();
    const form=dialog.querySelector('form'),status=form.querySelector('.library-form-status'),button=form.querySelector('[type="submit"]');
    form.onsubmit=async e=>{
      e.preventDefault();status.textContent='';
      const missing=[...form.querySelectorAll('[required]')].find(input=>!input.value.trim());if(missing){status.textContent='请填写'+(missing.closest('label')?.firstChild.textContent||'必填资料');missing.focus();return;}
      if(!form.checkValidity()){form.reportValidity();status.textContent='请检查日期、时间或必填资料。';return;}
      button.disabled=true;
      try{await submit(new FormData(form))}catch(error){status.textContent=error.message||'保存未完成，请重试。';if(error.resolveDuplicate){const action=document.createElement('button');action.type='button';action.textContent='将这些修改保存到已有卡片';action.onclick=()=>{error.resolveDuplicate();form.requestSubmit();};status.append(document.createElement('br'),action);}status.scrollIntoView({block:'nearest'});}finally{button.disabled=false;}
    };dialog.showModal();
    updateLibraryViewport();
  }
  const field=(label,name,value='',type='text',required=false)=>`<label>${safe(label)}<input name="${name}" type="${type==='url'?'text':type}" ${type==='url'?'inputmode="url" autocapitalize="off" spellcheck="false"':''} value="${safe(value)}" ${required?'required':''}></label>`;
  function normalLink(value,label){
    const raw=String(value||'').trim();if(!raw)return '';
    const found=raw.match(/https?:\/\/[^\s<>]+/i),candidate=found?found[0]:raw;
    try{const parsed=new URL(/^https?:\/\//i.test(candidate)?candidate:'https://'+candidate);if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname.includes('.'))throw new Error();return parsed.href;}catch{throw new Error(label+'无法识别，请粘贴网址，例如 www.example.com；也可以留空。')}
  }
  function edit(place=null,type='Activity'){
    const p=place||{},kind=place?category(p):type,owner=window.TabiWorkspace.state.currentUserId,tripId=window.TabiWorkspace.state.currentTripId;let lookupData=null,mergingDuplicate=false;
    openForm(place?'修改收藏地点':'添加收藏地点',`<div class="library-name-row">${field('地点名称','name',p.name,'text',true)}<button type="button" id="library-lookup" aria-label="按名称查找地点资料">查资料</button></div><p id="library-lookup-status" role="status"></p><div id="library-lookup-results"></div><label>类别<select name="libraryCategory">${Object.entries(categories()).map(([key,label])=>`<option value="${key}" ${key===kind?'selected':''}>${label}</option>`).join('')}</select></label><div class="library-field-row">${field('城市','city',p.city)}${field('区域 / 地标','region',p.region)}</div>${field('国家 / 地区','country',p.country)}${field('地址','address',p.address)}${field('Google Maps 链接（可选）','map',p.map,'url')}${field('网站链接（可选）','website',p.website,'url')}<label>备注<textarea name="notes">${safe(p.notes||p.description||'')}</textarea></label>`,async data=>{
      if(window.TabiWorkspace.state.currentUserId!==owner||window.TabiWorkspace.state.currentTripId!==tripId)throw new Error('账号或行程已切换，请重新打开地点表单。');
      const target=place?(savedPlaces.includes(place)?place:savedPlaces.find(x=>x.key===place.key&&x.savedAt===place.savedAt)):null;if(place&&!target)throw new Error('这个收藏地点已变化，请重新打开。');
      const values=Object.fromEntries([...data].map(([k,v])=>[k,String(v).trim()]));if(!values.name)return;
      if(mergingDuplicate&&target)for(const field of ['region','country','address','map','website','notes'])if(!values[field])values[field]=String(target[field]||(field==='notes'?target.description:'')||'');
      values.map=normalLink(values.map,'Google Maps 链接');values.website=normalLink(values.website,'网站链接');
      if(lookupData){values.lookupSource=lookupData.lookupSource;values.zh=lookupData.zh;if(!target?.photo&&lookupData.photo){values.photo=lookupData.photo;values.photoSource=lookupData.photoSource;values.photoCredit=lookupData.photoCredit;}}
      values.type=spec(values.libraryCategory).baseType;
      const key=savedKey(values.name,values.city);
      const duplicate=savedPlaces.find(x=>visible(x)&&x!==target&&x.key===key&&(!target||key!==target.key));
      if(duplicate){
        const error=new Error('已有同名、同城市的卡片。你可以把当前填写的资料保存到那张卡片，原有图片和评分会保留。');
        error.resolveDuplicate=()=>{place=duplicate;mergingDuplicate=true;};throw error;
      }
      if(target)Object.assign(target,values,{key});else savedPlaces.unshift({...values,key,savedAt:Date.now()});
      if(persistSavedPlaces()===false)throw new Error('本机保存未完成，请先备份当前资料，暂不要刷新。');
      await window.TabiWorkspace.flush?.();renderSavedPlaces();
      dialog.close();renderItinerary();toast('地点已保存');
    });
    const form=dialog.querySelector('form'),lookup=form.querySelector('#library-lookup'),status=form.querySelector('#library-lookup-status'),results=form.querySelector('#library-lookup-results');
    lookup.onclick=async()=>{
      const name=form.elements.name.value.trim();if(!name){status.textContent='先输入地点名称。';form.elements.name.focus();return;}
      lookup.disabled=true;status.textContent='正在查公开资料与真实图片…';results.replaceChildren();
      try{
        const places=await window.OrbisCloud.lookup(name);if(!dialog.open||!form.isConnected||form.elements.name.value.trim()!==name)return;
        status.textContent=places.length?'请核对地点，点「使用资料」填入空白字段。没有可靠来源的字段会留空。':'没有找到可靠资料，可以继续手动保存；部分餐厅和小店不在公开资料库中。';
        results.innerHTML=places.map((candidate,index)=>`<article class="library-lookup-choice">${candidate.photo?`<img src="${safe(candidate.photo)}" alt="" loading="lazy">`:''}<div><b>${safe(candidate.name)}</b><p>${safe([candidate.country,candidate.region].filter(Boolean).join(' · '))}</p><p>${safe(candidate.notes)}</p><a href="${safe(candidate.lookupSource)}" target="_blank" rel="noreferrer">资料来源 ↗</a>${candidate.photoSource?`<a href="${safe(candidate.photoSource)}" target="_blank" rel="noreferrer">照片来源 · ${safe(candidate.photoCredit)}</a>`:''}<button type="button" data-lookup-use="${index}">使用资料</button></div></article>`).join('');
        results.querySelectorAll('[data-lookup-use]').forEach(button=>button.onclick=()=>{
          lookupData=places[Number(button.dataset.lookupUse)];for(const key of ['country','region','address','website','map'])if(!form.elements[key].value.trim()&&lookupData[key])form.elements[key].value=lookupData[key];
          if(!form.elements.notes.value.trim())form.elements.notes.value=[lookupData.notes,'资料来源：'+lookupData.lookupSource].filter(Boolean).join('\n');
          status.textContent='资料已填入。请检查后点保存；已有资料与图片会保留。';results.replaceChildren();
          if(lookupData.photo&&!p.photo)results.innerHTML=`<img class="library-lookup-preview" src="${safe(lookupData.photo)}" alt="地点照片预览"><a href="${safe(lookupData.photoSource)}" target="_blank" rel="noreferrer">${safe(lookupData.photoCredit)} · 照片来源 ↗</a>`;
        });
      }catch(error){if(form.isConnected&&dialog.open)status.textContent=error.message||'资料查询暂不可用，可以继续手动保存。';}finally{lookup.disabled=false;}
    };
    form.elements.name.addEventListener('input',()=>{lookupData=null;results.replaceChildren();});
  }
  window.addSavedPlaceToDay=key=>{
    const p=savedPlaces.find(x=>x.key===key&&visible(x));if(!p)return;
    openForm('加入日程',`<p>${safe(p.name)}</p><label>选择日期<select name="day">${days.map((d,i)=>`<option value="${i}" ${i===selected?'selected':''}>Day ${i+1} · ${safe(d.iso||d.date)} · ${safe(d.city)}</option>`).join('')}</select></label>${field('计划时间','time','','time',true)}${spec(category(p)).baseType==='Meal'?'<label>用餐安排<select name="mealSlot"><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="other">用餐 / 茶歇</option></select></label>':''}`,data=>{
      const day=days[+data.get('day')],time=String(data.get('time')),kind=spec(category(p)).baseType;if(!day||!time)return;
      const extra={place:p.name,city:p.city||'',country:p.country||'',region:p.region||'',address:p.address||'',map:p.map||'',website:p.website||'',photo:p.photo||'',savedPlaceKey:p.key,libraryCategory:category(p),photoSource:p.photoSource||'',photoCredit:p.photoCredit||'',lookupSource:p.lookupSource||''};
      if(kind==='Meal')extra.mealSlot=String(data.get('mealSlot'));if(p.coordinates)extra.coordinates=p.coordinates;
      const item=[time,kind==='Other'?'Activity':kind,p.name,p.notes||p.description||'','—',extra];
      const at=day.items.findIndex(x=>x[0]>time);day.items.splice(at<0?day.items.length:at,0,item);persistTrip();renderItinerary();dialog.close();toast('已加入所选日期');
    });
  };
  let railCleanup=()=>{};
  function bindLibraryRails(list,positions){
    const cleanups=[];
    list.querySelectorAll('.library-region').forEach(region=>{
      const rail=region.querySelector('.library-grid'),cards=[...rail.children],previous=region.querySelector('[data-library-previous]'),next=region.querySelector('[data-library-next]'),counter=region.querySelector('.library-page-count');
      let timer,frame,last=-1;
      const offsets=()=>cards.map(card=>card.offsetLeft-2);
      function update(animate=false){
        const starts=offsets(),max=Math.max(0,rail.scrollWidth-rail.clientWidth),left=rail.scrollLeft;
        const first=Math.max(0,starts.findIndex((start,i)=>start+cards[i].offsetWidth>left+8));
        let end=first;while(end+1<cards.length&&starts[end+1]+cards[end+1].offsetWidth<=left+rail.clientWidth+8)end++;
        counter.textContent=first===end?`${first+1} / ${cards.length}`:`${first+1}–${end+1} / ${cards.length}`;
        previous.disabled=left<=2;next.disabled=left>=max-2;
        if(animate&&first!==last&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
          cards[first].classList.remove('is-page-turn');void cards[first].offsetWidth;cards[first].classList.add('is-page-turn');
        }
        if(animate||last<0)last=first;
      }
      function move(direction){
        const starts=offsets(),left=rail.scrollLeft;
        const target=direction>0?starts.find(start=>start>left+8):starts.filter(start=>start<left-8).pop();
        rail.scrollTo({left:target??(direction>0?rail.scrollWidth:0),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      }
      previous.onclick=()=>move(-1);next.onclick=()=>move(1);
      rail.onkeydown=e=>{if(e.target!==rail||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();if(e.key==='Home'||e.key==='End')rail.scrollTo({left:e.key==='Home'?0:rail.scrollWidth,behavior:'auto'});else move(e.key==='ArrowRight'?1:-1);};
      rail.onscroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>update());clearTimeout(timer);timer=setTimeout(()=>update(true),130);};
      cards.forEach(card=>card.onanimationend=()=>card.classList.remove('is-page-turn'));
      const position=positions.get(region.dataset.libraryRail);
      if(position){const card=cards.find(card=>card.dataset.libraryKey===position.key);rail.scrollLeft=card?card.offsetLeft-2:position.left;}
      const observer=new ResizeObserver(()=>update());observer.observe(rail);update();
      cleanups.push(()=>{observer.disconnect();clearTimeout(timer);cancelAnimationFrame(frame);});
    });
    railCleanup=()=>cleanups.forEach(clean=>clean());
  }
  const categoryViews=new Map();
  function categoryView(){
    const state=window.TabiWorkspace?.state,key='orbis-library-sections:'+JSON.stringify([state?.currentUserId||'',state?.currentTripId||'']);
    if(!categoryViews.has(key)){let value={};try{const stored=JSON.parse(localStorage.getItem(key)||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))value=stored;}catch{}categoryViews.set(key,value);}
    return {key,value:categoryViews.get(key)};
  }
  window.renderSavedPlaces=()=>{
    const list=document.querySelector('#saved-place-list');if(!list)return;
    const positions=new Map([...list.querySelectorAll('.library-region')].map(region=>{const rail=region.querySelector('.library-grid');const card=[...rail.children].find(card=>card.offsetLeft-2+card.offsetWidth>rail.scrollLeft+8);return [region.dataset.libraryRail,{key:card?.dataset.libraryKey,left:rail.scrollLeft}];}));
    railCleanup();
    const view=categoryView();
    list.innerHTML=Object.entries(categories()).map(([kind,label],categoryIndex)=>{
      const places=savedPlaces.filter(p=>visible(p)&&category(p)===kind);if(kind==='Other'&&!places.length)return '';
      const groups=new Map();for(const p of places){const group=[p.country,p.city].map(value=>String(value||'').trim()).filter(Boolean).join(' · ')||'城市待填写';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(p);}
      return `<section class="library-category" data-library-kind="${safe(kind)}" style="--library-color:${safe(spec(kind).color)}"><header><h2><button type="button" class="library-category-toggle" data-library-fold="${safe(kind)}" aria-expanded="${view.value[kind]===true}" aria-controls="library-category-body-${categoryIndex}" aria-label="${view.value[kind]===true?'收起':'展开'}${safe(label)}，${places.length}个地点"><span>${safe(label)}</span><small>${places.length}</small><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></h2><div class="library-category-actions">${icon('palette','修改分类 '+label,`data-library-category-edit="${safe(kind)}"`)}${icon('plus','添加'+label,`data-library-new="${safe(kind)}"`)}</div></header><div class="library-category-body" id="library-category-body-${categoryIndex}" ${view.value[kind]===true?'':'hidden inert'}>${[...groups].map(([group,items])=>`<section class="library-region" data-library-rail="${safe(JSON.stringify([kind,group]))}"><div class="library-region-head"><h3>${safe(group)}</h3><div class="library-paging">${icon('previous','上一张地点卡片','data-library-previous')}<span class="library-page-count" aria-label="卡片位置"></span>${icon('next','下一张地点卡片','data-library-next')}</div></div><div class="library-grid" tabindex="0" role="region" aria-label="${safe(label+' · '+group)}，左右翻阅地点卡片">${items.map(p=>`<article class="library-card" data-library-key="${safe(p.key)}">${/^https?:\/\/|^data:image\//i.test(p.photo||'')?`<img src="${safe(p.photo)}" alt="" loading="lazy">`:''}${p.photo&&/^https:\/\//i.test(p.photoSource||'')?`<a class="library-photo-credit" href="${safe(p.photoSource)}" target="_blank" rel="noreferrer">${safe(p.photoCredit||'照片来源')} ↗</a>`:''}<h4>${safe(p.name)}</h4>${p.region?`<p class="library-card-region">${safe(p.region)}</p>`:''}${p.zh?`<p>${safe(p.zh)}</p>`:''}${p.address?`<p>${safe(p.address)}</p>`:''}${stars(p)}${p.notes||p.description?`<details><summary>备注</summary><p>${safe(p.notes||p.description)}</p></details>`:''}<div class="library-card-tools">${icon('more','展开地点操作','data-library-toggle aria-expanded="false"')}<div class="library-card-actions" hidden inert><a class="library-icon" style="--library-accent:#ef7046" href="${safe(url(p))}" target="_blank" rel="noreferrer" aria-label="导航" title="导航"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.pin}</svg></a>${icon('photo',p.photo?'更换图片':'添加图片',`data-library-photo="${safe(p.key)}"`)}${icon('edit','修改地点',`data-library-edit="${safe(p.key)}"`)}${icon('calendar','加入日程',`data-saved-add="${safe(p.key)}"`)}${icon('trash','删除地点',`data-library-delete="${safe(p.key)}"`)}</div></div></article>`).join('')}</div></section>`).join('')||'<p class="library-empty">还没有地点，点击上方添加。</p>'}</div></section>`;
    }).join('');
    list.querySelectorAll('[data-library-fold]').forEach(button=>button.onclick=()=>{
      const open=button.getAttribute('aria-expanded')!=='true',body=document.getElementById(button.getAttribute('aria-controls'));
      button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',`${open?'收起':'展开'}${categories()[button.dataset.libraryFold]}，${button.querySelector('small').textContent}个地点`);
      body.hidden=!open;body.inert=!open;view.value[button.dataset.libraryFold]=open;
      try{localStorage.setItem(view.key,JSON.stringify(view.value));}catch{}
    });
    bindLibraryRails(list,positions);
    const deleted=savedPlaces.filter(p=>p.libraryDeletedAt);
    if(deleted.length)list.insertAdjacentHTML('beforeend',`<details class="library-trash"><summary>已删除 · ${deleted.length}</summary>${deleted.map(p=>`<div><span>${safe(p.name)}</span>${icon('back','恢复 '+p.name,`data-library-restore="${safe(p.key)}"`)}${icon('trash','彻底删除 '+p.name,`data-library-purge="${safe(p.key)}"`)}</div>`).join('')}</details>`);
    list.querySelectorAll('[data-library-rate]').forEach(b=>b.onclick=()=>{
      const p=savedPlaces.find(p=>p.key===b.dataset.libraryRate&&visible(p));if(!p)return;
      const previous=p.rating,n=Number(b.dataset.stars);p.rating=ratingOf(p)===n?'':String(n);
      if(persistSavedPlaces()===false){if(previous===undefined)delete p.rating;else p.rating=previous;persistSavedPlaces();toast('评分未保存，请检查本机空间');return;}
      b.parentElement.querySelectorAll('[data-library-rate]').forEach(star=>{const value=Number(star.dataset.stars);star.classList.toggle('is-lit',value<=ratingOf(p));star.setAttribute('aria-pressed',String(value===ratingOf(p)));});
      toast(p.rating?`已评 ${p.rating} 星`:'已取消评分');
    });
    list.querySelectorAll('[data-library-toggle]').forEach(b=>b.onclick=()=>{const panel=b.nextElementSibling,open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'收起地点操作':'展开地点操作');panel.hidden=!open;panel.inert=!open;b.parentElement.classList.toggle('is-open',open);});
    list.querySelectorAll('[data-library-category-edit]').forEach(b=>b.onclick=()=>editCategory(b.dataset.libraryCategoryEdit));
    list.querySelectorAll('[data-library-delete]').forEach(b=>b.onclick=()=>{const p=savedPlaces.find(p=>p.key===b.dataset.libraryDelete&&visible(p));if(!p)return;p.libraryDeletedAt=Date.now();persistSavedPlaces();renderSavedPlaces();renderItinerary();toast('已删除，可在底部恢复');});
    list.querySelectorAll('[data-library-purge]').forEach(b=>b.onclick=()=>{
      const p=savedPlaces.find(p=>p.key===b.dataset.libraryPurge&&p.libraryDeletedAt);if(!p)return;
      if(!confirm(`彻底删除「${p.name}」？收藏卡片及图片将从卡片库移除，无法通过已删除列表恢复。已加入行程的地点保留。`))return;
      const index=savedPlaces.indexOf(p);savedPlaces.splice(index,1);
      if(persistSavedPlaces()===false){savedPlaces.splice(index,0,p);persistSavedPlaces();toast('保存未完成，卡片未彻底删除');return;}
      renderSavedPlaces();renderItinerary();toast('收藏卡片已彻底删除');
    });
    list.querySelectorAll('[data-library-restore]').forEach(b=>b.onclick=()=>{const p=savedPlaces.find(p=>p.key===b.dataset.libraryRestore&&p.libraryDeletedAt);if(!p)return;delete p.libraryDeletedAt;persistSavedPlaces();renderSavedPlaces();renderItinerary();toast('地点已恢复');});
    list.querySelectorAll('[data-library-photo]').forEach(b=>b.onclick=()=>{if(photoBusy){toast('图片正在处理，请稍候');return;}photoTarget=savedPlaces.find(p=>p.key===b.dataset.libraryPhoto&&visible(p));photoInput.value='';photoInput.click();});
    list.querySelectorAll('[data-library-new]').forEach(b=>b.onclick=()=>edit(null,b.dataset.libraryNew));
    list.querySelectorAll('[data-library-edit]').forEach(b=>b.onclick=()=>edit(savedPlaces.find(p=>p.key===b.dataset.libraryEdit)));
    list.querySelectorAll('[data-saved-add]').forEach(b=>b.onclick=()=>addSavedPlaceToDay(b.dataset.savedAdd));
  };
  function editCategory(id=null){
    const current=id?spec(id):{label:'',color:'#a175e7',baseType:'Activity'};
    openForm(id?'修改分类':'添加分类',`${field('分类名称','label',current.label,'text',true)}${field('分类颜色','color',current.color,'color')}<label>用于行程<select name="baseType"><option value="Activity" ${current.baseType==='Activity'?'selected':''}>普通地点</option><option value="Shop" ${current.baseType==='Shop'?'selected':''}>商铺</option><option value="Meal" ${current.baseType==='Meal'?'selected':''}>餐饮（早餐 / 午餐 / 晚餐）</option><option value="Stay" ${current.baseType==='Stay'?'selected':''}>住宿</option></select></label>`,data=>{
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
      const media=item[5]||{},image=card.querySelector('.place-photo img');if(image&&/^https:\/\//i.test(media.photoSource||'')&&!card.querySelector('.place-photo-credit')){const credit=document.createElement('a');credit.className='place-photo-credit';credit.href=media.photoSource;credit.target='_blank';credit.rel='noreferrer';credit.textContent=(media.photoCredit||'照片来源')+' ↗';image.after(credit);}
      const id=itineraryCategory(item,day);
      if(!id){
        delete card.dataset.libraryCategory;card.style.removeProperty('--category-rgb');card.style.removeProperty('--category-ink');card.dataset.stopKind=String(item[1]||'').toLowerCase();
        const tag=card.querySelector('.item-type');if(tag)tag.textContent=({Transport:'交通',Activity:'景点',Shop:'商铺',Meal:'餐饮',Stay:'酒店','Free time':'自由安排'})[item[1]]||String(item[1]||'');
        return;
      }
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
      delete p.photoSource;delete p.photoCredit;persistSavedPlaces();await window.TabiWorkspace?.flush?.();renderSavedPlaces();renderItinerary();toast('图片已保存');
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
