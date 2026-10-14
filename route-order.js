/* Geographic ordering only: distances are great-circle kilometres, never travel time. */
(() => {
  const coordinate=value=>{
    if(Array.isArray(value)&&value.length===2)value={lat:value[0],lng:value[1]};
    const rawLat=value?.lat??value?.latitude,rawLng=value?.lng??value?.longitude;if(rawLat==null||rawLng==null||rawLat===''||rawLng==='')return null;
    const lat=Number(rawLat),lng=Number(rawLng);
    return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
  };
  function fromMap(value){
    try{const url=new URL(value);const query=url.searchParams.get('query')||url.searchParams.get('q')||'';const match=query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);return match?coordinate({lat:match[1],lng:match[2]}):null;}catch{return null;}
  }
  function distance(a,b){const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlng=(b.lng-a.lng)*rad;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));}
  function cost(points,start,end){let sum=0,previous=start;for(const point of points){if(previous)sum+=distance(previous,point);previous=point;}if(previous&&end)sum+=distance(previous,end);return sum;}
  function order(points,start=null,end=null){
    const n=points.length;if(n<2)return points.slice();
    if(n>10){
      const left=points.slice(),result=[];let current=start||left.shift();if(!start)result.push(current);
      while(left.length){let nearest=0;left.forEach((point,i)=>{if(distance(current,point)<distance(current,left[nearest]))nearest=i;});current=left.splice(nearest,1)[0];result.push(current);}
      for(let pass=0;pass<8;pass++){let improved=false;for(let a=0;a<n-1;a++)for(let b=a+1;b<n;b++){const trial=[...result.slice(0,a),...result.slice(a,b+1).reverse(),...result.slice(b+1)];if(cost(trial,start,end)+1e-8<cost(result,start,end)){result.splice(0,n,...trial);improved=true;}}if(!improved)break;}
      return cost(result,start,end)<cost(points,start,end)?result:points.slice();
    }
    const size=1<<n,dp=new Float64Array(size*n).fill(Infinity),prev=new Int16Array(size*n).fill(-1);
    for(let i=0;i<n;i++)dp[(1<<i)*n+i]=start?distance(start,points[i]):0;
    for(let mask=1;mask<size;mask++)for(let last=0;last<n;last++)if(mask&(1<<last))for(let next=0;next<n;next++)if(!(mask&(1<<next))){const target=(mask|(1<<next))*n+next,value=dp[mask*n+last]+distance(points[last],points[next]);if(value<dp[target]){dp[target]=value;prev[target]=last;}}
    let last=0,best=Infinity;for(let i=0;i<n;i++){const value=dp[(size-1)*n+i]+(end?distance(points[i],end):0);if(value<best){best=value;last=i;}}
    if(best>=cost(points,start,end)-1e-8)return points.slice();
    let mask=size-1;const result=[];while(mask){result.unshift(points[last]);const previous=prev[mask*n+last];mask^=1<<last;last=previous;}return result;
  }
  function plan(points,modes){
    const result=points.map((_,i)=>i);let heuristic=false;
    for(let from=0;from<points.length;){if(modes[from]!=='move'){from++;continue;}let to=from;while(to<points.length&&modes[to]==='move')to++;
      const segment=points.slice(from,to).map((p,i)=>({...p,index:from+i}));
      if(segment.some(p=>!coordinate(p)))throw new Error('请先确认所有参与排序地点的坐标。');
      let left=from-1,right=to;while(left>=0&&modes[left]==='skip')left--;while(right<points.length&&modes[right]==='skip')right++;
      const start=left>=0?coordinate(points[result[left]]):null,end=right<points.length?coordinate(points[result[right]]):null;
      heuristic ||= segment.length>10;const ordered=order(segment,start,end);for(let i=from;i<to;i++)result[i]=ordered[i-from].index;from=to;
    }
    const included=result.filter(i=>modes[i]!=='skip'),before=points.filter((_,i)=>modes[i]!=='skip');
    if(before.some(p=>!coordinate(p)))throw new Error('请先确认参与路线的固定地点坐标，或将它设为不参与。');
    return {indices:result,before:cost(before),after:cost(included.map(i=>points[i])),heuristic};
  }
  window.OrbisRouteOrder={coordinate,fromMap,distance,order,plan};
})();
