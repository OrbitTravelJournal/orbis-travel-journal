/* Public, sourced place facts and Commons photographs; no generative model. */
const agent='OrbisTravelJournal/1.0 (https://orbittraveljournal.github.io/orbis-travel-journal/)';
async function api(host,params){
  const r=await fetch(`https://${host}/w/api.php?${new URLSearchParams({...params,format:'json',origin:'*'})}`,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error('Place source unavailable');return r.json();
}
const label=entity=>entity?.labels?.zh?.value||entity?.labels?.en?.value||entity?.labels?.ja?.value||'';
const claim=(entity,key)=>entity?.claims?.[key]?.find(s=>s.rank!=='deprecated'&&s.mainsnak?.datavalue)?.mainsnak.datavalue.value;
const text=html=>String(html||'').replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
export async function lookupPlaces(query){
  const language=/[\u3400-\u9fff]/.test(query)?'zh':'en';
  const found=await api('www.wikidata.org',{action:'wbsearchentities',search:query,language,uselang:'zh',type:'item',limit:'5'});
  const ids=(found.search||[]).map(x=>x.id).filter(x=>/^Q\d+$/.test(x));if(!ids.length)return [];
  const data=await api('www.wikidata.org',{action:'wbgetentities',ids:ids.join('|'),props:'labels|descriptions|claims',languages:'zh|en|ja'});
  const entities=ids.map(id=>data.entities?.[id]).filter(e=>e&&(claim(e,'P625')||claim(e,'P131')));
  const related=[...new Set(entities.flatMap(e=>[claim(e,'P17')?.id,claim(e,'P131')?.id]).filter(Boolean))];
  const regions=related.length?(await api('www.wikidata.org',{action:'wbgetentities',ids:related.join('|'),props:'labels',languages:'zh|en|ja'})).entities:{};
  const files=entities.map(e=>claim(e,'P18')).filter(v=>typeof v==='string').map(v=>'File:'+v);
  let images={};
  if(files.length){try{const info=await api('commons.wikimedia.org',{action:'query',titles:files.join('|'),prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'700'});images=Object.fromEntries(Object.values(info.query?.pages||{}).map(p=>[p.title.replace(/_/g,' '),p.imageinfo?.[0]]));}catch{}}
  return entities.map(e=>{
    const coord=claim(e,'P625'),address=claim(e,'P6375'),file=claim(e,'P18'),image=images[('File:'+file).replace(/_/g,' ')],meta=image?.extmetadata;
    const photo=image&&/^image\/(jpeg|png|webp)$/.test(image.mime)&&/^(CC BY|CC0|Public domain|PD)/i.test(meta?.LicenseShortName?.value||'')?(image.thumburl||image.url):'';
    const name=label(e),source=`https://www.wikidata.org/wiki/${e.id}`;
    return {id:e.id,name,zh:e.labels?.zh?.value||'',country:label(regions[claim(e,'P17')?.id]),region:label(regions[claim(e,'P131')?.id]),address:typeof address?.text==='string'?address.text:'',notes:e.descriptions?.zh?.value||e.descriptions?.en?.value||'',website:/^https?:\/\//.test(claim(e,'P856')||'')?claim(e,'P856'):'',map:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord&&Number.isFinite(coord.latitude)&&Number.isFinite(coord.longitude)?coord.latitude+','+coord.longitude:name)}`,photo,photoSource:photo?image.descriptionurl:'',photoCredit:photo?[text(meta.Artist?.value),text(meta.LicenseShortName.value)].filter(Boolean).join(' · '):'',lookupSource:source};
  });
}
