/* Called only after cloud-edge verifies the Google identity. No Google content is persisted. */
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max=180)=>typeof value==='string'?value.trim().slice(0,max):'';
function waypoint(value){
  if(!value||typeof value!=='object')fail('请确认路线两端的位置。');
  if(value.placeId&&/^[A-Za-z0-9_-]{10,250}$/.test(value.placeId))return {placeId:value.placeId};
  const p=value.coordinates;
  if(p&&typeof p.lat==='number'&&typeof p.lng==='number'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180)return {location:{latLng:{latitude:p.lat,longitude:p.lng}}};
  const address=text(value.address);if(address)return {address};
  fail('请填写完整地点名称和城市，或确认地图位置。');
}
const duration=value=>/^\d+(\.\d+)?s$/.test(value||'')?Math.ceil(parseFloat(value)):null;
function summarize(route){
  const steps=(route.legs||[]).flatMap(l=>l.steps||[]);
  return {distanceMeters:route.distanceMeters??null,durationSeconds:duration(route.duration),steps:steps.map(s=>({mode:s.travelMode,instruction:text(s.navigationInstruction?.instructions,400),distanceMeters:s.distanceMeters??null,durationSeconds:duration(s.staticDuration),...(s.transitDetails?{line:text(s.transitDetails.transitLine?.nameShort||s.transitDetails.transitLine?.name),vehicle:text(s.transitDetails.transitLine?.vehicle?.type),from:text(s.transitDetails.stopDetails?.departureStop?.name),to:text(s.transitDetails.stopDetails?.arrivalStop?.name),departureTime:s.transitDetails.stopDetails?.departureTime,arrivalTime:s.transitDetails.stopDetails?.arrivalTime,stops:s.transitDetails.stopCount}:{} )})),warnings:(route.warnings||[]).map(x=>text(x,400))};
}
export async function handlePlanner(data,{base,headers,sub,key,embedKey,fetcher=fetch,now=Date.now()}){
  if(data.action==='planner-status')return {configured:!!key,...(embedKey?{embedKey}:{}),limits:{routes:500,places:300}};
  if(!key)return {fallback:true,reason:'站内查询尚未连接 Google。现在可以免费打开 Google Maps 查看路线和餐厅。'};
  async function google(kind,url,body,mask){
    // Each outbound request reserves a durable global/month + user/day slot. Fail closed.
    const reserve=await fetcher(`${base}/rest/v1/rpc/orbis_reserve_maps_call`,{method:'POST',headers,body:JSON.stringify({p_sub:sub,p_kind:kind}),signal:AbortSignal.timeout(10000)});
    if(!reserve.ok)fail('用量保护暂不可用，请改用 Google Maps。',503);
    if(await reserve.json()!==true)fail('已到免费保护上限，请使用 Google Maps 链接；不会继续发起 API 查询。',429);
    let r;try{r=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':mask},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}catch{fail('Google 查询超时，请改用 Google Maps 或稍后重试。',502);}
    if(!r.ok)fail('Google 查询暂不可用，请检查 API 配置，或改用 Google Maps。',502);
    return r.json();
  }
  if(data.action==='planner-nearby'){
    const point=waypoint({coordinates:data.center}).location?.latLng;if(!point)fail('附近搜索需要已确认的坐标，请先确认地点位置。');
    const radius=Number(data.radius);if(![500,1000,1500].includes(radius))fail('请选择500、1000或1500米搜索范围。');
    const type=['restaurant','cafe','bakery'].includes(data.type)?data.type:'restaurant';
    if(data.keyword!==undefined&&(typeof data.keyword!=='string'||data.keyword.trim().length>80))fail('搜索关键词请保持在80字以内。');
    const keyword=text(data.keyword,80),mask='places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.attributions';
    const result=keyword?await google('places','https://places.googleapis.com/v1/places:searchText',{textQuery:keyword,includedType:type,strictTypeFiltering:true,pageSize:20,rankPreference:'RELEVANCE',languageCode:'zh-CN',locationBias:{circle:{center:point,radius}}},mask+',places.location'):await google('places','https://places.googleapis.com/v1/places:searchNearby',{includedTypes:[type],maxResultCount:8,rankPreference:'POPULARITY',languageCode:'zh-CN',locationRestriction:{circle:{center:point,radius}}},mask);
    // Text Search locationBias is not a hard boundary, so enforce the selected radius.
    const radians=n=>n*Math.PI/180;
    const distance=p=>{const l=p.location;if(!l||!Number.isFinite(l.latitude)||!Number.isFinite(l.longitude))return Infinity;const a=Math.sin(radians(l.latitude-point.latitude)/2)**2+Math.cos(radians(point.latitude))*Math.cos(radians(l.latitude))*Math.sin(radians(l.longitude-point.longitude)/2)**2;return 6371000*2*Math.asin(Math.sqrt(Math.min(1,a)));};
    const places=(result.places||[]).filter(p=>!keyword||distance(p)<=radius).slice(0,8);
    return {places:places.map(p=>({id:p.id,name:text(p.displayName?.text),address:text(p.formattedAddress,300),rating:p.rating,ratingCount:p.userRatingCount,openNow:p.currentOpeningHours?.openNow,attributions:(p.attributions||[]).map(a=>({name:text(a.provider),uri:/^https:\/\//.test(a.providerUri||'')?a.providerUri:''}))}))};
  }
  if(data.action!=='planner-route')fail('未知地图操作。');
  const origin=waypoint(data.origin),destination=waypoint(data.destination),threshold=Number(data.threshold);
  if(![400,500,600].includes(threshold))fail('请选择400、500或600米步行阈值。');
  const departure=Date.parse(data.departureTime);if(!Number.isFinite(departure)||departure<now-7*86400000||departure>now+100*86400000)fail('公交查询支持过去7天至未来100天，请调整出发时间。');
  const common={origin,destination,languageCode:'zh-CN',units:'METRIC'};
  const mask='routes.distanceMeters,routes.duration,routes.legs.steps.travelMode,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.transitDetails,routes.warnings';
  async function routes(travelMode,extra={}){return (await google('routes','https://routes.googleapis.com/directions/v2:computeRoutes',{...common,travelMode,...extra},mask)).routes||[];}
  // Actual walking route length determines the cutoff; straight-line distance never does.
  const walking=(await routes('WALK'))[0];
  if(walking&&Number.isFinite(walking.distanceMeters)&&walking.distanceMeters<=threshold)return {mode:'WALK',route:summarize(walking)};
  const rail=new Set(['SUBWAY','HEAVY_RAIL','COMMUTER_TRAIN','HIGH_SPEED_TRAIN','LONG_DISTANCE_TRAIN','METRO_RAIL','MONORAIL','RAIL','TRAM']);
  const publicRoutes=await routes('TRANSIT',{departureTime:new Date(departure).toISOString(),computeAlternativeRoutes:true,transitPreferences:{allowedTravelModes:['SUBWAY','TRAIN','LIGHT_RAIL','RAIL'],routingPreference:'FEWER_TRANSFERS'}});
  const isRail=r=>{const types=(r.legs||[]).flatMap(l=>l.steps||[]).filter(s=>s.transitDetails).map(s=>s.transitDetails.transitLine?.vehicle?.type);return types.length&&types.every(t=>rail.has(t));};
  const chosen=publicRoutes.find(isRail);
  if(chosen)return {mode:'TRANSIT',preference:'RAIL',route:summarize(chosen)};
  // Google treats the transit modes as preferences; a returned bus route is still valid.
  const buses=publicRoutes.length?publicRoutes:await routes('TRANSIT',{departureTime:new Date(departure).toISOString(),transitPreferences:{allowedTravelModes:['BUS'],routingPreference:'FEWER_TRANSFERS'}});
  if(buses[0])return {mode:'TRANSIT',preference:'PUBLIC',route:summarize(buses[0])};
  // An empty response can mean missing provider coverage (notably Japan), not no transit.
  // Keep public transport first and let the traveller check Maps before choosing a taxi.
  return {mode:'TRANSIT',preference:'MAPS',note:'Google API 未返回公共交通数据，不代表没有地铁或公交。日本公共交通不在此 API 覆盖范围内，请点击本段「公交 / 地铁优先」在 Google Maps 查看班次；确认不合适后再选择打车。'};
}
