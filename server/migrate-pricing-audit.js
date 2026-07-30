/*
 * One-time migration: admin pricing audit trail.
 * Run once per environment (boot sync uses alter:false so new tables are NOT
 * auto-created):
 *   node server/migrate-pricing-audit.js
 *
 * Creates pricing_audit — one row per admin edit to a forwarder's rate card
 * (barrelsprices). Admin pricing edits change what customers are quoted for a
 * third party's commercial service, so every write is recorded with the diff,
 * a mandatory reason, and whether the forwarder was notified.
 *
 * Idempotent: CREATE TABLE / CREATE INDEX both use IF NOT EXISTS.
 */
const db = require('./models');

(async () => {
    const q = db.sequelize;

    await q.query(`
        CREATE TABLE IF NOT EXISTS pricing_audit (
            id              SERIAL PRIMARY KEY,
            "adminId"       INTEGER NOT NULL,
            "adminEmail"    VARCHAR(255) NOT NULL DEFAULT '',
            "providerId"    INTEGER NOT NULL,
            "cardId"        INTEGER,
            action          VARCHAR(32) NOT NULL DEFAULT 'update',
            changes         TEXT,
            reason          TEXT NOT NULL DEFAULT '',
            notified        BOOLEAN NOT NULL DEFAULT FALSE,
            "notifyError"   VARCHAR(500),
            "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    console.log('pricing_audit table ensured.');

    await q.query('CREATE INDEX IF NOT EXISTS pricing_audit_provider_idx ON pricing_audit ("providerId")');
    await q.query('CREATE INDEX IF NOT EXISTS pricing_audit_card_idx ON pricing_audit ("cardId")');
    console.log('Indexes ensured.');

    const [[{ count }]] = await q.query('SELECT COUNT(*) AS count FROM pricing_audit');
    console.log(`Done. pricing_audit currently holds ${count} row(s).`);
    process.exit(0);
})().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
