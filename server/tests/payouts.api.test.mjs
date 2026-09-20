// Phase 1 code-level acceptance: gate switch, held charge, ledger idempotence,
// forwarder summary, auto-transfer on onboarding, Collect funds, refund reversal.
// Runs against the live stage server on :5000 + Stripe TEST mode.
//   node server/tests/payouts.api.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require('../models');
const { env } = require('../helper/envConfig');
const stripe = require('stripe')(env('STRIPE_SECRET_KEY'));
const { onPaymentIntentSucceeded, onAccountUpdated } = require('../helper/stripeWebhook');
const payouts = require('../helper/payoutService');

const BASE = process.env.E2E_BASE || 'http://localhost:5000';
const PROVIDER_ID = 417; // e2e-provider: no Stripe account → the "held" path
const ok = (m) => console.log(`✅ ${m}`);

const api = async (path, { method = 'GET', token, body } = {}) => {
    const r = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, ...j };
};
const login = async (email, password) => {
    const r = await api('/website/login', { method: 'POST', body: { email, password } });
    assert.ok(r.body?.authtoken, `login ${email}: ${r.message}`);
    return r.body.authtoken;
};

await new Promise((r) => setTimeout(r, 1500)); // let models sync
const customer = await login('e2e-user@vership.test', 'Test@1234');
const forwarder = await login('e2e-provider@vership.test', 'Test@1234');

// ── reset the fixture forwarder to "no Stripe account, not onboarded" ──
await db.users.update({ accountId: '', hashAccount: '0' }, { where: { id: PROVIDER_ID } });
await db.forwarder_payouts.destroy({ where: { provider_id: PROVIDER_ID } });

// ── 1.1 gate switch: un-onboarded forwarder is quoted; unverified one is not ──
const requestPayload = {
    origin: 'Pittsburgh, PA', destination: 'Kingston, Jamaica', parish: 'St. Andrew',
    pickup_date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    delivery_date: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10),
    items: [{ item_type: 'Barrel', sub_type: 'Ship Your Own Barrel', quantity: 2 }],
    origin_lat: '40.4387', origin_long: '-79.9972', destination_lat: '18.0179', destination_long: '-76.8099',
};
const req = await api('/website/save-booking-request', { method: 'POST', token: customer, body: requestPayload });
assert.ok(req.body?.id, 'booking request saved');
const requestId = req.body.id;
const quotes = await api('/website/get-available-quotes', { token: customer });
const quotedIds = quotes.body.providers.map((p) => p.provider.id);
assert.ok(quotedIds.includes(PROVIDER_ID), `1.1 un-onboarded forwarder ${PROVIDER_ID} is quoted (got ${quotedIds})`);
assert.ok(!quotedIds.includes(396), '1.1 doc-unverified forwarder 396 is NOT quoted');
ok(`1.1 quotes without Stripe gate: ${quotedIds.join(', ')}`);

// ── 0.2 server breakdown ──
const bd = await api(`/website/quote-breakdown?requestId=${requestId}&providerId=${PROVIDER_ID}`, { token: customer });
assert.equal(bd.status, 200, `breakdown: ${bd.message}`);
assert.ok(bd.body.dueNow.total > 0 && bd.body.later.total > 0, '0.2 due now and later both priced');
assert.equal(bd.body.payoutMode, 'held', '0.2 breakdown reports held payout mode');
const noAuth = await fetch(`${BASE}/website/quote-breakdown?requestId=${requestId}&providerId=999999`).then((r) => r.status);
assert.equal(noAuth, 404, '0.2 unknown provider → 404');
ok(`0.2 breakdown: now $${bd.body.dueNow.total} / later $${bd.body.later.total} (${bd.body.parish})`);

// ── 2.1 create booking → deposit + customs_delivery rows ──
const bookingPayload = {
    booking_request_id: requestId, providerIds: [PROVIDER_ID], barrel_type: 'own',
    primary_firstName: 'Elvis', primary_lastName: 'Livingston', primary_phone_number: '5551234', primary_country_code: '+1876', primary_email: 'elvis@example.com',
    primary_address: '15 Molynes Road', primary_city: 'Kingston 10', primary_state: 'St. Andrew',
    shiper_firstName: 'Jane', shiper_lastName: 'Doe', shiper_email: 'jane@example.com', shiper_phone_number: '4125550123', shiper_country_code: '+1',
    shiper_address: '100 Grant St', shiper_city: 'Pittsburgh', shiper_state: 'PA', shiper_lat: '40.4406', shiper_lng: '-79.9959',
    consignee_firstName: 'Elvis', consignee_lastName: 'Livingston', consignee_email: 'elvis@example.com', consignee_phone_number: '5551234', consignee_country_code: '+1876',
    consignee_address: '15 Molynes Road', consignee_city: 'Kingston 10', consignee_state: 'St. Andrew', consignee_lat: '18.0179', consignee_lng: '-76.8099',
};
const cb = await api('/website/create-booking', { method: 'POST', token: customer, body: bookingPayload });
assert.equal(cb.status, 200, `create-booking: ${cb.message}`);
const booking = cb.body.bookings[0];
const { deposit, customsDelivery } = cb.body.charges[0];
assert.equal(deposit.kind, 'deposit'); assert.equal(deposit.status, 'pending');
assert.equal(customsDelivery.kind, 'customs_delivery'); assert.equal(customsDelivery.due_trigger, 'arrived');
assert.equal(deposit.amount_cents + customsDelivery.amount_cents, Math.round(bd.body.total * 100), '2.1 deposit + later = breakdown total');
ok(`2.1 booking ${booking.orderId}: deposit $${deposit.amount_cents / 100} + customs $${customsDelivery.amount_cents / 100}`);

// ── 1.2 held charge: no transfer_data, transfer_group, amount from the DB not the body ──
const pi = await api('/website/create-payment-intent', { method: 'POST', token: customer, body: { bookingId: booking.id, amount: 1, currency: 'usd' } });
assert.equal(pi.status, 200, `intent: ${pi.message}`);
const intent = await stripe.paymentIntents.retrieve(pi.paymentIntentId);
assert.equal(intent.amount, deposit.amount_cents, '1.2 charged amount is the deposit, not the body amount');
assert.equal(intent.transfer_data, null, '1.2 no transfer_data on a held charge');
assert.equal(intent.transfer_group, `booking_${booking.id}`, '1.2 transfer_group set');
assert.equal(intent.metadata.payout_mode, 'held');
ok(`1.2 held PaymentIntent ${intent.id} for $${intent.amount / 100}`);

// pay it with a test card (API-side, equivalent to the Payment Element)
const paid = await stripe.paymentIntents.confirm(intent.id, { payment_method: 'pm_card_visa', return_url: `${BASE}/history` });
assert.equal(paid.status, 'succeeded', 'test card payment succeeded');
const paidFull = await stripe.paymentIntents.retrieve(intent.id, { expand: ['latest_charge'] });

// ── 1.3 ledger via webhook handler, replay-safe ──
await onPaymentIntentSucceeded(paidFull);
await onPaymentIntentSucceeded(paidFull);
const rows = await db.forwarder_payouts.findAll({ where: { provider_id: PROVIDER_ID } });
assert.equal(rows.length, 1, '1.3 exactly one ledger row after replay');
assert.equal(rows[0].amount_owed_cents, deposit.amount_cents - deposit.platform_fee_cents, '1.3 owed = gross − platform fee');
assert.equal(rows[0].status, 'owed');
const dep = await db.booking_charges.findByPk(deposit.id);
assert.equal(dep.status, 'paid', '1.3 deposit charge marked paid');
const bk = await db.bookings.findByPk(booking.id);
assert.equal(String(bk.payment_status), '1', '1.3 booking payment_status=1');
ok(`1.3 ledger row ${rows[0].id}: owed $${rows[0].amount_owed_cents / 100} (fee $${deposit.platform_fee_cents / 100})`);

// client-side confirm is idempotent with the webhook
const confirm = await api('/website/confirm-charge', { method: 'POST', token: customer, body: { paymentId: intent.id } });
assert.equal(confirm.status, 200, `confirm: ${confirm.message}`);
const tx = await db.transactions.count({ where: { transaction_id: intent.id } });
assert.equal(tx, 1, 'one transactions row');
ok('1.3 confirm-charge after webhook: still one row, one transaction');

// ── 1.4 forwarder summary ──
const mine = await api('/website/payouts/me', { token: forwarder });
assert.equal(mine.body.heldCents, rows[0].amount_owed_cents, '1.4 held total matches ledger');
assert.equal(mine.body.canReceive, false, '1.4 cannot receive yet');
ok(`1.4 payouts/me: held $${mine.body.heldCents / 100}, canReceive=false`);
const collectEarly = await api('/website/payouts/collect', { method: 'POST', token: forwarder });
assert.equal(collectEarly.status, 400, '1.6 Collect before onboarding is refused');
ok(`1.6 collect before onboarding → "${collectEarly.message}"`);

// ── 1.5 onboarding completes → auto-transfer. A test-mode Custom account can be
//      fully activated via the API with Stripe's test identity/bank data. ──
const acct = await stripe.accounts.create({
    type: 'custom', country: 'US', email: 'e2e-provider@vership.test',
    business_type: 'individual',
    capabilities: { transfers: { requested: true } },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
    individual: { first_name: 'E2E', last_name: 'Provider', email: 'e2e-provider@vership.test', phone: '0000000000', dob: { day: 1, month: 1, year: 1990 }, ssn_last_4: '0000', address: { line1: 'address_full_match', city: 'Pittsburgh', state: 'PA', postal_code: '15222', country: 'US' } },
    business_profile: { mcc: '4214', product_description: 'Freight forwarding (test)' },
    external_account: { object: 'bank_account', country: 'US', currency: 'usd', routing_number: '110000000', account_number: '000123456789' },
});
await db.users.update({ accountId: acct.id }, { where: { id: PROVIDER_ID } });
let live = acct;
for (let i = 0; i < 20 && live.capabilities?.transfers !== 'active'; i++) { await new Promise((r) => setTimeout(r, 1500)); live = await stripe.accounts.retrieve(acct.id); }
assert.equal(live.capabilities?.transfers, 'active', `test account transfers capability active (got ${live.capabilities?.transfers})`);

// webhook: half-onboarded event must NOT flip hashAccount
await onAccountUpdated({ id: acct.id, details_submitted: false, capabilities: { transfers: 'pending' } });
assert.equal((await db.users.findByPk(PROVIDER_ID)).hashAccount, '0', '0.3 account.updated with transfers pending leaves hashAccount=0');
// real state → flips + auto-collects
const upd = await onAccountUpdated(live);
assert.equal((await db.users.findByPk(PROVIDER_ID)).hashAccount, '1', '0.3 transfers active → hashAccount=1');
assert.equal(upd.collected.transferred.length, 1, `1.5 one transfer made (failed: ${JSON.stringify(upd.collected.failed.map((f) => f.failure_reason))})`);
const row = await db.forwarder_payouts.findByPk(rows[0].id);
assert.equal(row.status, 'transferred'); assert.ok(row.transfer_id);
const transfer = await stripe.transfers.retrieve(row.transfer_id);
assert.equal(transfer.amount, row.amount_owed_cents);
assert.equal(transfer.destination, acct.id);
assert.equal(transfer.source_transaction, paidFull.latest_charge.id, '1.5 transfer tied to the original charge');
ok(`1.5 auto-transfer ${transfer.id}: $${transfer.amount / 100} → ${acct.id}`);

// ── 1.6 Collect funds with nothing left ──
const collect = await api('/website/payouts/collect', { method: 'POST', token: forwarder });
assert.equal(collect.status, 200); assert.equal(collect.body.transferred, 0);
ok(`1.6 collect after auto-transfer → "${collect.message}"`);

// ── 1.7 reminder schedule ──
const d = (n) => new Date(Date.now() - n * 864e5);
assert.equal(payouts.reminderDue(d(0), 0, null), false, 'no reminder on day 0');
assert.equal(payouts.reminderDue(d(1), 0, null), true, 'day 1');
assert.equal(payouts.reminderDue(d(2), 1, d(1)), false, 'not day 2');
assert.equal(payouts.reminderDue(d(3), 1, d(2)), true, 'day 3');
assert.equal(payouts.reminderDue(d(7), 2, d(4)), true, 'day 7');
assert.equal(payouts.reminderDue(d(10), 3, d(4)), false, 'weekly: not yet');
assert.equal(payouts.reminderDue(d(14), 3, d(7)), true, 'weekly: day 14');
ok('1.7 reminder schedule 1/3/7/weekly');

// ── 1.9 refund after transfer → reversal + ledger reversed ──
await stripe.refunds.create({ payment_intent: intent.id });
const { onChargeRefunded } = require('../helper/stripeWebhook');
await onChargeRefunded({ id: paidFull.latest_charge.id, refunded: true });
const after = await db.forwarder_payouts.findByPk(row.id);
assert.equal(after.status, 'reversed', '1.9 ledger row reversed');
const reversals = await stripe.transfers.listReversals(row.transfer_id);
assert.equal(reversals.data.length, 1, '1.9 transfer reversed on Stripe');
ok(`1.9 refund → reversal ${reversals.data[0].id}`);
// A refunded deposit ends the booking: cancelled, and its pending customs charge voided.
const cancelledBooking = await db.bookings.findByPk(booking.id);
assert.equal(String(cancelledBooking.status), '4', '1.9 booking cancelled after deposit refund');
const stillPending = await db.booking_charges.count({ where: { booking_id: booking.id, status: 'pending' } });
assert.equal(stillPending, 0, '1.9 no pending charges remain on a refunded booking');
ok('1.9 refunded booking cancelled, pending charges voided');

// ── 2.4 Arrived → customs due (email/push best-effort) ── on a fresh booking (the first one is now refunded + cancelled)
const req2 = await api('/website/save-booking-request', { method: 'POST', token: customer, body: requestPayload });
assert.equal(req2.status, 200, `save-booking-request #2: ${req2.message}`);
const cb2 = await api('/website/create-booking', { method: 'POST', token: customer, body: { ...bookingPayload, booking_request_id: req2.body.id } });
assert.equal(cb2.status, 200, `create-booking #2: ${cb2.message}`);
const booking2 = cb2.body.bookings[0];
assert.notEqual(booking2.id, booking.id, '2.4 uses a fresh booking');
const customsDelivery2 = cb2.body.charges[0].customsDelivery;
await db.booking_charges.update({ status: 'paid', paid_at: new Date() }, { where: { id: cb2.body.charges[0].deposit.id } });
await db.bookings.update({ payment_status: '1' }, { where: { id: booking2.id } });
const arrived = await api('/website/update-booking-status', { method: 'POST', token: forwarder, body: { bookingId: booking2.id, status: '5' } });
assert.equal(arrived.status, 200, `arrived: ${arrived.message}`);
await new Promise((r) => setTimeout(r, 800));
const cd = await db.booking_charges.findByPk(customsDelivery2.id);
assert.ok(cd.due_at && cd.notified_at, '2.4 customs_delivery marked due + notified');
const pending = await api('/website/my-charges', { token: customer });
assert.ok(pending.body.some((c) => c.id === cd.id && c.status === 'pending'), '2.4 customer sees the pending customs charge');
ok('2.4 Arrived in Jamaica → customs & delivery due');

// cleanup: leave 417 onboarded (test account) for the browser run
console.log('\nall Phase 1 API checks passed');
process.exit(0);
