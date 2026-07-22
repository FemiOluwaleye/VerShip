/*
 * One-time migration: consolidated freight-forwarder signup.
 * Run once per environment (boot sync uses alter:false so new columns are NOT auto-created):
 *   node server/migrate-signup-consolidation.js
 *
 * The onboarding flow collapsed from 6 profile steps to:
 *   signup (all business details at once) -> OTP -> documents -> pricing.
 *
 * Adds:
 *   users.zip                            - postal/zip code (parsed from Google Places)
 *   providerDetails.zip                  - postal/zip code of the business address
 *   providerDetails.primaryContactEmail  - primary contact person's email
 *
 * Backfills so legacy mid-onboarding providers survive the new step routing
 * (login now resumes step<=3 at documents, step>=4 at pricing):
 *   - role-2 users missing a providerDetails row get one seeded from users
 *     (businessName<-firstName, address/geo, email, phone)
 *   - empty deliveryTimeline defaults to "21 Days" (old step 5 choice)
 *   - providers with no serviceAreaRoutes row get USA / Sea (old step 6 choice)
 * Idempotent: IF NOT EXISTS columns, backfills only fill blanks.
 */
const db = require('./models');

(async () => {
  const q = db.sequelize;

  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "zip" VARCHAR(50) DEFAULT ''`);
  await q.query(`ALTER TABLE "providerDetails" ADD COLUMN IF NOT EXISTS "zip" VARCHAR(50) DEFAULT ''`);
  await q.query(`ALTER TABLE "providerDetails" ADD COLUMN IF NOT EXISTS "primaryContactEmail" VARCHAR(255) DEFAULT ''`);
  console.log('Columns ensured.');

  // ---- providerDetails rows for role-2 users that never reached old step 2 ----
  const orphans = await q.query(
    `SELECT u.id, u."firstName", u.location, u.latitude, u.longitude, u."streetAddress",
            u.city, u.state, u.email, u."phoneNumber"
       FROM users u
       LEFT JOIN "providerDetails" pd ON pd."providerId" = u.id
      WHERE u.role = '2' AND u."deletedAt" IS NULL AND pd.id IS NULL`,
    { type: q.QueryTypes.SELECT }
  );
  for (const u of orphans) {
    await db.providerDetails.create({
      providerId: u.id,
      businessName: u.firstName || '',
      countryOfRegistration: 'USA',
      businessAddress: u.location || '',
      businessLatitude: u.latitude || '',
      businessLongitude: u.longitude || '',
      streetAddress: u.streetAddress || '',
      city: u.city || '',
      state: u.state || '',
      email: u.email || '',
      phone: u.phoneNumber || '',
      deliveryTimeline: '21 Days',
    });
  }
  console.log(`providerDetails backfilled for ${orphans.length} provider(s) without a row.`);

  // ---- Default the choices the deleted steps used to collect ----
  const [, timeline] = await q.query(
    `UPDATE "providerDetails" SET "deliveryTimeline" = '21 Days' WHERE COALESCE("deliveryTimeline", '') = ''`
  );
  console.log(`deliveryTimeline defaulted on ${timeline?.rowCount ?? 0} row(s).`);

  const noRoutes = await q.query(
    `SELECT u.id FROM users u
       LEFT JOIN "serviceAreaRoutes" r ON r."providerId" = u.id AND r."deletedAt" IS NULL
      WHERE u.role = '2' AND u."deletedAt" IS NULL AND r.id IS NULL`,
    { type: q.QueryTypes.SELECT }
  );
  for (const u of noRoutes) {
    await db.serviceAreaRoutes.create({ providerId: u.id, country: 'USA', freightType: 2 });
  }
  console.log(`serviceAreaRoutes (USA/Sea) created for ${noRoutes.length} provider(s).`);

  console.log('Done.');
  process.exit(0);
})().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
