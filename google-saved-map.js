/* World Saved places map: Leaflet gives us the draggable world canvas and
   Google Maps remains the source of truth for each selected place's details. */
(function(){
  const escValue=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const query=place=>[place?.name,place?.city,place?.country].filter(Boolean).join(', ');
  const mapsUrl=place=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query(place))}`;
  const embedUrl=place=>`https://www.google.com/maps?q=${encodeURIComponent(query(place))}&output=embed`;
  const detail=place=>{const rating=place.rating?`<p class="saved-google-rating">★ ${escValue(place.rating)} Google rating</p>`:'<p class="saved-google-rating saved-google-rating-muted">Live Google rating available in Maps</p>';return `<div class="saved-map-place"><div class="saved-map-photo">${place.photo?`<img src="${escValue(place.photo)}" alt="">`:'<span class="saved-map-photo-fallback">⌁</span>'}</div><div><p class="eyebrow">${escValue(place.type||'Saved place')}</p><h3>${escValue(place.name)}</h3><p>${escValue(place.zh||'')} ${place.city?`· ${escValue(place.city)}`:''}</p>${rating}</div></div><iframe title="Google Maps preview for ${escValue(place.name)}" src="${embedUrl(place)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div class="saved-map-links"><a class="saved-map-google" href="${mapsUrl(place)}" target="_blank" rel="noopener">Open Google Maps ↗</a>${place.website?`<a href="${escValue(place.website)}" target="_blank" rel="noopener">Website ↗</a>`:''}</div><p class="saved-map-note">Open Google Maps for live ratings, photos, reviews and navigation.</p>`};
  window.renderSavedPlaceMap=function(){
    const host=document.querySelector('#saved-place-map');if(!host||typeof savedPlaces==='undefined')return;
    if(!savedPlaces.length){host.innerHTML='';return}
    if(!savedPlaces.some(place=>place.key===selectedSavedMapKey))selectedSavedMapKey=savedPlaces[0].key;
    const selected=savedPlaces.find(place=>place.key===selectedSavedMapKey)||savedPlaces[0];
    if(window.savedLeafletMap){window.savedLeafletMap.remove();window.savedLeafletMap=null}
    host.innerHTML=`<div class="saved-map-head"><div><p class="eyebrow">ORBiS WORLD MAP · 收藏地图</p><h2>Every place, at a glance.</h2></div><span>${savedPlaces.length} saved</span></div><div class="saved-map-layout google-world-layout"><div id="saved-leaflet-map" class="saved-leaflet-map" aria-label="World map of saved places"></div><aside id="saved-map-detail" class="saved-map-detail google-saved-detail">${detail(selected)}</aside></div>`;
    if(!window.L){document.querySelector('#saved-leaflet-map').innerHTML='<p class="saved-map-load-error">Map is unavailable while offline.</p>';return}
    const map=L.map('saved-leaflet-map',{scrollWheelZoom:true,worldCopyJump:true,zoomControl:true,attributionControl:true});window.savedLeafletMap=map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
    const orbitIcon=L.divIcon({className:'orbis-leaflet-icon',html:'<span class="orbis-leaflet-orbit"><span>·</span></span>',iconSize:[42,42],iconAnchor:[21,21],popupAnchor:[0,-24]});
    const markers=savedPlaces.map(place=>{const coords=savedPlaceCoordinatesFor(place),marker=L.marker(coords,{icon:orbitIcon,keyboard:true,title:place.name}).addTo(map);marker.bindPopup(`<b>${escValue(place.name)}</b><br><small>${escValue(place.zh||place.city||'')}</small>${place.rating?`<br><strong>★ ${escValue(place.rating)} Google</strong>`:''}`);marker.on('click',()=>{selectedSavedMapKey=place.key;const pane=document.querySelector('#saved-map-detail');if(pane)pane.innerHTML=detail(place);document.querySelectorAll('.orbis-leaflet-orbit').forEach(node=>node.classList.remove('is-selected'));marker.getElement()?.querySelector('.orbis-leaflet-orbit')?.classList.add('is-selected')});return {place,marker}});
    window.savedLeafletMarkers=markers;
    const bounds=L.latLngBounds(savedPlaces.map(savedPlaceCoordinatesFor));
    if(savedPlaces.length===1)map.setView([20,0],2);else map.fitBounds(bounds.pad(.35),{maxZoom:2});
    setTimeout(()=>map.invalidateSize(),50);
  };
  window.renderSavedPlaceMap();
})();
