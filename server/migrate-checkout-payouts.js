/*
 * One-time migration for the checkout redesign / milestone payments / held payouts.
 * Run once per environment (boot sync uses alter:false, so enum values and new
 * columns on existing tables are NOT auto-applied; new tables ARE created by sync):
 *   node server/migrate-checkout-payouts.js
 *
 * 1. bookings.status gains '5' = Arrived in Jamaica (customs & delivery trigger).
 * 2. users gains account_state / setup_token / setup_token_expires (guest checkout).
 * 3. booking_charges, forwarder_payouts, job_runs tables exist (sync creates them;
 *    this script also creates them so it can be run before a restart).
 * 4. Every booking_additional_costs row is copied into booking_charges as
 *    kind='extra' (once — keyed by legacy_additional_cost_id).
 * 5. Every already-paid booking gets a 'deposit' row for what was paid, so
 *    History / admin can show one consistent list (once — keyed by booking_id).
 * Idempotent: re-running is a no-op.
 */
const db = require('./models');

(async () => {
  const q = db.sequelize;
  const log = (m) => console.log(`[migrate-checkout-payouts] ${m}`);

  // 1. enum value — cannot run inside a transaction on Postgres.
  const [enumRows] = await q.query(`
    SELECT e.enumlabel FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'enum_bookings_status'`);
  if (enumRows.length && !enumRows.some((r) => r.enumlabel === '5')) {
    await q.query(`ALTER TYPE enum_bookings_status ADD VALUE '5'`);
    log("bookings.status: added '5' (Arrived in Jamaica)");
  } else {
    log(enumRows.length ? "bookings.status already has '5'" : 'bookings.status is not a PG enum — nothing to add');
  }

  // 2. users columns
  for (const [col, ddl] of [
    ['account_state', "VARCHAR(32) NOT NULL DEFAULT 'active'"],
    ['setup_token', 'VARCHAR(128) NULL'],
    ['setup_token_expires', 'TIMESTAMP WITH TIME ZONE NULL'],
  ]) {
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "${col}" ${ddl}`);
  }
  log('users: account_state / setup_token / setup_token_expires present');

  // 3. new tables. models/index.js kicks off its own sync() on require, so the
  // first attempt can collide with it on index creation — wait it out and retry.
  for (let attempt = 1; ; attempt++) {
    try {
      await db.booking_charges.sync();
      await db.forwarder_payouts.sync();
      await db.job_runs.sync();
      break;
    } catch (e) {
      if (attempt >= 5) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  await q.query(`ALTER TABLE booking_charges ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER NOT NULL DEFAULT 0`);
  log('booking_charges / forwarder_payouts / job_runs tables present');

  // 4. additional costs → booking_charges(extra)
  const [copied] = await q.query(`
    INSERT INTO booking_charges
      (booking_id, provider_id, user_id, kind, description, amount_cents, currency, status,
       due_trigger, payment_intent_id, paid_at, legacy_additional_cost_id, "createdAt", "updatedAt")
    SELECT c.booking_id, c.provider_id, c.user_id, 'extra', c.description,
           ROUND(CAST(c.amount AS NUMERIC) * 100)::int, 'usd',
           CASE c.status WHEN '1' THEN 'paid' WHEN '2' THEN 'cancelled' ELSE 'pending' END,
           'manual', c.transaction_id,
           CASE c.status WHEN '1' THEN c."updatedAt" ELSE NULL END,
           c.id, c."createdAt", c."updatedAt"
    FROM booking_additional_costs c
    WHERE NOT EXISTS (SELECT 1 FROM booking_charges b WHERE b.legacy_additional_cost_id = c.id)
    RETURNING id`);
  log(`booking_additional_costs → booking_charges(extra): ${copied.length} copied`);

  // 5. deposit rows for bookings that were already paid under the pay-all-upfront model
  const [deposits] = await q.query(`
    INSERT INTO booking_charges
      (booking_id, provider_id, user_id, kind, description, amount_cents, currency, status,
       due_trigger, payment_intent_id, paid_at, "createdAt", "updatedAt")
    SELECT b.id, b."driverId", b."userId", 'deposit', 'Shipment (paid in full)',
           ROUND(CAST(COALESCE(b.pay_now_price, b.total_amount, 0) AS NUMERIC) * 100)::int, 'usd', 'paid',
           'checkout', b.trasaction_id, b."updatedAt", b."createdAt", b."updatedAt"
    FROM bookings b
    WHERE b.payment_status = 1 AND b."driverId" IS NOT NULL AND b."userId" IS NOT NULL
      AND COALESCE(b.pay_now_price, b.total_amount, 0) > 0
      AND NOT EXISTS (SELECT 1 FROM booking_charges c WHERE c.booking_id = b.id AND c.kind = 'deposit')
    RETURNING id`);
  log(`historical paid bookings → deposit rows: ${deposits.length} created`);

  log('done');
  process.exit(0);
})().catch((e) => {
  console.error('[migrate-checkout-payouts] FAILED:', e.message);
  process.exit(1);
});
