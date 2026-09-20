/*
 * Stripe PaymentIntents for booking_charges — the only place a customer charge
 * is created. The amount always comes from the booking_charges row (priced by
 * helper/pricing.js on the server); nothing from the browser is charged.
 *
 * Routing per charge, decided at payment time:
 *   destination  forwarder's Express account can receive transfers → destination
 *                charge with application_fee_amount (unchanged from before)
 *   held         otherwise → plain platform charge tagged payout_mode=held; the
 *                webhook ledgers it in forwarder_payouts and it is transferred
 *                when the forwarder connects (helper/payoutService.js)
 */
const { env } = require('./envConfig');
const stripe = require('stripe')(env('STRIPE_SECRET_KEY'));
const db = require('../models');
const payouts = require('./payoutService');
const { onPaymentIntentSucceeded } = require('./stripeWebhook');

async function createIntentForCharge(charge, booking) {
    if (!charge || charge.status === 'paid') throw new Error('This charge has already been paid.');
    if (charge.status === 'cancelled') throw new Error('This charge was cancelled.');
    const amount = charge.amount_cents;
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Invalid charge amount.');

    const provider = await db.users.findByPk(charge.provider_id);
    if (!provider) throw new Error('Provider not found.');
    if (String(provider.status) !== '1') throw new Error('This forwarder is not accepting bookings right now.');

    const fee = Math.max(0, Math.min(amount, charge.platform_fee_cents || 0));
    const can = await payouts.providerCanReceiveTransfers(provider);
    const payoutMode = can.ok ? 'destination' : 'held';
    if (payoutMode === 'held' && !payouts.heldPayoutsEnabled()) {
        throw new Error('This provider cannot accept payments at this time. Please select another provider.');
    }

    const payload = {
        amount,
        currency: charge.currency || 'usd',
        automatic_payment_methods: { enabled: true },
        transfer_group: `booking_${charge.booking_id}`,
        metadata: {
            bookingId: String(charge.booking_id),
            bookingChargeId: String(charge.id),
            charge_kind: charge.kind,
            provider_id: String(charge.provider_id),
            platform_fee_cents: String(fee),
            payout_mode: payoutMode,
            orderId: booking?.orderId || '',
            ...(charge.legacy_additional_cost_id ? { additionalCostId: String(charge.legacy_additional_cost_id) } : {}),
        },
    };
    if (payoutMode === 'destination') {
        payload.application_fee_amount = fee;
        payload.transfer_data = { destination: provider.accountId };
    }

    const intent = await stripe.paymentIntents.create(payload);
    await charge.update({ payment_intent_id: intent.id });
    return {
        clientSecret: intent.client_secret,
        publishkey: env('STRIPE_PUBLISHABLE_KEY'),
        paymentIntentId: intent.id,
        amount: (amount / 100).toFixed(2),
        chargeId: charge.id,
        kind: charge.kind,
        payoutMode,
        split: { platformFee: (fee / 100).toFixed(2), providerAmount: ((amount - fee) / 100).toFixed(2) },
    };
}

/**
 * Client-side confirmation after Stripe reports success. Verified against
 * Stripe; then applies exactly what the webhook would (idempotent), so the
 * customer sees "paid" immediately even if the webhook is delayed.
 */
async function confirmPaidIntent(paymentIntentId, user) {
    if (!paymentIntentId) throw new Error('paymentId is required.');
    let intent;
    try {
        intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
    } catch (e) {
        throw new Error('Payment verification failed.');
    }
    if (!intent || intent.status !== 'succeeded') throw new Error('Payment has not been completed.');
    const md = intent.metadata || {};
    const charge = md.bookingChargeId ? await db.booking_charges.findByPk(md.bookingChargeId) : null;
    const booking = md.bookingId ? await db.bookings.findByPk(md.bookingId) : null;
    if (!charge && !booking) throw new Error('Payment does not match a booking.');
    const ownerId = charge?.user_id ?? booking?.userId;
    if (user && ownerId != null && String(ownerId) !== String(user.id)) throw new Error('You are not allowed to confirm this payment.');

    const result = await onPaymentIntentSucceeded(intent);

    // One transactions row per PaymentIntent.
    const paid = (intent.amount_received || intent.amount) / 100;
    const existing = await db.transactions.findOne({ where: { transaction_id: intent.id } });
    if (!existing) {
        await db.transactions.create({
            booking_id: booking?.id || charge?.booking_id,
            transaction_id: intent.id,
            amount: paid,
            user_id: ownerId,
            reciever_id: booking?.driverId || charge?.provider_id,
            status: 1,
        });
    }
    return { intent, charge: charge ? await charge.reload() : null, booking: booking ? await booking.reload() : null, result, paid };
}

module.exports = { createIntentForCharge, confirmPaidIntent };
