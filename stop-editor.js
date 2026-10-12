/* Adds one editor and route-aware recommendations to the existing trip state. */
(() => {
  const S = window.OrbisSchedule, lookups = new Map();
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const modes = { auto: 'Auto', walking: 'Walk', cycling: 'Cycle', driving: 'Drive', transit: 'Transit' };
  let target = null, searchGeneration = 0, lookupQueue = Promise.resolve();
  const dialog = document.createElement('dialog');
  dialog.id = 'stop-editor-dialog';
  dialog.innerHTML = `<form id="stop-editor-form"><button type="button" class="close-modal" data-editor-close aria-label="Close">×</button><p class="eyebrow">PLACE INFORMATION · 地点信息</p><h2>Edit this stop</h2><div class="stop-editor-grid">
    <label>Place name · 地点名称<input name="title" required></label>
    <label>Category · 类别<select name="type">${['Activity', 'Meal', 'Transport', 'Stay', 'Free time'].map(type => `<option>${type}</option>`).join('')}</select></label>
    <label>Map search name<input name="place" placeholder="Exact venue or landmark"></label>
    <label>Address · 地址<input name="address"></label>
    <label>City · 城市<input name="city"></label><label>Country · 国家<input name="country"></label>
    <div class="editor-location"><button type="button" id="find-stop-location">Find location · 查找地点</button><p id="stop-location-status" aria-live="polite"></p><div id="stop-location-results"></div></div>
    <label>Start time · 开始时间<input name="time" type="time" required></label>
    <label>Stay · 停留分钟<input name="duration" type="number" min="1" max="1440" required></label>
    <label class="editor-fixed"><input name="fixed" type="checkbox"> Fixed reservation time · 固定预约时间</label>
    <label>Travel from previous stop<select name="mode">${Object.entries(modes).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
    <label>Opens · 开门时间<input name="opens" type="time"></label><label>Closes · 关门时间<input name="closes" type="time"></label>
    <label class="editor-wide">Notes · 备注<textarea name="notes" rows="3"></textarea></label>
    <label>Google Maps link<input name="map" type="url"></label><label>Website<input name="website" type="url"></label>
    <label>Photo URL<input name="photo"></label><label>Rating<select name="rating"><option value="">Not rated</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join('')}</select></label>
  </div><p class="editor-hint">Travel times use distance estimates, without live traffic or transit timetables. Confirm the location for accurate endpoints.</p><button class="primary-btn" type="submit">Save changes · 保存修改</button><button class="cancel-add" type="button" data-editor-close>Cancel</button></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form'), field = name => form.elements.namedItem(name);
  dialog.querySelectorAll('[data-editor-close]').forEach(button => button.onclick = () => dialog.close());
  dialog.addEventListener('close', () => { searchGeneration++; target = null; });
  function formItem() {
    return [field('time').value, field('type').value, field('title').value.trim(), field('notes').value.trim(), `${field('duration').value}m`, { place: field('place').value.trim(), address: field('address').value.trim(), city: field('city').value.trim(), country: field('country').value.trim(), map: field('map').value.trim() }];
  }
  function openEditor(item, day) {
    const extra = item[5] || {};
    target = { item, day, coordinates: S.coords(item, day), locationKey: S.locationKey(item, day) };
    const values = { title: item[2], type: item[1], place: extra.place || '', address: extra.address || '', city: extra.city || day.city, country: extra.country || day.country || inferredCountry(day), time: item[0], duration: S.duration(item), notes: item[3], mode: extra.travelMode || 'auto', opens: extra.opens || '', closes: extra.closes || '', map: extra.map || '', website: extra.website || '', photo: extra.photo || '', rating: extra.rating || '' };
    Object.entries(values).forEach(([name, value]) => { field(name).value = value ?? ''; });
    field('fixed').checked = !!extra.fixedTime;
    dialog.querySelector('#stop-location-results').replaceChildren();
    dialog.querySelector('#stop-location-status').textContent = target.coordinates ? 'Location confirmed ✓' : 'Find and choose the exact place to calculate travel times.';
    dialog.showModal();
  }
  function lookup(item, day, retry = false) {
    const key = S.locationKey(item, day);
    if (retry) lookups.delete(key);
    if (!lookups.has(key)) {
      const extra = item[5] || {}, query = [extra.place || mapQuery(item, day.city), extra.address, extra.city || day.city, extra.country || day.country || inferredCountry(day)].filter(Boolean).join(', ');
      const result = lookupQueue.then(async () => {
        try {
          const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) return [];
          const data = await response.json();
          return (data.features || []).filter(entry => entry.geometry?.coordinates?.length === 2).map(entry => ({ name: entry.properties.name || '', label: [entry.properties.name, entry.properties.street, entry.properties.city, entry.properties.country].filter(Boolean).join(', '), coordinates: [entry.geometry.coordinates[1], entry.geometry.coordinates[0]] }));
        } catch { return []; }
      });
      lookups.set(key, result);
      lookupQueue = result.then(() => new Promise(resolve => setTimeout(resolve, 250)));
    }
    return lookups.get(key);
  }
  dialog.querySelector('#find-stop-location').onclick = async () => {
    if (!target || !field('title').value.trim()) return;
    const current = target, generation = ++searchGeneration, draft = formItem(), key = S.locationKey(draft, current.day);
    const status = dialog.querySelector('#stop-location-status'), results = dialog.querySelector('#stop-location-results');
    status.textContent = 'Finding locations…'; results.replaceChildren();
    const matches = await lookup(draft, current.day, true);
    if (generation !== searchGeneration || target !== current || key !== S.locationKey(formItem(), current.day)) return;
    status.textContent = matches.length ? 'Choose the correct place:' : 'No location found. Try the exact venue name and address; travel time remains unknown.';
    matches.forEach(match => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = match.label;
      button.onclick = () => {
        current.coordinates = match.coordinates; current.locationKey = key;
        status.textContent = `Selected: ${match.label} ✓`; results.replaceChildren();
      };
      results.append(button);
    });
  };
  form.onsubmit = event => {
    event.preventDefault();
    if (!target || !target.day.items.includes(target.item)) return;
    const { item, day } = target, draft = formItem(), key = S.locationKey(draft, day), extra = { ...(item[5] || {}), ...draft[5], website: field('website').value.trim(), photo: field('photo').value.trim(), rating: field('rating').value, opens: field('opens').value, closes: field('closes').value, fixedTime: field('fixed').checked, travelMode: field('mode').value };
    if (key === target.locationKey && target.coordinates) { extra.coordinates = target.coordinates; extra.locationKey = key; }
    else { delete extra.coordinates; delete extra.locationKey; }
    item.splice(0, 6, ...draft.slice(0, 5), extra);
    persistTrip(); dialog.close(); renderItinerary(); renderMap(); toast('Place saved · route and recommendations updated');
  };
  function resolveLocations(day) {
    day.items.forEach(item => {
      if (S.coords(item, day)) return;
      const key = S.locationKey(item, day);
      lookup(item, day).then(matches => {
        if (!days.includes(day) || !day.items.includes(item) || S.locationKey(item, day) !== key || S.coords(item, day)) return;
        // Only auto-accept a unique exact name. Ambiguous results require selection.
        const normalize = text => String(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        const wanted = normalize(item[5]?.place || mapQuery(item, day.city)), exact = matches.filter(match => normalize(match.name) === wanted);
        if (exact.length !== 1) return;
        item[5] ??= {}; item[5].coordinates = exact[0].coordinates; item[5].locationKey = key;
        persistTrip(); if (days[selected] === day) refreshRecommendations(day);
      });
    });
  }
  function routeLink(from, to, day, mode) {
    const endpoint = item => S.coords(item, day)?.join(',') || [item[5]?.place || mapQuery(item, day.city), item[5]?.address, item[5]?.city || day.city, item[5]?.country || day.country].filter(Boolean).join(', ');
    return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', origin: endpoint(from), destination: endpoint(to), travelmode: mode === 'cycling' ? 'bicycling' : mode === 'auto' ? 'driving' : mode })}`;
  }
  function refreshRecommendations(day) {
    const rows = S.plan(day);
    document.querySelectorAll('#timeline .timeline-item').forEach((row, index) => {
      const timing = rows[index], label = row.querySelector('.stop-recommendation');
      if (label) label.textContent = timing.start == null ? 'Recommended time · confirm previous locations' : `Recommended · ${S.clock(timing.start)}–${S.clock(timing.end)}${timing.conflict ? ` · ${timing.conflict}` : ''}`;
      if (label) label.classList.toggle('has-conflict', !!timing.conflict);
    });
    document.querySelectorAll('#timeline .travel-segment').forEach((segment, index) => {
      const timing = rows[index + 1].travel;
      segment.innerHTML = `<a href="${safe(routeLink(day.items[index], day.items[index + 1], day, timing.mode))}" target="_blank" rel="noreferrer">${timing.minutes == null ? '路程待确认' : `约 ${timing.minutes} 分钟 · ${({walking:'步行',cycling:'骑行',driving:'驾车',transit:'公共交通',auto:'交通'})[timing.mode] || '交通'}`} · 查看路线 ↗</a>`;
      segment.title = 'Distance-based estimate with a 30% route allowance; confirm the actual route in Maps.';
    });
    const apply = document.querySelector('#apply-stop-schedule');
    if (apply) apply.disabled = !rows.length || rows.some(row => row.start == null || row.travel.minutes == null || row.end >= 1440 || row.conflict);
    S.updateStats();
  }
  function move(day, index, to) {
    if (index < 0 || index >= day.items.length || to < 0 || to >= day.items.length || index === to) return;
    day.planStart ||= day.items[0]?.[0] || '09:00';
    day.items.splice(to, 0, day.items.splice(index, 1)[0]);
    persistTrip(); renderItinerary(); toast('Stop moved · recommendations updated');
  }
  const baseRender = window.renderItinerary;
  function touchReorder(row, day, index) {
    let timer, active = false, origin, pointer, destination = index, frame;
    const targets = () => [...document.querySelectorAll('#timeline .timeline-item')];
    const clear = () => {
      clearTimeout(timer); cancelAnimationFrame(frame); active = false;
      row.classList.remove('card-dragging');
      targets().forEach(element => element.classList.remove('card-drop-target'));
    };
    const track = () => {
      if (!active) return;
      const rows = targets();
      const speed = pointer.y < 180 ? -8 : pointer.y > innerHeight - 120 ? 8 : 0;
      if (speed) window.scrollBy(0,speed);
      let closest = null, distance = Infinity;
      rows.forEach(element => {
        if (element === row) return;
        const rect = element.getBoundingClientRect(), delta = Math.abs(pointer.y - (rect.top + rect.height / 2));
        if (delta < distance) { distance = delta; closest = element; }
      });
      const own = row.getBoundingClientRect();
      if (pointer.y >= own.top && pointer.y <= own.bottom) closest = null;
      destination = closest ? +closest.dataset.index : index;
      rows.forEach(element => element.classList.toggle('card-drop-target',element === closest));
      frame = requestAnimationFrame(track);
    };
    row.addEventListener('touchstart', event => {
      clear(); if (event.touches.length !== 1 || event.target.closest('button,a,input,textarea,select,summary,[contenteditable]')) return;
      const touch = event.touches[0]; origin = pointer = {x:touch.clientX,y:touch.clientY}; destination = index;
      timer = setTimeout(() => { active = true; row.classList.add('card-dragging'); track(); },350);
    },{passive:true});
    row.addEventListener('touchmove', event => {
      if (!origin || event.touches.length !== 1) { clear(); return; }
      const touch = event.touches[0]; pointer = {x:touch.clientX,y:touch.clientY};
      if (!active) { if (Math.hypot(pointer.x-origin.x,pointer.y-origin.y)>8) { clearTimeout(timer); origin=null; } return; }
      event.preventDefault();
    },{passive:false});
    row.addEventListener('touchend', event => { const shouldMove = active, to = destination; if (active) event.preventDefault(); clear(); origin=null; if (shouldMove) move(day,index,to); },{passive:false});
    row.addEventListener('touchcancel', () => { clear(); origin=null; });
    row.addEventListener('contextmenu', event => { if (active) event.preventDefault(); });
  }
  window.renderItinerary = function () {
    if (!days[selected]?.items) return;
    baseRender();
    const day = days[selected];
    document.querySelectorAll('#timeline .timeline-item').forEach((row, index) => {
      const item = day.items[index], card = row.querySelector('.item-card');
      const bar = document.createElement('div'); bar.className = 'stop-edit-tab';
      bar.innerHTML = `<button type="button" data-edit-stop aria-haspopup="dialog">地点信息 · Edit place</button>`;
      card.prepend(bar); bar.querySelector('[data-edit-stop]').onclick = () => openEditor(item, day);
      const recommendation = document.createElement('p'); recommendation.className = 'stop-recommendation'; card.append(recommendation);
      // Replace the original drag handler, which did not persist the new order.
      row.ondragstart = event => { if (event.target.closest('button,a,input,textarea,select,summary,[contenteditable]')) { event.preventDefault(); return; } event.dataTransfer.setData('text/orbis-stop', String(index)); event.dataTransfer.effectAllowed = 'move'; row.classList.add('card-dragging'); };
      row.ondragend = () => { row.classList.remove('card-dragging'); document.querySelectorAll('.card-drop-target').forEach(element => element.classList.remove('card-drop-target')); };
      row.ondragover = event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; row.classList.add('card-drop-target'); };
      row.ondragleave = event => { if (!row.contains(event.relatedTarget)) row.classList.remove('card-drop-target'); };
      row.ondrop = event => { event.preventDefault(); const source = event.dataTransfer.getData('text/orbis-stop'); if (/^\d+$/.test(source)) move(day, Number(source), index); };
      row.tabIndex = 0; row.title = '拖动排序 · 手机长按拖动 · 键盘 Alt + ↑ / ↓';
      row.onkeydown = event => { if (event.target !== row || !event.altKey || !['ArrowUp','ArrowDown'].includes(event.key)) return; event.preventDefault(); const to = index + (event.key === 'ArrowUp' ? -1 : 1); move(day,index,to); document.querySelectorAll('#timeline .timeline-item')[Math.max(0,Math.min(day.items.length-1,to))]?.focus(); };
      touchReorder(row,day,index);
      row.querySelectorAll('[contenteditable]').forEach(element => {
        element.onblur = () => {
          const slot = element.tagName === 'H3' ? 2 : 3, text = element.textContent.trim();
          if (item[slot] === text) return;
          item[slot] = text; if (slot === 2) { item[5] ??= {}; item[5].place = text; delete item[5].coordinates; delete item[5].locationKey; }
          persistTrip(); renderItinerary();
        };
      });
    });
    let controls = document.querySelector('#stop-schedule-controls');
    if (!controls) {
      controls = document.createElement('div'); controls.id = 'stop-schedule-controls';
      document.querySelector('#timeline').before(controls);
    }
    controls.innerHTML = `<label>Day starts · 当天开始 <input type="time" id="stop-day-start" value="${safe(day.planStart || day.items[0]?.[0] || '09:00')}"></label><button type="button" id="apply-stop-schedule">Apply recommended times · 应用推荐时间</button><small>Estimates update automatically. Existing times change only when you apply.</small>`;
    controls.querySelector('input').onchange = event => { day.planStart = event.target.value; persistTrip(); refreshRecommendations(day); };
    controls.querySelector('button').onclick = () => {
      const rows = S.plan(day);
      if (rows.some(row => row.start == null || row.travel.minutes == null || row.end >= 1440 || row.conflict)) return;
      day.items.forEach((item, index) => { if (!item[5]?.fixedTime) item[0] = S.clock(rows[index].start); });
      persistTrip(); renderItinerary(); toast('Recommended times applied');
    };
    refreshRecommendations(day); resolveLocations(day);
  };
  // Custom per-stop city/country/address must also be reflected by navigation links.
  const baseMapUrl = window.mapUrl;
  window.mapUrl = (item, city) => {
    if (!item) return baseMapUrl(item, city);
    const extra = item[5] || {};
    return extra.map || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([mapQuery(item, city), extra.address, extra.city || city, extra.country || countryForMapCity(city)].filter(Boolean).join(', '))}`;
  };
  renderItinerary();
})();
