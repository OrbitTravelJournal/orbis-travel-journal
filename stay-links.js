/* A booking's date range is the source of truth for each night's hotel. */
(() => {
  const nextDate = iso => { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); };
  const validDate = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && !Number.isNaN(Date.parse(iso));
  function prepare(bookings, tripDays, makeId = () => crypto.randomUUID()) {
    bookings.forEach(hotel => {
      hotel[4] ??= {}; const info = hotel[4]; info.id ||= makeId();
      if (info.migrated) return;
      const dates = String(hotel[0] || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
      if (dates.length >= 2) {
        info.checkinDate ||= dates[0]; info.checkoutDate ||= dates[1];
        const times = String(hotel[0]).match(/\d{2}:\d{2}/g) || [];
        info.checkinTime ||= times[0] || '15:00'; info.checkoutTime ||= times[1] || '11:00';
      } else {
        const label = String(hotel[0] || '').trim().toUpperCase(), months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const match = /^(\d{1,2})\s+([A-Z]{3})$/.exec(label);
        const sorted = [...tripDays].sort((a, b) => String(a.iso).localeCompare(String(b.iso)));
        const start = match && sorted.find(day => validDate(day.iso) && Number(day.iso.slice(8)) === Number(match[1]) && Number(day.iso.slice(5, 7)) === months.indexOf(match[2]) + 1 && day.hotel === hotel[1]);
        if (start) {
          let end = nextDate(start.iso);
          while (sorted.some(day => day.iso === end && day.hotel === hotel[1])) end = nextDate(end);
          info.checkinDate = start.iso; info.checkoutDate = end;
        }
      }
      info.checkinTime ||= '15:00'; info.checkoutTime ||= '11:00'; info.migrated = true;
    });
  }
  const covers = (hotel, iso) => validDate(iso) && validDate(hotel[4]?.checkinDate) && validDate(hotel[4]?.checkoutDate) && hotel[4].checkinDate <= iso && iso < hotel[4].checkoutDate;
  function synchronize(bookings, tripDays, hidden = new Set()) {
    const visible = bookings.filter(hotel => !hidden.has(`${hotel[0]}|${hotel[1]}|${hotel[2]}`));
    tripDays.forEach(day => {
      const matches = visible.filter(hotel => covers(hotel, day.iso));
      const booking = matches.find(hotel => hotel[4].id === day.stayBookingId) || matches.at(-1);
      if (booking) {
        day.stayManaged = true; day.stayBookingId = booking[4].id; day.hotel = booking[1];
      } else if (day.stayManaged) { day.hotel = '—'; delete day.stayBookingId; }
    });
    return visible;
  }
  const area = hotel => String(hotel?.[4]?.city || (String(hotel?.[2] || '').includes('·') ? String(hotel[2]).split('·')[0] : '')).trim();
  function areaForDay(bookings, day, hidden = new Set()) {
    const matches = bookings.filter(hotel => !hidden.has(`${hotel[0]}|${hotel[1]}|${hotel[2]}`) && covers(hotel, day?.iso));
    const booking = matches.find(hotel => hotel[4]?.id === day?.stayBookingId) || matches.at(-1);
    return area(booking) || day?.city || '';
  }
  globalThis.OrbisStays = { prepare, synchronize, covers, nextDate, validDate, area, areaForDay };
})();

if (typeof document !== 'undefined') (() => {
  const S = window.OrbisStays;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const visible = () => { S.prepare(hotels, days); return S.synchronize(hotels, days, hiddenHotelBookings); };
  const find = day => visible().find(hotel => hotel[4].id === day?.stayBookingId);
  let editing = null;
  const dialog = document.createElement('dialog'); dialog.id = 'stay-edit-dialog';
  dialog.innerHTML = `<form id="stay-edit-form"><button class="close-modal" type="button" data-stay-close aria-label="Close">×</button><p class="eyebrow">STAYS & BOOKINGS · 住宿与预订</p><h2>Change your stay</h2><label>Hotel name · 酒店名称<input name="name" required></label><div class="stay-dates"><label>Check-in date · 入住日期<input name="checkinDate" type="date" required></label><label>Time<input name="checkinTime" type="time" value="15:00"></label><label>Check-out date · 退房日期<input name="checkoutDate" type="date" required></label><label>Time<input name="checkoutTime" type="time" value="11:00"></label></div><label>City / confirmation · 城市与预订信息<input name="details"></label><label>Booking link · 预订链接<input name="link" type="url"></label><p class="stay-link-note">Updates every night from check-in through the night before check-out. · 自动同步入住日至退房前一晚的所有行程页。</p><button type="submit" class="primary-btn">Save stay · 保存住宿</button><button type="button" class="cancel-add" data-stay-close>Cancel</button></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  form.querySelector('.stay-link-note').insertAdjacentHTML('beforebegin', '<label>City / area · 城市与区域<input name="city"></label><label>Address · 酒店地址<input name="address"></label><label>Map link · 地图链接<input name="map" type="url"></label>');
  const field = name => form.elements.namedItem(name);
  dialog.querySelectorAll('[data-stay-close]').forEach(button => button.onclick = () => dialog.close());
  dialog.addEventListener('close', () => { editing = null; });
  const basePersist = window.persistTrip;
  window.persistTrip = function () { visible(); basePersist(); };
  function openEdit(hotel, day = days[selected]) {
    visible(); editing = hotel || null;
    const info = hotel?.[4] || {};
    const values = { name: hotel?.[1] || '', city: S.area(hotel), details: hotel?.[2] || day?.city || '', link: hotel?.[3] || '', address: info.address || '', map: info.map || '', checkinDate: info.checkinDate || day?.iso || '', checkoutDate: info.checkoutDate || (day?.iso ? S.nextDate(day.iso) : ''), checkinTime: info.checkinTime || '15:00', checkoutTime: info.checkoutTime || '11:00' };
    Object.entries(values).forEach(([key, value]) => { field(key).value = value; });
    field('checkoutDate').setCustomValidity(''); dialog.showModal();
  }
  function saveHotel(data, hotel) {
    const start = data.get('checkinDate'), end = data.get('checkoutDate');
    if (!S.validDate(start) || !S.validDate(end) || end <= start) return false;
    const info = { ...(hotel?.[4] || {}), city: String(data.get('city') ?? hotel?.[4]?.city ?? '').trim(), address: String(data.get('address') ?? hotel?.[4]?.address ?? '').trim(), map: String(data.get('map') ?? hotel?.[4]?.map ?? '').trim(), id: hotel?.[4]?.id || crypto.randomUUID(), migrated: true, checkinDate: start, checkoutDate: end, checkinTime: data.get('checkinTime') || '15:00', checkoutTime: data.get('checkoutTime') || '11:00' };
    const next = [`${start} ${info.checkinTime} → ${end} ${info.checkoutTime}`, String(data.get('name')).trim(), String(data.get('details') || ''), String(data.get('link') || ''), info];
    if (hotel) {
      hiddenHotelBookings.delete(hotelBookingKey(hotel)); hotel.splice(0, 5, ...next);
    } else hotels.push(next);
    visible(); persistBookings(); renderHotels(); if (days[selected]) renderItinerary();
    return true;
  }
  form.onsubmit = event => {
    event.preventDefault();
    field('checkoutDate').setCustomValidity('');
    if (!saveHotel(new FormData(form), editing)) {
      field('checkoutDate').setCustomValidity('Check-out must be after check-in. · 退房日期必须晚于入住日期。'); field('checkoutDate').reportValidity(); return;
    }
    dialog.close(); toast('Stay updated · all matching nights synchronized');
  };
  field('checkoutDate').oninput = field('checkinDate').oninput = () => field('checkoutDate').setCustomValidity('');
  const baseHotels = window.renderHotels;
  window.renderHotels = function () {
    visible(); baseHotels();
    document.querySelectorAll('[data-delete-hotel]').forEach(button => {
      const hotel = hotels[Number(button.dataset.deleteHotel)], card = button.closest('.hotel-card');
      card.id = `stay-${hotel[4].id}`;
      if (hotel[3]) card.querySelector('.hotel-actions a').href = hotel[3];
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'stay-edit-button'; edit.textContent = 'Edit stay · 修改酒店'; edit.onclick = () => openEdit(hotel);
      button.before(edit);
      const remove = button.onclick;
      button.onclick = () => { remove(); visible(); persistTrip(); if (days[selected]) renderItinerary(); };
    });
    const add = document.querySelector('#hotel-booking-form');
    if (add) {
      add.insertAdjacentHTML('beforeend', '<label>City / area · 城市与区域<input name="city"></label><label>Address · 酒店地址<input name="address"></label><label>Map link · 地图链接<input name="map" type="url"></label>');
      add.onsubmit = event => {
        event.preventDefault(); const end = add.elements.namedItem('checkoutDate'); end.setCustomValidity('');
        if (!saveHotel(new FormData(add), null)) { end.setCustomValidity('Check-out must be after check-in.'); end.reportValidity(); }
        else toast('Stay added · matching nights synchronized');
      };
      add.addEventListener('input', () => add.elements.namedItem('checkoutDate').setCustomValidity(''));
    }
  };
  const baseItinerary = window.renderItinerary;
  window.renderItinerary = function () {
    visible(); if (!days[selected]) return;
    baseItinerary();
    const day = days[selected], booking = find(day), box = document.querySelector('.hotel-context');
    if (!box) return;
    const departing = visible().find(hotel => hotel[4]?.checkoutDate === day.iso);
    const status = booking ? `${booking[4].checkinDate === day.iso ? 'Check in from' : 'Staying tonight'} · ${booking[4].checkinDate === day.iso ? booking[4].checkinTime : `Check out ${booking[4].checkoutDate} ${booking[4].checkoutTime}`}` : departing ? `Check out today · ${departing[4].checkoutTime}` : 'Add a dated booking to link this night';
    box.querySelector('b').textContent = booking ? booking[1] : day.hotel && day.hotel !== '—' ? day.hotel : 'No stay tonight';
    box.querySelector('small').textContent = status;
    const meta = document.querySelector('#day-meta span:last-child b'); if (meta) meta.textContent = status;
    box.querySelectorAll('.stay-change-button,.stay-choice').forEach(element => element.remove());
    const details = box.querySelector('button');
    if (details) {
      details.textContent = booking ? 'View booking details · 查看预订' : 'Add stay · 添加住宿';
      details.onclick = () => {
        if (!booking) return openEdit(null, day);
        renderHotels(); showPage('stays');
        const card = document.getElementById(`stay-${booking[4].id}`); card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card?.classList.add('stay-highlight'); setTimeout(() => card?.classList.remove('stay-highlight'), 2500);
      };
    }
    if (booking) {
      const change = document.createElement('button'); change.type = 'button'; change.className = 'stay-change-button'; change.textContent = 'Change hotel · 更换酒店'; change.onclick = () => openEdit(booking, day); box.append(change);
    }
    const matches = visible().filter(hotel => S.covers(hotel, day.iso));
    if (matches.length > 1) {
      const choice = document.createElement('label'); choice.className = 'stay-choice';
      choice.innerHTML = `Multiple stays · 选择今晚酒店<select aria-label="Choose tonight’s hotel">${matches.map(hotel => `<option value="${safe(hotel[4].id)}" ${hotel === booking ? 'selected' : ''}>${safe(hotel[1])}</option>`).join('')}</select>`;
      choice.querySelector('select').onchange = event => { day.stayBookingId = event.target.value; persistTrip(); renderItinerary(); }; box.append(choice);
    }
  };
  visible(); persistTrip(); renderHotels(); if (days[selected]) renderItinerary();
})();
