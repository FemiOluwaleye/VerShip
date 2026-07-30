/*
 * One-time migration: drop providerDetails."basePrice".
 * Run once per environment:
 *   node server/migrate-drop-provider-baseprice.js
 *
 * The column held a copy of the forwarder's per-barrel rate-card price so the
 * public /forwarders listing could show a headline number without joining
 * barrelsprices. Nothing kept the copy in step with the card it copied:
 *
 *   - completeProfile wrote it from a top-level form field and only fell back
 *     to the card when that field was empty, so one request could save a fresh
 *     card and a stale listing price;
 *   - an empty field became the string "0", advertising $0;
 *   - it took the first card of a multi-card provider, arbitrarily;
 *   - migrate-pricing-v2.js and the seed scripts wrote barrelsprices without
 *     touching it at all.
 *
 * The listing now derives its price from the cards via headlinePrice() in
 * website/src/utils/pricing.js — the same selection the quote uses — so the
 * column has no readers left and drift is structurally impossible.
 *
 * BEFORE RUNNING: deploy the code that stops reading the column. Running this
 * against an environment still serving the old bundle will break /forwarders.
 *
 * This DROPs a column. It is idempotent (IF EXISTS) but NOT reversible — the
 * stored values are discarded. They are recoverable from the rate cards, which
 * is the point, but take a dump first if you want the exact prior bytes:
 *   pg_dump --table='"providerDetails"' "$DB_URL" > providerDetails.sql
 */
const db = require('./models');

(async () => {
    const q = db.sequelize;

    const [cols] = await q.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'providerDetails' AND column_name = 'basePrice'
    `);

    if (!cols.length) {
        console.log('providerDetails."basePrice" is already gone — nothing to do.');
        process.exit(0);
    }

    // Report what is being discarded, so the run is auditable from the log.
    const [[{ count }]] = await q.query(`
        SELECT COUNT(*) AS count FROM "providerDetails"
        WHERE COALESCE("basePrice", '') NOT IN ('', '0')
    `);
    console.log(`Dropping providerDetails."basePrice" (${count} row(s) held a non-zero value).`);

    await q.query('ALTER TABLE "providerDetails" DROP COLUMN IF EXISTS "basePrice"');
    console.log('Done. providerDetails."basePrice" dropped.');
    process.exit(0);
})().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
