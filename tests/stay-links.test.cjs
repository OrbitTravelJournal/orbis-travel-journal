const assert = require('node:assert/strict');
require('../stay-links.js');
const S = globalThis.OrbisStays;
const days = [
  { iso: '2026-10-29', hotel: 'Osaka' }, { iso: '2026-10-30', hotel: 'Kyoto' },
  { iso: '2026-10-31', hotel: 'Kyoto' }, { iso: '2026-11-01', hotel: '—' },
  { iso: '2026-11-05', hotel: 'Osaka' }, { iso: '2026-11-06', hotel: 'Osaka' }
];
const hotels = [['29 OCT', 'Osaka', 'Confirmed'], ['30 OCT', 'Kyoto', 'Confirmed'], ['05 NOV', 'Osaka', 'Confirmed']];
let id = 0; S.prepare(hotels, days, () => String(++id)); S.synchronize(hotels, days);
assert.equal(hotels[1][4].checkoutDate, '2026-11-01');
assert.equal(days[2].stayBookingId, hotels[1][4].id);
assert.equal(days[3].hotel, '—', 'checkout day has no overnight stay');
hotels[1][1] = 'Replacement Kyoto'; S.synchronize(hotels, days);
assert.equal(days[1].hotel, 'Replacement Kyoto'); assert.equal(days[2].hotel, 'Replacement Kyoto');
assert.equal(days[4].hotel, 'Osaka', 'another booking for the same original name is unaffected');
hotels[1][4].checkoutDate = '2026-10-31'; S.synchronize(hotels, days);
assert.equal(days[2].hotel, '—', 'shortening a booking clears its old night');
const hidden = new Set([`${hotels[1][0]}|${hotels[1][1]}|${hotels[1][2]}`]); S.synchronize(hotels, days, hidden);
assert.equal(days[1].hotel, '—', 'deleted bookings are removed from tonight');
const imported = [['2027-01-02 16:00 → 2027-01-05 10:30', 'New Hotel', '']];
S.prepare(imported, [], () => 'imported');
assert.equal(imported[0][4].checkinTime, '16:00'); assert.equal(imported[0][4].checkoutTime, '10:30');
assert.equal(S.covers(imported[0], '2027-01-04'), true); assert.equal(S.covers(imported[0], '2027-01-05'), false);
assert.equal(S.nextDate('2026-12-31'), '2027-01-01');
console.log('Stay linking passed: legacy migration, all nights, replacement, date edits, deletion, same hotel on separate dates, checkout boundary.');
