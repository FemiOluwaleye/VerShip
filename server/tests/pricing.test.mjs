// Asserts the server pricing module (source of truth for charges) agrees with
// the client display module on a fixture set, and that the due-now / later
// split adds up to the old single total.   Run: node server/tests/pricing.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as client from '../../website/src/utils/pricing.js';
const require = createRequire(import.meta.url);
const server = require('../helper/pricing.js');

const parishFees = JSON.stringify({
  'Kingston': { first: 25, additional: 10 }, 'St. Andrew': { first: 25, additional: 10 },
  'St. James': { first: 40, additional: 15 }, 'Portland': '55',
});
const v2own = { type: 'own', originCountry: 'Pittsburgh, PA', destinationCountry: 'Kingston, Jamaica', seaFreightPrice: '150', discount5to9: '10', discount10plus: '25', pickupCharge: '20', pickupRadius: '15', extraMileageCost: '1.5', parishFees };
const v2drop = { type: 'dropoff', originCountry: 'Pittsburgh, PA', destinationCountry: 'Kingston, Jamaica', seaFreightPrice: '60', parishFees };
const legacyOwn = { type: 'own', originCountry: 'Miami, FL', destinationCountry: 'Kingston, Jamaica', barrelPrice: '120', basePrice: '120', isVolumeDiscount: 1, discountAfter: 4, discountPercent: 10, customsAndHandling: '30,35,40,45,,,,,,,,,,,,,,,,,,,,,', flatPickupCharge: '15,15,20', flatDeliveryCharge: '10', pickupFreeMiles: '10', pickupPerMileCharge: '2', deliveryFreeMiles: '0', deliveryPerMileCharge: '0', pricePerMile: '5' };
const staleLegacy = { type: 'own', originCountry: 'Pittsburgh, PA', destinationCountry: 'Kingston, Jamaica', barrelPrice: '999' };
const cards = [staleLegacy, v2own, v2drop, legacyOwn];

const fixtures = [
  { name: 'v2 own 1 barrel Kingston', type: 'own', origin: 'Pittsburgh, PA', destination: 'Kingston, Jamaica', quantity: 1, parish: 'Kingston', pickupMiles: 5 },
  { name: 'v2 own 5 barrels St. James, beyond radius', type: 'own', origin: 'Pittsburgh, PA', destination: 'Kingston, Jamaica', quantity: 5, parish: 'St. James', pickupMiles: 25 },
  { name: 'v2 own 10 barrels Portland (scalar fee)', type: 'own', origin: 'Pittsburgh, PA', destination: 'Kingston, Jamaica', quantity: 10, parish: 'Portland', pickupMiles: 0 },
  { name: 'v2 own 3 barrels + dropoff add-on', type: 'own', origin: 'Pittsburgh, PA', destination: 'Kingston, Jamaica', quantity: 3, parish: 'St. Andrew', pickupMiles: 0, dropoffAddon: true },
  { name: 'v2 dropoff 2 barrels', type: 'dropoff', origin: 'Pittsburgh, PA', destination: 'Kingston, Jamaica', quantity: 2, parish: 'Kingston' },
  { name: 'v2 own no parish yet', type: 'own', origin: 'Pittsburgh, PA', destination: 'Kingston, Jamaica', quantity: 1, parish: '', pickupMiles: 0 },
  { name: 'legacy own 2 barrels', type: 'own', origin: 'Miami, FL', destination: 'Kingston, Jamaica', quantity: 2, pickupMiles: 12, deliveryMiles: 3 },
  { name: 'legacy own 6 barrels (volume discount, CSV walk-back)', type: 'own', origin: 'Miami, FL', destination: 'Kingston, Jamaica', quantity: 6, pickupMiles: 0, deliveryMiles: 0 },
];

const pct = { adminCommissionPct: 10, serviceFeePct: 12 };
let n = 0;
for (const f of fixtures) {
  const q = server.computeQuote({ barrelPrices: cards, ...f, ...pct });
  assert.ok(q, `${f.name}: quote computed`);

  // Card selection must match the client's rule.
  const clientCard = client.selectRateCard(cards, { type: f.type, origin: f.origin, destination: f.destination });
  assert.equal(q.card, clientCard, `${f.name}: same rate card`);

  // Barrel line, parish fee, pickup, fees — recomputed with the client module.
  const v2 = client.isPricingV2(clientCard);
  const b = v2
    ? client.calculateBarrelPricingV2({ quantity: f.quantity, barrelPrices: clientCard })
    : client.calculateBarrelPricing({ quantity: f.quantity, perBarrelPrice: clientCard.barrelPrice, isVolumeDiscount: clientCard.isVolumeDiscount, discountAfter: clientCard.discountAfter, discountPercent: clientCard.discountPercent });
  assert.equal(q.barrels.lineTotal, server.round2(b.barrelPrice), `${f.name}: barrel line`);
  if (v2) {
    assert.equal(q.customsDelivery, server.round2(client.v2ParishFee(clientCard, f.parish, f.quantity)), `${f.name}: parish fee`);
    if (f.type === 'own') assert.equal(q.pickup.total, client.v2PickupCharge(clientCard, f.pickupMiles).total, `${f.name}: pickup`);
  }
  const fees = client.calculateBarrelBasedFees(b.barrelPrice, pct.adminCommissionPct, pct.serviceFeePct);
  assert.equal(q.commissionAmount, server.round2(fees.commissionAmount), `${f.name}: commission`);
  assert.equal(q.serviceFeeAmount, server.round2(fees.serviceFeeAmount), `${f.name}: service fee`);

  // The split must add up, and "later" must be exactly customs & delivery.
  assert.equal(q.total, server.round2(q.dueNow.total + q.later.total), `${f.name}: split sums`);
  const laterKeys = q.later.lines.map((l) => l.key);
  assert.ok(laterKeys.every((k) => ['customs_delivery', 'delivery'].includes(k)), `${f.name}: later = customs/delivery only`);
  assert.ok(!q.dueNow.lines.some((l) => ['customs_delivery', 'delivery'].includes(l.key)), `${f.name}: nothing post-arrival in due-now`);
  n++;
  console.log(`✅ ${f.name}: now $${q.dueNow.total} / later $${q.later.total} / total $${q.total}`);
}

// Spot values, hand-computed.
const k1 = server.computeQuote({ barrelPrices: cards, ...fixtures[0], ...pct });
assert.equal(k1.dueNow.total, 150 + 20 + 15 + 18, 'K1 due now = 150 sea + 20 pickup + 10% + 12%');
assert.equal(k1.later.total, 25, 'K1 later = Kingston first-barrel fee');
const sj5 = server.computeQuote({ barrelPrices: cards, ...fixtures[1], ...pct });
assert.equal(sj5.barrels.lineTotal, 5 * 140, '5 barrels at tier 5-9 = 140 each');
assert.equal(sj5.pickup.total, 20 + 10 * 1.5, 'pickup 20 flat + 10 extra miles × 1.5');
assert.equal(sj5.later.total, 40 + 4 * 15, 'St. James 40 first + 4 × 15');
const noParish = server.computeQuote({ barrelPrices: cards, ...fixtures[5], ...pct });
assert.equal(noParish.later.needsParish, true, 'later flagged as needing a parish');
const leg6 = server.computeQuote({ barrelPrices: cards, ...fixtures[7], ...pct });
assert.equal(leg6.barrels.lineTotal, 6 * 108, 'legacy volume discount 10% after 4');
assert.equal(leg6.customsDelivery, 45, 'legacy CSV walks back to slot 4 for qty 6');
assert.equal(leg6.pickup.total, 15, 'legacy non-25-slot pickup CSV is a flat fee (first slot)');

console.log(`\n${n} fixtures + spot checks passed`);
