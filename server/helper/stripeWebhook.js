/*
 * Stripe webhook event handling (signature verification stays in shipone.js).
 * Exported as a function of a verified event so it can be exercised directly in
 * tests with synthetic events.
 *
 *   account.updated           → mark the forwarder payout-ready ONLY when Stripe
 *                               says transfers are active, then move any held funds
 *   payment_intent.succeeded  → mark booking_charges / bookings / prepacked orders /
 *                               legacy additional costs paid; ledger held payouts
 *   charge.refunded           → reverse ledger rows (+ Stripe transfer if it went out)
 */
const db = require('../models');
const payouts = require('./payoutService');

async function onAccountUpdated(acct) {
    if (!acct?.id) return { skipped: 'no account id' };
    const user = await db.users.findOne({ where: { accountId: acct.id } });
    if (!user) return { skipped: 'no user for account' };

    const transfersActive = acct.capabilities?.transfers === 'active';
    const legacyActive = acct.capabilities?.legacy_payments === 'active';
    const ready = !!acct.details_submitted && (transfersActive || legacyActive);

    // Previously any account.updated flipped hashAccount to '1' — a forwarder
    // who had merely started onboarding was treated as payable. Only the
    // capability state counts.
    if (ready && user.hashAccount !== '1') {
        await user.update({ hashAccount: '1' });
        console.log(`[WEBHOOK] account ${acct.id}: transfers active → user ${user.id} hashAccount=1`);
    } else if (!ready && user.hashAccount === '1') {
        // Stripe can deactivate transfers later (missing info, restricted). Stop
        // sending destination charges and hold instead.
        await user.update({ hashAccount: '0' });
        console.log(`[WEBHOOK] account ${acct.id}: transfers no longer active → user ${user.id} hashAccount=0`);
    }

    let collected = null;
    if (ready) {
        collected = await payouts.collectForProvider(user.id, { trigger: 'account.updated' });
        if (collected.transferred.length || collected.failed.length) {
            console.log(`[WEBHOOK] auto-collect for user ${user.id}: ${collected.transferred.length} transferred, ${collected.failed.length} failed`);
        }
    }
    return { userId: user.id, ready, collected };
}

async function onPaymentIntentSucceeded(paymentIntent) {
    const md = paymentIntent?.metadata || {};
    const result = {};

    // Pre-packed barrel orders
    if (md.prepackedOrderId) {
        await db.prepacked_orders.update({ payment_status: 1 }, { where: { id: md.prepackedOrderId } });
        result.prepackedOrderId = md.prepackedOrderId;
    }

    // Legacy forwarder "additional cost" rows (pre-booking_charges clients)
    if (md.additionalCostId) {
        await db.booking_additional_costs.update(
            { status: '1', transaction_id: paymentIntent.id },
            { where: { id: md.additionalCostId } }
        );
        await db.booking_charges.update(
            { status: 'paid', payment_intent_id: paymentIntent.id, paid_at: new Date() },
            { where: { legacy_additional_cost_id: md.additionalCostId, status: 'pending' } }
        );
        result.additionalCostId = md.additionalCostId;
    }

    // Milestone / extra charges ("Pay as Your Shipment Moves")
    const chargeId = typeof paymentIntent.latest_charge === 'string' ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id;
    if (md.bookingChargeId) {
        const bc = await db.booking_charges.findByPk(md.bookingChargeId);
        if (bc && bc.status !== 'paid') {
            await bc.update({ status: 'paid', payment_intent_id: paymentIntent.id, charge_id: chargeId || null, paid_at: new Date() });
            if (bc.legacy_additional_cost_id) {
                await db.booking_additional_costs.update({ status: '1', transaction_id: paymentIntent.id }, { where: { id: bc.legacy_additional_cost_id } });
            }
        }
        result.bookingChargeId = md.bookingChargeId;
    }

    // The booking itself: the deposit (or a legacy pay-all-upfront payment)
    if (md.bookingId) {
        const booking = await db.bookings.findOne({ where: { id: md.bookingId } });
        if (booking) {
            const isDeposit = !md.bookingChargeId || md.charge_kind === 'deposit' || md.charge_kind === undefined;
            if (isDeposit) {
                await booking.update({ payment_status: '1', trasaction_id: paymentIntent.id });
                if (booking.booking_request_id) {
                    await db.booking_requests.update({ payment_status: 1 }, { where: { id: booking.booking_request_id } });
                }
            }
            result.bookingId = md.bookingId;
        }
    }

    // Ledger for forwarders who can't receive transfers yet
    const held = await payouts.recordPayment(paymentIntent);
    if (held) result.forwarderPayoutId = held.id;
    return result;
}

async function onChargeRefunded(charge) {
    const row = await payouts.handleRefundedCharge(charge);
    let cancelledBookingId = null;
    if (charge.refunded) {
        const refunded = await db.booking_charges.findAll({ where: { charge_id: charge.id, status: 'paid' } });
        await db.booking_charges.update({ status: 'cancelled' }, { where: { charge_id: charge.id, status: 'paid' } });
        // Refunding the deposit ends the booking: cancel it and void whatever is still pending on it,
        // so it stops showing as in transit with customs & delivery due.
        const deposit = refunded.find((c) => c.kind === 'deposit');
        if (deposit) {
            await db.booking_charges.update({ status: 'cancelled' }, { where: { booking_id: deposit.booking_id, status: 'pending' } });
            await db.bookings.update({ status: '4' }, { where: { id: deposit.booking_id } });
            cancelledBookingId = deposit.booking_id;
        }
    }
    return { forwarderPayoutId: row?.id || null, fullyRefunded: !!charge.refunded, cancelledBookingId };
}

async function handleStripeEvent(event) {
    switch (event.type) {
        case 'account.updated':
            return onAccountUpdated(event.data.object);
        case 'payment_intent.succeeded':
            return onPaymentIntentSucceeded(event.data.object);
        case 'charge.refunded':
            return onChargeRefunded(event.data.object);
        default:
            return { ignored: event.type };
    }
}

module.exports = { handleStripeEvent, onAccountUpdated, onPaymentIntentSucceeded, onChargeRefunded };
