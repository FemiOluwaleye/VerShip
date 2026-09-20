/*
 * Held payouts for forwarders without a working Stripe Express account.
 *
 * Money flow (Stripe "separate charges and transfers"):
 *   1. The customer's card is charged on VerShip's platform account with a
 *      transfer_group but no transfer_data (createPaymentIntent decides this
 *      when the forwarder can't receive transfers yet).
 *   2. payment_intent.succeeded → recordPayment() writes one forwarder_payouts
 *      row per Stripe charge (unique on charge_id, so webhook replays are no-ops).
 *   3. When Stripe confirms the forwarder's account (account.updated with
 *      transfers active, or the onboarding return URL), or the forwarder presses
 *      "Collect funds", collectForProvider() creates one Transfer per owed row
 *      with source_transaction = the original charge, so the transfer waits for
 *      that charge's funds instead of failing while it settles.
 *   4. A transfer that Stripe rejects (typically balance_insufficient after the
 *      platform balance was paid out to the bank) is marked failed with the
 *      reason; the admin payouts page retries it. Stripe never retries on its own.
 *
 * Reminders: runReminderJob() emails forwarders holding money without a
 * connected account on day 1, 3, 7, then weekly; admin is escalated at day 30.
 */
const { env } = require('./envConfig');
const stripe = require('stripe')(env('STRIPE_SECRET_KEY'));
const db = require('../models');
const { Op } = require('sequelize');
const mail = require('./mailHelper');

// Rollback switch: PAYOUTS_HELD_ENABLED=false restores the old rule (only
// Stripe-onboarded forwarders are quoted; no held charges are created).
const heldPayoutsEnabled = () => String(process.env.PAYOUTS_HELD_ENABLED ?? 'true').toLowerCase() !== 'false';

const REMINDER_DAYS = [1, 3, 7];
const REMINDER_WEEKLY_AFTER = 7;
const ESCALATE_AFTER_DAYS = 30;

/** Can this forwarder receive transfers right now? Verified against Stripe, never trusted from the DB alone. */
async function providerCanReceiveTransfers(user) {
    if (!user || !user.accountId) return { ok: false, reason: 'no_account' };
    try {
        const acct = await stripe.accounts.retrieve(user.accountId);
        const transfers = acct.capabilities?.transfers === 'active';
        const legacy = acct.capabilities?.legacy_payments === 'active';
        if (!acct.details_submitted || !(transfers || legacy)) return { ok: false, reason: 'onboarding_incomplete', account: acct };
        return { ok: true, account: acct };
    } catch (e) {
        return { ok: false, reason: `stripe_error:${e.message}` };
    }
}

/**
 * Record what VerShip owes the forwarder for a succeeded payment. Called from
 * the webhook. Idempotent per charge. Returns the row or null when the payment
 * was a destination charge (Stripe already moved the money).
 */
async function recordPayment(paymentIntent) {
    const md = paymentIntent.metadata || {};
    if (md.payout_mode !== 'held') return null;
    const providerId = parseInt(md.provider_id, 10);
    const chargeId = typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;
    if (!providerId || !chargeId) return null;

    const gross = paymentIntent.amount_received || paymentIntent.amount;
    const platformFee = Math.max(0, Math.min(gross, parseInt(md.platform_fee_cents, 10) || 0));
    const [row, created] = await db.forwarder_payouts.findOrCreate({
        where: { charge_id: chargeId },
        defaults: {
            booking_id: md.bookingId ? parseInt(md.bookingId, 10) : null,
            booking_charge_id: md.bookingChargeId ? parseInt(md.bookingChargeId, 10) : null,
            provider_id: providerId,
            payment_intent_id: paymentIntent.id,
            charge_id: chargeId,
            gross_cents: gross,
            platform_fee_cents: platformFee,
            amount_owed_cents: gross - platformFee,
            currency: paymentIntent.currency || 'usd',
            status: 'owed',
        },
    });
    // First delivery of this event (not a webhook replay): tell the forwarder
    // straight away that money is waiting. The day 1/3/7/weekly schedule then
    // follows on from here; reminder_count stays 0 so it isn't shortened.
    if (created) notifyNewHeldPayment(row).catch((e) => console.error('[payouts] new-payment email failed:', e.message));
    return row;
}

async function notifyNewHeldPayment(row) {
    const user = await db.users.findByPk(row.provider_id, { attributes: ['id', 'email', 'firstName'] });
    if (!user?.email) return;
    const business = await db.providerDetails.findOne({ where: { providerId: row.provider_id }, attributes: ['businessName'] });
    const booking = row.booking_id ? await db.bookings.findByPk(row.booking_id, { attributes: ['orderId'] }) : null;
    const summary = await summaryForProvider(row.provider_id);
    await mail.sendPayoutReminderEmail(user.email, {
        forwarderName: business?.businessName || user.firstName || 'there',
        amount: cents(summary.heldCents),
        orderIds: booking?.orderId ? [booking.orderId] : [],
        reminderNumber: 0,
        heldSinceDays: 0,
        newPayment: cents(row.amount_owed_cents),
    });
}

/**
 * Transfer every owed (or previously failed) row for a provider. Safe to call
 * repeatedly: rows move owed → transferring → transferred/failed, and a row is
 * never transferred twice.
 */
async function collectForProvider(providerId, { trigger = 'manual', includeFailed = true } = {}) {
    const user = await db.users.findByPk(providerId);
    const can = await providerCanReceiveTransfers(user);
    if (!can.ok) return { ok: false, reason: can.reason, transferred: [], failed: [] };

    const statuses = includeFailed ? ['owed', 'failed'] : ['owed'];
    const rows = await db.forwarder_payouts.findAll({
        where: { provider_id: providerId, status: { [Op.in]: statuses } },
        order: [['createdAt', 'ASC']],
    });
    const transferred = [];
    const failed = [];
    for (const row of rows) {
        // Claim the row so a concurrent collect (webhook + button) can't double-pay.
        const [claimed] = await db.forwarder_payouts.update(
            { status: 'transferring' },
            { where: { id: row.id, status: { [Op.in]: statuses } } }
        );
        if (!claimed) continue;
        try {
            const transfer = await stripe.transfers.create({
                amount: row.amount_owed_cents,
                currency: row.currency,
                destination: user.accountId,
                source_transaction: row.charge_id,
                transfer_group: `booking_${row.booking_id}`,
                metadata: {
                    forwarder_payout_id: String(row.id),
                    booking_id: String(row.booking_id || ''),
                    provider_id: String(providerId),
                    trigger,
                },
            }, { idempotencyKey: `fp_${row.id}_${row.charge_id}` });
            await row.update({ status: 'transferred', transfer_id: transfer.id, transferred_at: new Date(), failure_reason: null });
            transferred.push(row);
        } catch (e) {
            await row.update({ status: 'failed', failure_reason: `${e.code || e.type || 'error'}: ${e.message}` });
            failed.push(row);
            console.error(`[payouts] transfer failed for row ${row.id} (provider ${providerId}):`, e.message);
        }
    }
    if (failed.length) notifyAdminOfFailures(user, failed).catch(() => {});
    return { ok: true, transferred, failed };
}

/** Mark the ledger row for a refunded charge; reverse the transfer if it already went out. */
async function handleRefundedCharge(charge) {
    const row = await db.forwarder_payouts.findOne({ where: { charge_id: charge.id } });
    if (!row) return null;
    if (row.status === 'transferred' && row.transfer_id) {
        try {
            await stripe.transfers.createReversal(row.transfer_id, { refund_application_fee: false });
        } catch (e) {
            console.error(`[payouts] transfer reversal failed for ${row.transfer_id}:`, e.message);
        }
    }
    if (['owed', 'failed', 'transferred'].includes(row.status)) {
        await row.update({ status: 'reversed', failure_reason: `refunded ${new Date().toISOString()}` });
    }
    return row;
}

const cents = (n) => (n / 100).toFixed(2);

async function summaryForProvider(providerId) {
    const rows = await db.forwarder_payouts.findAll({ where: { provider_id: providerId }, order: [['createdAt', 'DESC']] });
    const sum = (st) => rows.filter((r) => st.includes(r.status)).reduce((a, r) => a + r.amount_owed_cents, 0);
    const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter(Boolean))];
    const bookings = bookingIds.length
        ? await db.bookings.findAll({ where: { id: { [Op.in]: bookingIds } }, attributes: ['id', 'orderId'] })
        : [];
    const orderById = Object.fromEntries(bookings.map((b) => [b.id, b.orderId]));
    return {
        heldCents: sum(['owed', 'transferring', 'failed']),
        transferredCents: sum(['transferred']),
        failedCents: sum(['failed']),
        rows: rows.map((r) => ({
            id: r.id,
            bookingId: r.booking_id,
            orderId: orderById[r.booking_id] || null,
            amount: cents(r.amount_owed_cents),
            status: r.status,
            transferredAt: r.transferred_at,
            createdAt: r.createdAt,
            failureReason: r.failure_reason,
        })),
    };
}

/* ───────────────────────── reminders ───────────────────────── */

function reminderDue(firstOwedAt, reminderCount, lastReminderAt, now = new Date()) {
    const ageDays = Math.floor((now - new Date(firstOwedAt)) / 864e5);
    if (reminderCount < REMINDER_DAYS.length) return ageDays >= REMINDER_DAYS[reminderCount];
    // weekly after the fixed schedule
    const since = lastReminderAt ? Math.floor((now - new Date(lastReminderAt)) / 864e5) : ageDays;
    return since >= REMINDER_WEEKLY_AFTER;
}

/**
 * One pass over every forwarder that is owed money and still can't receive it.
 * Called daily from shipone.js and guarded by job_runs so a restart or a second
 * instance can't double-send within the same day.
 */
async function runReminderJob(now = new Date()) {
    const [job] = await db.job_runs.findOrCreate({ where: { name: 'payout_reminders' }, defaults: { last_run_at: null } });
    if (job.last_run_at && now - new Date(job.last_run_at) < 20 * 3600e3) return { skipped: true };
    await job.update({ last_run_at: now });

    const owed = await db.forwarder_payouts.findAll({
        where: { status: { [Op.in]: ['owed', 'failed'] } },
        order: [['createdAt', 'ASC']],
    });
    const byProvider = new Map();
    for (const r of owed) {
        if (!byProvider.has(r.provider_id)) byProvider.set(r.provider_id, []);
        byProvider.get(r.provider_id).push(r);
    }
    const sent = [];
    const escalated = [];
    for (const [providerId, rows] of byProvider) {
        const user = await db.users.findByPk(providerId, { attributes: ['id', 'email', 'firstName', 'hashAccount', 'accountId'] });
        if (!user?.email) continue;
        // If they can already receive, collect instead of nagging.
        const can = await providerCanReceiveTransfers(user);
        if (can.ok) { await collectForProvider(providerId, { trigger: 'reminder_job' }); continue; }

        const first = rows[0];
        const count = Math.max(...rows.map((r) => r.reminder_count));
        const last = rows.map((r) => r.last_reminder_at).filter(Boolean).sort().pop() || null;
        if (!reminderDue(first.createdAt, count, last, now)) continue;

        const total = rows.reduce((a, r) => a + r.amount_owed_cents, 0);
        const bookings = await db.bookings.findAll({ where: { id: { [Op.in]: rows.map((r) => r.booking_id).filter(Boolean) } }, attributes: ['orderId'] });
        const business = await db.providerDetails.findOne({ where: { providerId }, attributes: ['businessName'] });
        await mail.sendPayoutReminderEmail(user.email, {
            forwarderName: business?.businessName || user.firstName || 'there',
            amount: cents(total),
            orderIds: bookings.map((b) => b.orderId).filter(Boolean),
            reminderNumber: count + 1,
            heldSinceDays: Math.floor((now - new Date(first.createdAt)) / 864e5),
        });
        await db.forwarder_payouts.update(
            { reminder_count: count + 1, last_reminder_at: now },
            { where: { id: { [Op.in]: rows.map((r) => r.id) } } }
        );
        sent.push(providerId);

        const ageDays = Math.floor((now - new Date(first.createdAt)) / 864e5);
        if (ageDays >= ESCALATE_AFTER_DAYS && (count + 1) % 4 === 0) {
            await notifyAdmin('Forwarder payout held over 30 days', `${business?.businessName || user.email} has $${cents(total)} held for ${ageDays} days and has not set up Stripe payouts. Orders: ${bookings.map((b) => b.orderId).join(', ')}. Resolve on /admin/payouts.`);
            escalated.push(providerId);
        }
    }
    const result = { sent, escalated };
    await job.update({ last_result: JSON.stringify(result) });
    return result;
}

async function notifyAdmin(subject, text) {
    const admin = await db.users.findOne({ where: { role: '0' }, attributes: ['email'] });
    if (!admin?.email) return;
    await mail.sendAdminAlertEmail(admin.email, { subject, text }).catch((e) => console.error('[payouts] admin alert failed:', e.message));
}

async function notifyAdminOfFailures(user, failed) {
    const total = failed.reduce((a, r) => a + r.amount_owed_cents, 0);
    await notifyAdmin('Forwarder transfer failed',
        `${failed.length} transfer(s) totalling $${cents(total)} to ${user.email} failed. First reason: ${failed[0].failure_reason}. ` +
        'If the reason is balance_insufficient, raise the minimum balance in Stripe → Payouts, then retry from /admin/payouts.');
}

module.exports = {
    heldPayoutsEnabled,
    providerCanReceiveTransfers,
    recordPayment,
    collectForProvider,
    handleRefundedCharge,
    summaryForProvider,
    runReminderJob,
    reminderDue,
    REMINDER_DAYS,
    ESCALATE_AFTER_DAYS,
};
