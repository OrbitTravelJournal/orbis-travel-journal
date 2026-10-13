/* Reading presentation only: existing trips and ordered stop arrays stay intact. */
(() => {
  const dateInZone = (now, zone = 'Asia/Tokyo') => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit' }).format(now); }
    catch { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).format(now); }
  };
  const dayIndex = (trip, lastISO, now = new Date()) => {
    const list = trip?.days || [], today = dateInZone(now, trip?.timezone || 'Asia/Tokyo');
    const current = list.findIndex(day => day.iso === today);
    if (current >= 0 && (!trip.start || today >= trip.start) && (!trip.end || today <= trip.end)) return current;
    return Math.max(0, list.findIndex(day => day.iso === lastISO));
  };
  function labels(item) {
    const extra = item[5] || {}, priority = String(extra.priority || '').toLowerCase(), state = String(extra.bookingStatus || '').toLowerCase();
    return {
      priority: extra.mustDo === true || ['must do','must','required','必去'].includes(priority) ? '必去' : extra.optional === true || ['optional','flexible','可选'].includes(priority) || /^alternative route$/i.test(String(item[3]).trim()) ? '可选' : '优先级未标注',
      booking: extra.booked === true || ['confirmed','booked','已预订'].includes(state) ? '已预订' : extra.booked === false || ['unbooked','not booked','未预订'].includes(state) ? '未预订' : '预订状态未标注'
    };
  }
  globalThis.OrbisReader = { dateInZone, dayIndex, labels };
})();

if (typeof document !== 'undefined') (() => {
  document.body.classList.add('reader-mode', 'apple-ui');
  const R = window.OrbisReader;
  const text = value => String(value ?? '');
  const safe = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trip = () => window.TabiWorkspace?.state?.trips.find(t => t.id === window.TabiWorkspace.state.currentTripId);
  const key = t => `orbis-read-day:${window.TabiWorkspace?.state?.currentUserId || ''}:${t?.id || ''}`;
  const lastDay = t => { try { return localStorage.getItem(key(t)); } catch { return null; } };
  R.entryIndex = t => R.dayIndex(t, lastDay(t));
  const home = document.createElement('section'); home.id = 'reader-home'; home.className = 'glass-panel';
  document.querySelector('#trips').prepend(home);
  function renderHome() {
    const active = trip();
    if (!active) { home.hidden = true; return; } home.hidden = false;
    const index = R.entryIndex(active), target = active.days?.[index], today = R.dateInZone(new Date(), active.timezone || 'Asia/Tokyo');
    const isToday = target?.iso === today;
    home.innerHTML = `<p class="eyebrow">CURRENT JOURNEY · 当前旅行</p><h1>${safe(active.name)}</h1><p>${safe(active.start)} — ${safe(active.end)}</p><p>${safe(active.route || '')}</p><div class="reader-home-actions"><button type="button" class="glass-button glass-button-accent" id="reader-open-day">${isToday ? '查看今天' : '查看行程'} <span>Day ${index + 1} · ${safe(target?.iso || '')} · ${safe(target?.city || '')}</span></button><button type="button" class="glass-button" id="reader-open-stays">查看住宿和预订</button></div>`;
    home.querySelector('#reader-open-day').onclick = () => { selected = R.entryIndex(active); showPage('itinerary'); };
    home.querySelector('#reader-open-stays').onclick = () => showPage('stays');
  }
  const summary = document.createElement('section'); summary.id = 'reader-day-summary';
  document.querySelector('#date-rail').after(summary);
  function readDay() {
    const day = days[selected]; if (!day) return;
    const active = trip(); if (active) { try { localStorage.setItem(key(active), day.iso); } catch {} }
    document.querySelectorAll('#date-rail .date-tab').forEach((button, index) => {
      const d = days[index];
      const monthDay = d.iso ? `${Number(d.iso.slice(5,7))}月${Number(d.iso.slice(8))}日` : d.date;
      button.innerHTML = `<small>Day ${index + 1}</small><strong>${safe(monthDay)}</strong><span>${safe(d.city)}</span>`;
      button.setAttribute('aria-label', `Day ${index + 1} · ${d.iso || d.date} · ${d.city}`);
      if (index === selected) button.setAttribute('aria-current', 'date'); else button.removeAttribute('aria-current');
    });
    const rail = document.querySelector('#date-rail'), activeTab = rail.querySelector('.active');
    if (activeTab) rail.scrollLeft = Math.max(0, activeTab.offsetLeft - rail.offsetLeft - 8);
    const activities = day.items.filter(item => ['Activity','Meal'].includes(item[1])).slice(0,3).map(item => item[2]);
    summary.innerHTML = `<div><small>当天区域</small><b>${safe(day.city)}</b></div><div><small>主要活动</small><p>${safe(activities.join(' · ') || day.theme || '活动未填写')}</p></div><div><small>当晚住宿</small><b>${safe(day.hotel && day.hotel !== '—' ? day.hotel : '暂无当晚住宿')}</b></div><div class="reader-day-actions"><button type="button" class="glass-button" id="reader-day-map">查看当天地图</button><button type="button" class="glass-button" id="reader-day-stays">查看住宿预订</button></div>`;
    summary.querySelector('#reader-day-map').onclick = () => showPage('map');
    summary.querySelector('#reader-day-stays').onclick = () => { const button = document.querySelector('.hotel-context button'); if (button) button.click(); else showPage('stays'); };
    document.querySelectorAll('#timeline .timeline-item').forEach((row, index) => {
      const item = day.items[index], card = row.querySelector('.item-card'); if (!item || !card) return;
      const originalNote = card.querySelector('.item-top p'), full = text(item[3]);
      const preview = document.createElement('p'); preview.className = 'reader-short-note'; preview.textContent = full;
      const details = document.createElement('div'); details.className = 'reader-secondary';
      const body = document.createElement('div'); body.className = 'reader-details-body'; details.append(body);
      originalNote?.remove();
      const links = card.querySelector('.place-links'), navigation = links?.querySelector('a');
      const primary = document.createElement('div'); primary.className = 'reader-stop-primary';
      if (navigation) { navigation.textContent = '导航 · Google Maps ↗'; navigation.classList.add('reader-navigate'); primary.append(navigation); }
      const flags = R.labels(item), foot = card.querySelector('.item-foot');
      if (foot) { foot.innerHTML = [flags.priority,flags.booking].filter(value => !value.endsWith('未标注')).map(value => `<span>${safe(value)}</span>`).join(''); if (foot.childElementCount) primary.append(foot); else foot.remove(); }
      for (const element of [card.querySelector('.stop-edit-tab'),card.querySelector('.item-actions'),card.querySelector('.place-photo'),links,card.querySelector('.place-drawer'),card.querySelector('.stop-recommendation')]) if (element) body.append(element);
      const time = row.querySelector('.item-time'); if (time) card.prepend(time);
      card.append(preview, primary, details);
      const actions = body.querySelector('.item-actions');
      const cardActions = document.createElement('div'); cardActions.className = 'reader-card-actions';
      const edit = body.querySelector('[data-edit-stop]');
      if (edit) { edit.title = '修改地点信息'; edit.setAttribute('aria-label','修改地点信息'); cardActions.append(edit); }
      const photo = body.querySelector('.photo-upload-btn');
      if (photo) { photo.title = '上传照片'; photo.setAttribute('aria-label','上传照片'); cardActions.append(photo); }
      if (actions) {
        const bookmark = actions.querySelector('.save-stop');
        if (bookmark) {
          bookmark.classList.add('reader-bookmark');
          bookmark.title = bookmark.getAttribute('aria-label');
          cardActions.append(bookmark);
        }
      }
      const topLine = document.createElement('div'); topLine.className = 'reader-card-topline';
      if (time) topLine.append(time);
      topLine.append(cardActions); card.prepend(topLine);
      body.querySelector('.stop-edit-tab')?.remove();
      body.querySelector('.auto-enrich-stop')?.remove();
      let visited = body.querySelector('.visited-stop');
      if (!visited) {
        visited = document.createElement('button');
        visited.type = 'button'; visited.className = 'visited-stop';
        visited.onclick = () => {
          item[5] ??= {};
          item[5].visited = !item[5].visited;
          item[5].visitedAt = item[5].visited ? (item[5].visitedAt || new Date().toISOString()) : '';
          persistTrip(); renderItinerary(); renderJournal();
        };
      }
      visited.classList.toggle('is-visited', !!item[5]?.visited);
      visited.setAttribute('aria-pressed', String(!!item[5]?.visited));
      visited.setAttribute('aria-label', item[5]?.visited ? '取消打卡' : '打卡');
      visited.title = item[5]?.visited ? '取消打卡' : '打卡';
      cardActions.append(visited);
      const shortActions = {'.item-menu':'更多操作','.edit-link-btn':'修改链接'};
      Object.entries(shortActions).forEach(([selector,label]) => body.querySelectorAll(selector).forEach(button => { button.textContent = label; button.setAttribute('aria-label',label); }));
      const menu = body.querySelector('.item-menu'), editLink = body.querySelector('.edit-link-btn');
      if (menu) {
        cardActions.append(actions);
        menu.classList.add('reader-more');
        menu.setAttribute('aria-expanded','false');
        const openMenu = menu.onclick;
        editLink?.remove();
        menu.onclick = () => {
          const previous = body.querySelector('.action-popover');
          if (previous) { previous.remove(); menu.setAttribute('aria-expanded','false'); return; }
          openMenu?.();
          const panel = actions?.querySelector('.action-popover');
          if (!panel) return;
          body.prepend(panel);
          menu.setAttribute('aria-expanded','true');
          [['[data-skip]','暂时跳过'],['[data-copy]','复制地点'],['[data-delete]','删除地点']].forEach(([selector,label]) => { const button=panel.querySelector(selector); if (button) button.textContent=label; });
          if (editLink) panel.append(editLink);
        };
      }
      row.draggable = true;
    });
    // Existing planning controls and supplemental notes remain available on demand.
    const controls = document.querySelector('#stop-schedule-controls');
    if (controls && !controls.closest('.reader-schedule')) {
      const panel = document.createElement('details'); panel.className = 'reader-schedule'; panel.innerHTML = '<summary>时间安排工具</summary>'; document.querySelector('#timeline').after(panel); panel.append(controls);
    }
    const notice = document.querySelector('#daily-notice');
    let notes = document.querySelector('#reader-day-notes');
    if (!notes) { notes = document.createElement('details'); notes.id = 'reader-day-notes'; document.querySelector('#timeline').after(notes); }
    notes.innerHTML = `<summary>当天完整提醒与主题</summary><p>${safe(day.theme || '')}</p><p>${safe(day.notice || '')}</p>${notice?.textContent && notice.textContent !== day.notice ? `<p>${safe(notice.textContent)}</p>` : ''}`;
    renderHome();
  }
  const baseItinerary = window.renderItinerary;
  window.renderItinerary = function () { baseItinerary(); readDay(); window.decorateOrbisIcons?.(); };
  const baseHotels = window.renderHotels;
  window.renderHotels = function () {
    baseHotels();
    document.querySelectorAll('#hotel-list [data-delete-hotel]').forEach(button => {
      const hotel = hotels[+button.dataset.deleteHotel], info = hotel[4] || {}, card = button.closest('.hotel-card');
      const copy = card.querySelector('.hotel-copy'), name = copy.querySelector('b');
      const dates = document.createElement('div'); dates.className = 'reader-stay-dates';
      dates.innerHTML = `<span>入住 <b>${safe(info.checkinDate || '日期未填写')} ${safe(info.checkinTime || '')}</b></span><span>退房 <b>${safe(info.checkoutDate || '日期未填写')} ${safe(info.checkoutTime || '')}</b></span>`;
      name.after(dates);
      const address = document.createElement('p'); address.className = 'reader-stay-address'; address.textContent = info.address || '酒店地址未填写'; dates.after(address);
      const actions = card.querySelector('.hotel-actions'), nav = document.createElement('a'); nav.className = 'reader-navigate'; nav.target = '_blank'; nav.rel = 'noreferrer'; nav.textContent = '导航 · Google Maps ↗';
      nav.href = info.map || hotelMedia[hotel[1]]?.map || (/google\.[^/]+\/maps|maps\.app\.goo\.gl/i.test(hotel[3] || '') ? hotel[3] : '') || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hotel[1], info.address, hotel[2]?.split('·')[0]].filter(Boolean).join(', '))}`;
      actions.prepend(nav);
      const copyButton = document.createElement('button'); copyButton.type = 'button'; copyButton.textContent = '复制预订信息';
      copyButton.onclick = async () => {
        const value = [hotel[1],info.checkinDate ? `入住 ${info.checkinDate} ${info.checkinTime || ''}` : hotel[0],info.checkoutDate ? `退房 ${info.checkoutDate} ${info.checkoutTime || ''}` : '',info.address,hotel[2],info.confirmationNumber,hotel[3]].filter(Boolean).join('\n');
        try { await navigator.clipboard.writeText(value); copyButton.textContent = '已复制'; } catch { copyButton.textContent = '无法自动复制，请长按预订信息'; }
      }; actions.append(copyButton);
      if (info.confirmationNumber) { const code = document.createElement('p'); code.textContent = `确认号码：${info.confirmationNumber}`; copy.append(code); }
      const details = document.createElement('details'); details.className = 'reader-hotel-details'; details.innerHTML = '<summary>照片及其他操作</summary>';
      for (const element of [card.querySelector('.hotel-photo-upload'),card.querySelector('[data-hotel-fill]'),card.querySelector('[data-hotel-remove-photo]'),button]) if (element) details.append(element);
      card.append(details);
    });
  };
  const baseMap = window.renderMap;
  window.renderMap = function () {
    if (!days[selected]) return;
    if (days[selected].items.length) baseMap();
    else { document.querySelector('#map-stop-list').textContent = '当天暂无地点'; document.querySelector('#google-map-preview').removeAttribute('src'); }
    let bar = document.querySelector('#reader-map-day');
    if (!bar) { bar = document.createElement('div'); bar.id = 'reader-map-day'; document.querySelector('.map-page-head').after(bar); }
    bar.innerHTML = `<label>当天路线 <select>${days.map((day,index) => `<option value="${index}" ${index === selected ? 'selected' : ''}>Day ${index+1} · ${safe(day.iso || day.date)} · ${safe(day.city)}</option>`).join('')}</select></label><button type="button" class="glass-button">返回当天攻略</button>`;
    bar.querySelector('select').onchange = event => { selected = +event.target.value; renderItinerary(); renderMap(); };
    bar.querySelector('button').onclick = () => showPage('itinerary');
    document.querySelectorAll('.navigate-stop').forEach(link => { link.textContent = '导航 ↗'; });
  };
  const baseShow = window.showPage;
  window.showPage = function (page) { if (page === 'trips') renderHome(); baseShow(page); };
  // Reuse the existing bottom navigation, with direct access to home and bookings.
  const mobile = document.querySelector('.mobile-nav');
  if (mobile) {
    const icons = {
      trips: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
      itinerary: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-12 4h3m-3 3h7"/>',
      map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"/>',
      restaurants: '<path d="M6 3h12v18l-6-4-6 4z"/>',
      stays: '<path d="M3 18v3m18-3v3M3 10V5h18v5M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6zM7 7h3m4 0h3"/>'
    };
    mobile.innerHTML = [['trips','首页'],['itinerary','行程'],['map','地图'],['restaurants','收藏'],['stays','住宿']].map(([page,label]) => `<a href="#${page}" data-page="${page}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[page]}</svg><span>${label}</span></a>`).join('');
    mobile.querySelectorAll('a').forEach(link => { link.onclick = event => { event.preventDefault(); showPage(link.dataset.page); }; });
  }
  const active = trip();
  if (active) { selected = R.entryIndex(active); renderItinerary(); renderHotels(); showPage('trips'); }
  else renderHome();
})();
