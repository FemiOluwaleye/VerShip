// Seed ONE fully-matching freight forwarder so "Get quotes" returns real quotes
// for every US origin the homepage Banner offers, on BOTH service types
// ("Ship Your Own Barrel" => own, "Request Barrel Drop-Off" => dropoff), all
// shipping to Kingston, Jamaica. Attaches to the existing
// e2e-provider@vership.test user (role 2).
//
// The Banner origin dropdown only ENABLES an origin when a provider has a
// barrelsprices row whose originCountry matches (and getAvailableQuotes matches
// origin/destination by exact string), so the origin strings below must match
// Banner's ORIGINS list character-for-character.
require('dotenv').config();
const db = require('./models');

// Must match ORIGINS in website/src/components/Banner.jsx exactly.
const ORIGINS = [
  { name: 'Fort Lauderdale, FL', lat: '26.1224', lng: '-80.1373' },
  { name: 'Miami, FL', lat: '25.7617', lng: '-80.1918' },
  { name: 'Pittsburgh, PA', lat: '40.4387', lng: '-79.9972' },
  { name: 'Orlando, FL', lat: '28.4778279', lng: '-81.2880713' },
];
const DESTINATION = { name: 'Kingston, Jamaica', lat: '17.9854994', lng: '-76.8078474' };
const TYPES = ['own', 'dropoff'];

(async () => {
  try {
    await db.sequelize.authenticate();
    const provider = await db.users.findOne({ where: { email: 'e2e-provider@vership.test' } });
    if (!provider) throw new Error('e2e-provider user not found; run seed-test-users.js first');
    const pid = provider.id;

    // provider user must be "activated" for quotes (hashAccount='1')
    await provider.update({ hashAccount: '1', documentVerify: '1', status: '1' });

    // providerDetails (documentVerify:1 required by getAvailableQuotes)
    const pdBase = {
      providerId: pid,
      businessName: 'E2E Test Forwarders',
      countryOfRegistration: 'USA',
      businessAddress: 'Pittsburgh, PA',
      originCountry: 'Pittsburgh, PA',
      destinationCountry: DESTINATION.name,
      shipmentType: 'ship your own barrel',
      documentVerify: 1,
      email: provider.email,
      phone: '5550100test',
      transitTime: '14-21 days',
      validFrom: null,
      validTo: null,
    };
    let pd = await db.providerDetails.findOne({ where: { providerId: pid } });
    if (pd) await pd.update(pdBase); else pd = await db.providerDetails.create(pdBase);

    // barrelsprices linked by providerId == user id (sourceKey providerId).
    // Rebuild the full set idempotently: one row per origin x service type.
    await db.barrelsprices.destroy({ where: { providerId: pid } });
    const rows = [];
    for (const origin of ORIGINS) {
      for (const type of TYPES) {
        rows.push({
          providerId: pid,
          type,
          barrelPrice: '150',
          basePrice: '150',
          pricePerMile: '2',
          freeMiles: '10',
          barrelNumber: '25',
          originCountry: origin.name,
          originLat: origin.lat,
          originLong: origin.lng,
          destinationCountry: DESTINATION.name,
          destinationLat: DESTINATION.lat,
          destinationLong: DESTINATION.lng,
          transitTime: '14-21 days',
          customsAndHandling: 'Included',
        });
      }
    }
    const created = await db.barrelsprices.bulkCreate(rows);

    // a shipment item type row (used by saveBookingRequest match path)
    const sitExisting = await db.provider_shipment_item_types.findOne({ where: { provider_detail_id: pd.id } });
    if (!sitExisting) {
      await db.provider_shipment_item_types.create({ provider_detail_id: pd.id, item_type: 'barrel' });
    }

    console.log(
      'Seeded provider fixture: user', pid, 'providerDetails', pd.id,
      '- barrelPrices:', created.length, `(${ORIGINS.length} origins x ${TYPES.length} types)`
    );
    process.exit(0);
  } catch (e) {
    console.error('SEED PROVIDER FAILED:', e);
    process.exit(1);
  }
})();
