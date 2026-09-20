/*
 * booking_charges lifecycle — "Pay as Your Shipment Moves".
 *
 *   ensureBookingCharges(bookings)  after a booking is created/refreshed: price
 *                                   it server-side and upsert its deposit and
 *                                   customs_delivery rows (pending until paid)
 *   markArrived(booking)            forwarder marked the shipment Arrived: the
 *                                   customs_delivery row becomes due; customer
 *                                   is emailed + pushed
 *   platformFeeCents(charge)        VerShip's share of a charge (application
 *                                   fee on destination charges / retained on
 *                                   held ones)
 */
const db = require('../models');
const { Op } = require('sequelize');
const quoteService = require('./quoteService');
const mail = require('./mailHelper');

const JAMAICA_PARISHES = [
    'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary', 'St. Ann',
    'Trelawny', 'St. James', 'Hanover', 'Westmoreland', 'St. Elizabeth',
    'Manchester', 'Clarendon', 'St. Catherine',
];

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

/** Price a booking with the server module, using the addresses saved on it. */
async function breakdownForBooking(booking, opts = {}) {
    const request = await quoteService.loadRequest(booking.booking_request_id);
    const provider = await quoteService.loadProvider(booking.driverId);
    if (!request || !provider) return null;
    const parish = opts.parish
        || (JAMAICA_PARISHES.includes(booking.consignee_state) ? booking.consignee_state : null)
        || request.parish
        || null;
    return quoteService.buildBreakdown({
        request,
        provider,
        parish,
        shipperLat: num(booking.shiper_lat),
        shipperLng: num(booking.shiper_lng),
        consigneeLat: num(booking.consignee_lat),
        consigneeLng: num(booking.consignee_lng),
    });
}

async function ensureBookingCharges(bookings) {
    const out = [];
    for (const booking of Array.isArray(bookings) ? bookings : [bookings]) {
        const bd = await breakdownForBooking(booking);
        if (!bd) continue;
        const existing = await db.booking_charges.findAll({ where: { booking_id: booking.id, kind: { [Op.in]: ['deposit', 'customs_delivery'] } } });
        const byKind = Object.fromEntries(existing.map((c) => [c.kind, c]));

        const upsert = async (kind, fields) => {
            const row = byKind[kind];
            if (row && row.status === 'paid') return row;       // never reprice a paid charge
            if (row) { await row.update(fields); return row; }
            return db.booking_charges.create({ booking_id: booking.id, provider_id: booking.driverId, user_id: booking.userId, kind, status: 'pending', ...fields });
        };

        const deposit = await upsert('deposit', {
            description: 'Sea freight & service fee',
            amount_cents: bd.dueNowCents,
            platform_fee_cents: bd.platformFeeCents,
            due_trigger: 'checkout',
            due_at: new Date(),
            breakdown: JSON.stringify(bd.dueNow.lines),
        });
        let later = null;
        if (bd.laterCents > 0) {
            later = await upsert('customs_delivery', {
                description: `Customs & delivery${bd.parish ? ` (${bd.parish})` : ''}`,
                amount_cents: bd.laterCents,
                platform_fee_cents: 0,
                due_trigger: 'arrived',
                breakdown: JSON.stringify(bd.later.lines),
            });
        } else if (byKind.customs_delivery && byKind.customs_delivery.status === 'pending') {
            await byKind.customs_delivery.update({ status: 'cancelled' });
        }

        // Keep the legacy columns the admin/forwarder pages read in step.
        await booking.update({
            total_amount: (bd.dueNowCents + bd.laterCents) / 100,
            pay_now_price: bd.dueNowCents / 100,
            pay_later_price: bd.laterCents / 100,
            subtotal: bd.barrels.lineTotal,
            serviceFee: bd.serviceFeeAmount,
            barrel_discount: bd.barrels.discount,
            flat_pickup_charge: bd.pickup ? bd.pickup.total : 0,
            flat_delivery_charge: 0,
            delivery_fee: bd.customsDelivery,
        });

        out.push({ bookingId: booking.id, deposit, customsDelivery: later, breakdown: bd });
    }
    return out;
}

async function chargesForBooking(bookingId) {
    return db.booking_charges.findAll({ where: { booking_id: bookingId }, order: [['createdAt', 'ASC']] });
}

/** Forwarder marked the shipment Arrived in Jamaica → customs & delivery is due now. */
async function markArrived(booking, providerName) {
    const row = await db.booking_charges.findOne({ where: { booking_id: booking.id, kind: 'customs_delivery', status: 'pending' } });
    if (!row) return null;
    await row.update({ due_at: new Date(), notified_at: new Date() });
    try {
        const customer = await db.users.findByPk(booking.userId, { attributes: ['email', 'firstName', 'deviceToken'] });
        if (customer?.email) {
            await mail.sendMilestoneDueEmail(customer.email, {
                customerName: customer.firstName || booking.primary_firstName || 'there',
                businessName: providerName || 'Your freight forwarder',
                orderId: booking.orderId || `#${booking.id}`,
                amount: (row.amount_cents / 100).toFixed(2),
                description: row.description,
            });
        }
        if (customer?.deviceToken) {
            const notificationHelper = require('./notificationHelper');
            await notificationHelper.sendNotification(customer.deviceToken, 'Your barrel has arrived',
                `$${(row.amount_cents / 100).toFixed(2)} customs & delivery is now due for order ${booking.orderId}.`,
                { bookingId: String(booking.id), type: 'charge_due', chargeId: String(row.id) });
        }
    } catch (e) {
        console.error('[charges] arrival notification failed:', e.message);
    }
    return row;
}

/** Extras (forwarder-added costs) carry the booking's admin commission as the platform share. */
function extraPlatformFeeCents(amountCents, booking) {
    const pct = num(booking?.adminCommission);
    if (pct <= 0 || pct > 100) return 0;
    return Math.round((amountCents * pct) / 100);
}

module.exports = { JAMAICA_PARISHES, breakdownForBooking, ensureBookingCharges, chargesForBooking, markArrived, extraPlatformFeeCents };
