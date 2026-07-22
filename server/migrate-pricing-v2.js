/*
 * One-time migration: simplified barrel pricing model (v2).
 * Run once per environment (boot sync uses alter:false so new columns are NOT auto-created):
 *   node server/migrate-pricing-v2.js
 *
 * Adds to barrelsprices:
 *   pickupCharge      - flat pickup-barrel charge ($)
 *   pickupRadius      - free pickup radius (miles)
 *   extraMileageCost  - $/mile beyond the radius
 *   seaFreightPrice   - per-barrel sea freight (tier 1-4)
 *   discount5to9      - $ off per barrel for 5-9 barrels
 *   discount10plus    - $ off per barrel for 10+ barrels
 *   parishFees        - JSON { "<parish>": "<customs+delivery $>" } for all 14 parishes
 * Adds to booking_requests:
 *   parish            - consignee's destination parish
 *
 * Then auto-maps existing provider rows (legacy fields -> v2 fields) so current
 * forwarders keep working without re-onboarding. Idempotent: columns use IF NOT
 * EXISTS and rows are only mapped when seaFreightPrice is still empty.
 */
const db = require('./models');

const PARISHES = [
  'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary', 'St. Ann',
  'Trelawny', 'St. James', 'Hanover', 'Westmoreland', 'St. Elizabeth',
  'Manchester', 'Clarendon', 'St. Catherine',
];

// First non-empty slot of a legacy 25-slot CSV (or the scalar itself).
const firstSlot = (raw) => {
  if (raw === null || raw === undefined) return 0;
  const first = String(raw).split(',').map((s) => s.trim()).find((s) => s !== '');
  return parseFloat(first) || 0;
};

(async () => {
  const q = db.sequelize;
  const cols = [
    ['pickupCharge', "VARCHAR(255) DEFAULT ''"],
    ['pickupRadius', "VARCHAR(255) DEFAULT ''"],
    ['extraMileageCost', "VARCHAR(255) DEFAULT ''"],
    ['seaFreightPrice', "VARCHAR(255) DEFAULT ''"],
    ['discount5to9', "VARCHAR(255) DEFAULT ''"],
    ['discount10plus', "VARCHAR(255) DEFAULT ''"],
    ['parishFees', 'TEXT'],
  ];
  for (const [name, type] of cols) {
    await q.query(`ALTER TABLE barrelsprices ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
  }
  await q.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS "parish" VARCHAR(255) DEFAULT \'\'');
  console.log('Columns ensured.');

  // ---- Auto-map legacy rows that have no v2 pricing yet ----
  const rows = await q.query(
    `SELECT * FROM barrelsprices WHERE "deletedAt" IS NULL AND (COALESCE("seaFreightPrice", '') = '')`,
    { type: q.QueryTypes.SELECT }
  );
  let mapped = 0;
  for (const r of rows) {
    const sea = parseFloat(r.barrelPrice) || parseFloat(r.basePrice) || 0;
    if (!sea) continue; // nothing meaningful to map

    // Legacy volume discount was percent-off past a threshold; translate to $ tiers.
    const legacyPct = String(r.isVolumeDiscount) === '1' ? parseFloat(r.discountPercent) || 0 : 0;
    const dollarsOff = legacyPct ? Math.round(sea * (legacyPct / 100) * 100) / 100 : 0;

    // Customs + delivery collapse into one per-parish fee: legacy customs slot-1
    // + the flat "Delivery ($)" fee (pricePerMile on dropoff rows) + delivery slot-1.
    const customs = firstSlot(r.customsAndHandling);
    const flatDelivery = r.type === 'dropoff' ? parseFloat(r.pricePerMile) || 0 : firstSlot(r.flatDeliveryCharge);
    const parishFee = Math.round((customs + flatDelivery) * 100) / 100;
    const parishFees = Object.fromEntries(PARISHES.map((p) => [p, String(parishFee)]));

    await q.query(
      `UPDATE barrelsprices SET
         "seaFreightPrice" = :sea,
         "pickupCharge" = :pickup,
         "pickupRadius" = :radius,
         "extraMileageCost" = :perMile,
         "discount5to9" = :d59,
         "discount10plus" = :d10,
         "parishFees" = :fees
       WHERE id = :id`,
      {
        replacements: {
          id: r.id,
          sea: String(sea),
          pickup: r.type === 'own' ? String(firstSlot(r.flatPickupCharge)) : '0',
          radius: r.type === 'own' ? String(parseFloat(r.pickupFreeMiles) || 0) : '0',
          perMile: r.type === 'own' ? String(parseFloat(r.pickupPerMileCharge) || 0) : '0',
          d59: String(dollarsOff),
          d10: String(dollarsOff),
          fees: JSON.stringify(parishFees),
        },
      }
    );
    mapped++;
  }
  console.log(`Auto-mapped ${mapped} legacy pricing row(s) to v2.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
