/* Shared, deterministic route and timing calculations. No paid API required. */
(() => {
  const minutes = value => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const clock = value => value == null ? '—' : `${value >= 1440 ? '+1 day ' : ''}${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const duration = item => {
    const text = String(item[4] || '');
    const hours = text.match(/(\d+)\s*h/i), mins = text.match(/(\d+)\s*m/i);
    return hours || mins ? Number(hours?.[1] || 0) * 60 + Number(mins?.[1] || 0) : item[1] === 'Meal' ? 75 : 60;
  };
  const locationKey = (item, day) => JSON.stringify([item[5]?.place || (item[1] === 'Stay' ? item[3] : item[2]), item[5]?.address || '', item[5]?.city || day.city || '', item[5]?.country || day.country || '', item[5]?.map || '']);
  const coords = (item, day) => {
    const extra = item[5] || {};
    if (extra.locationKey !== locationKey(item, day)) return null;
    const pair = extra.coordinates;
    return Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite) && Math.abs(pair[0]) <= 90 && Math.abs(pair[1]) <= 180 ? pair : null;
  };
  const distance = (a, b) => {
    const rad = value => value * Math.PI / 180;
    const n = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(n), Math.sqrt(1 - Math.min(1, n)));
  };
  function leg(from, to, day) {
    const a = coords(from, day), b = coords(to, day);
    if (!a || !b) return { minutes: null, mode: to[5]?.travelMode || 'auto' };
    const km = distance(a, b), mode = to[5]?.travelMode && to[5].travelMode !== 'auto' ? to[5].travelMode : km <= 2 ? 'walking' : 'driving';
    if (km < .05) return { minutes: 0, mode, km };
    const speeds = { walking: 4.5, cycling: 15, driving: 35, transit: 25 };
    // Straight-line distance plus a route allowance, not live traffic or a routed ETA.
    return { minutes: Math.ceil((km * 1.3 / (speeds[mode] || 35) * 60 + (mode === 'transit' ? 10 : 0)) / 5) * 5, mode, km };
  }
  function plan(day) {
    let cursor = minutes(day.planStart || day.items[0]?.[0]) ?? 540;
    return day.items.map((item, index) => {
      const travel = index ? leg(day.items[index - 1], item, day) : { minutes: 0, mode: 'auto' };
      if (index) cursor = cursor == null || travel.minutes == null ? null : cursor + travel.minutes;
      const extra = item[5] || {}, fixed = extra.fixedTime ? minutes(item[0]) : null, opens = minutes(extra.opens), closes = minutes(extra.closes);
      let conflict = fixed != null && cursor != null && cursor > fixed ? 'Arrival after fixed time' : '';
      if (fixed != null) cursor = fixed;
      if (fixed != null && opens != null && fixed < opens) conflict = 'Fixed time is before opening';
      if (fixed == null && cursor != null && opens != null) cursor = Math.max(cursor, opens);
      const start = cursor, end = start == null ? null : start + duration(item);
      if (closes != null && opens != null && closes < opens) {
        if (end != null && end > closes + 1440) conflict = 'Visit extends past closing';
      } else if (end != null && closes != null && end > closes) conflict = 'Visit extends past closing';
      cursor = end;
      return { start, end, travel, conflict };
    });
  }
  const setText = (selector, text) => {
    const element = document.querySelector(selector);
    if (element && element.textContent !== text) element.textContent = text;
  };
  function updateStats() {
    const day = typeof days !== 'undefined' ? days[selected] : null;
    if (!day?.items?.length) return;
    const rows = plan(day), known = rows.every(row => row.travel.minutes != null && row.end != null);
    const walk = rows.reduce((sum, row) => sum + (row.travel.mode === 'walking' ? row.travel.minutes || 0 : 0), 0);
    setText('#walking-time', `${known ? '≈ ' : '≥ '}${walk} min`);
    setText('#planned-time', known ? `≈ ${Math.floor((rows.at(-1).end - rows[0].start) / 60)}h ${(rows.at(-1).end - rows[0].start) % 60}m` : 'Location needed');
  }
  globalThis.OrbisSchedule = { minutes, clock, duration, locationKey, coords, distance, leg, plan, updateStats };
})();
