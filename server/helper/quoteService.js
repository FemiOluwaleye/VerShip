/*
 * Builds the authoritative price breakdown for (booking request, forwarder).
 * Used by GET /website/quote-breakdown (what the checkout page displays), by
 * createBooking (what gets written to booking_charges) and by the payment
 * intent (what the card is charged) — so all three can never disagree.
 */
const db = require('../models');
const pricing = require('./pricing');

const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

/** Platform service fee % — the "Service fee" / "Customs Clearance" add-on. */
async function getServiceFeePercent() {
    const addons = await db.addons.findAll({ where: { status: 1 } });
    const match = addons.find((a) => /service\s*fee|customs\s*clearance/i.test(String(a.name || '')));
    return num(match?.price_in_percent);
}

/** Admin commission % — stored on the admin (role 0) user. */
async function getAdminCommissionPct() {
    const admin = await db.users.findOne({ where: { role: '0' }, attributes: ['adminCommission'] });
    return num(admin?.adminCommission);
}

/** Shipment type from the request's items (mirrors createBooking's rule). */
function requestType(request) {
    const items = Array.isArray(request?.items) ? request.items : [];
    const subs = items.map((i) => String(i.sub_type || i.item_type || '').toLowerCase());
    if (subs.some((s) => s.includes('drop-off') || s.includes('dropoff'))) return 'dropoff';
    return 'own';
}

async function loadProvider(providerUserId) {
    return db.providerDetails.findOne({
        where: { providerId: providerUserId },
        include: [
            { model: db.users, as: 'provider', attributes: ['id', 'firstName', 'lastName', 'email', 'status', 'hashAccount', 'accountId', 'image'] },
            { model: db.barrelsprices, as: 'barrelPrices' },
        ],
    });
}

async function loadRequest(requestId) {
    return db.booking_requests.findOne({
        where: { id: requestId },
        include: [{ model: db.booking_requests_items, as: 'items' }],
    });
}

/**
 * @param {object} o
 * @param {object} o.request       booking_requests row (or transient object with the same fields)
 * @param {object} o.provider      providerDetails row incl. barrelPrices + provider user
 * @param {string} [o.parish]      overrides request.parish
 * @param {number} [o.shipperLat]  shipper pickup point; falls back to the request's origin coords
 * @param {number} [o.shipperLng]
 * @param {number} [o.consigneeLat] legacy delivery mileage only
 * @param {number} [o.consigneeLng]
 * @param {boolean} [o.dropoffAddon] overrides request.dropoff_addon
 */
async function buildBreakdown(o) {
    const { request, provider } = o;
    if (!request || !provider) return null;
    const [adminCommissionPct, serviceFeePct] = await Promise.all([getAdminCommissionPct(), getServiceFeePercent()]);

    const type = requestType(request);
    const pickupFromLat = num(o.shipperLat) || num(request.origin_lat);
    const pickupFromLng = num(o.shipperLng) || num(request.origin_long);
    const pickupMiles = type === 'own'
        ? pricing.haversineMiles(num(provider.businessLatitude), num(provider.businessLongitude), pickupFromLat, pickupFromLng)
        : 0;
    const deliveryMiles = type === 'own'
        ? pricing.haversineMiles(pricing.PORT_COORDINATES.lat, pricing.PORT_COORDINATES.lng, num(o.consigneeLat) || num(request.destination_lat), num(o.consigneeLng) || num(request.destination_long))
        : 0;

    const parish = o.parish !== undefined ? o.parish : request.parish;
    const dropoffAddon = o.dropoffAddon !== undefined ? !!o.dropoffAddon : Number(request.dropoff_addon) === 1;

    const cards = (provider.barrelPrices || []).map((c) => (typeof c.toJSON === 'function' ? c.toJSON() : c));
    const quote = pricing.computeQuote({
        barrelPrices: cards,
        type,
        origin: request.origin,
        destination: request.destination,
        quantity: request.quantity,
        parish,
        pickupMiles,
        deliveryMiles,
        dropoffAddon,
        adminCommissionPct,
        serviceFeePct,
    });
    if (!quote) return null;

    // Platform share of the deposit = the commission + service-fee lines; the
    // customs & delivery milestone is entirely the forwarder's.
    const platformFeeCents = Math.round((quote.commissionAmount + quote.serviceFeeAmount) * 100);
    return {
        ...quote,
        card: undefined,
        cardId: quote.card?.id ?? null,
        pickupMiles: pricing.round2(pickupMiles),
        providerUserId: provider.provider?.id ?? provider.providerId,
        providerName: provider.businessName || provider.provider?.firstName || '',
        dueNowCents: Math.round(quote.dueNow.total * 100),
        laterCents: Math.round(quote.later.total * 100),
        platformFeeCents,
    };
}

module.exports = { getServiceFeePercent, getAdminCommissionPct, requestType, loadProvider, loadRequest, buildBreakdown };
