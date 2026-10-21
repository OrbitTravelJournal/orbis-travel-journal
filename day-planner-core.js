/* Free Google Maps links and transport presentation, shared with tests. */
(() => {
  const point=v=>window.OrbisRouteOrder.coordinate(v);
  function stop(item,day){
    const e=item[5]||{},saved=typeof savedPlaces!=='undefined'?savedPlaces.find(p=>p.key===e.savedPlaceKey):null;
    const coordinates=point(e.routeCoordinates||e.coordinates||saved?.coordinates)||window.OrbisRouteOrder.fromMap(e.map||saved?.map);
    const map=e.map||saved?.map||'';let mapQuery='',placeId=e.googlePlaceId||saved?.googlePlaceId||'',shortLink=false;
    try{const u=new URL(map);if(/(^|\.)google\.(com|co\.jp|com\.au)$/.test(u.hostname)){mapQuery=u.searchParams.get('query')||u.searchParams.get('q')||'';placeId ||= u.searchParams.get('query_place_id')||'';if(!mapQuery){const match=u.pathname.match(/\/maps\/place\/([^/]+)/);if(match)mapQuery=decodeURIComponent(match[1].replace(/\+/g,' '));}}shortLink=u.hostname==='maps.app.goo.gl'||u.hostname==='goo.gl';}catch{}
    const address=mapQuery||[e.place||item[2],e.address||saved?.address,e.city||saved?.city||day.city,e.country||saved?.country||day.country].filter(Boolean).join(', ');
    return {name:item[2],address,coordinates,placeId,map,needsLocation:shortLink&&!coordinates&&!placeId&&!e.address&&!saved?.address};
  }
  const location=p=>p.coordinates?`${p.coordinates.lat},${p.coordinates.lng}`:p.address;
  function directions(a,b,mode){
    const q=new URLSearchParams({api:'1',origin:location(a),destination:location(b),travelmode:mode});
    if(a.placeId)q.set('origin_place_id',a.placeId);if(b.placeId)q.set('destination_place_id',b.placeId);
    return 'https://www.google.com/maps/dir/?'+q;
  }
  function embedNearby(p,type,key,radius=1000,keyword=''){
    const center=point(p?.coordinates);if(!center||!key)throw new Error('请先确认搜索中心坐标。');
    const q=String(keyword).trim().slice(0,80)||({restaurant:'restaurants',cafe:'cafes',bakery:'bakeries'}[type]||'restaurants');
    return 'https://www.google.com/maps/embed/v1/search?'+new URLSearchParams({key,q,center:`${center.lat},${center.lng}`,zoom:String(radius<=500?16:radius<=1000?15:14),language:'zh-CN'});
  }
  function embedPlace(id,key){
    if(!/^[A-Za-z0-9_-]{10,250}$/.test(id||'')||!key)throw new Error('此餐厅没有有效的地图地点 ID。');
    return 'https://www.google.com/maps/embed/v1/place?'+new URLSearchParams({key,q:'place_id:'+id,language:'zh-CN'});
  }
  function mapLink(raw){
    const value=String(raw||'').trim().match(/https?:\/\/[^\s<>]+/i)?.[0];if(!value)throw new Error('请粘贴餐厅的 Google Maps 分享链接。');
    let u;try{u=new URL(value)}catch{throw new Error('地图链接无法识别。')}
    const h=u.hostname.toLowerCase();
    if(u.protocol!=='https:'||!(/(^|\.)google\.(com|co\.jp|com\.au)$/.test(h)||h==='maps.app.goo.gl'||h==='goo.gl')||u.username||u.password)throw new Error('请使用 Google Maps 的 HTTPS 链接。');
    if(h==='goo.gl'&&!u.pathname.startsWith('/maps/'))throw new Error('请使用 Google Maps 分享链接。');
    return u.href;
  }
  function embedDirections(a,b,mode,key){
    if(!['walking','transit','driving'].includes(mode)||!key)throw new Error('站内地图尚未连接。');
    const ref=p=>p.placeId?'place_id:'+p.placeId:location(p);
    return 'https://www.google.com/maps/embed/v1/directions?'+new URLSearchParams({key,origin:ref(a),destination:ref(b),mode,units:'metric',language:'zh-CN'});
  }
  function transitTime(value,offset){
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)||!/^[-+]\d\d:\d\d$/.test(offset))throw new Error('请填写出发日期、时间和时区。');
    const date=new Date(value+':00'+offset);if(!Number.isFinite(+date))throw new Error('出发时间无法识别。');return date.toISOString();
  }
  window.OrbisDayPlannerCore={stop,directions,embedNearby,embedPlace,mapLink,transitTime,embedDirections};
})();
