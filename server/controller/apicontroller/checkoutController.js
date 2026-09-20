/*
 * Checkout redesign endpoints:
 *   quotes for guests, server-side price breakdown, guest checkout (account
 *   created at "Pay now"), charge intents / confirmation for every
 *   booking_charges row, post-payment account setup, and the forwarder's held
 *   payouts ("Collect funds").
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../../models');
const helper = require('../../helper/helper');
const quoteService = require('../../helper/quoteService');
const chargeService = require('../../helper/chargeService');
const paymentService = require('../../helper/paymentService');
const payouts = require('../../helper/payoutService');
const mail = require('../../helper/mailHelper');
const web = require('./webController');
const { normalizePhoneForCountry, validatePhoneForCountry } = require('../../helper/phone');

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

const appUrl = () => {
    const { env } = require('../../helper/envConfig');
    return env('APP_URL')
        || (process.env.REPLIT_DEPLOYMENT ? 'https://vershipgo.com'
            : (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://vershipgo.com'));
};

/** Build a transient booking_requests-shaped object from the landing-form payload. */
function transientRequest(body) {
    const items = Array.isArray(body.items) && body.items.length ? body.items : [{
        item_type: body.item_type || 'Barrel', sub_type: body.sub_type || 'Ship Your Own Barrel', quantity: body.quantity,
    }];
    const first = items[0] || {};
    return {
        id: null,
        origin: body.origin || '',
        origin_city: body.origin_city || '',
        destination: body.destination || '',
        quantity: parseInt(first.quantity || body.quantity || 1, 10) || 1,
        pickup_date: body.pickup_date || null,
        delivery_date: body.delivery_date || null,
        parish: body.parish || '',
        dropoff_addon: body.dropoff_addon ? 1 : 0,
        origin_lat: body.origin_lat, origin_long: body.origin_long,
        destination_lat: body.destination_lat, destination_long: body.destination_long,
        items: items.map((i) => ({ item_type: i.item_type, sub_type: i.sub_type })),
    };
}

/** Persist a landing-form payload as a booking request for `userId`. */
async function persistRequest(userId, body) {
    const t = transientRequest(body);
    const request = await db.booking_requests.create({
        userId,
        origin: t.origin, origin_city: t.origin_city, destination: t.destination,
        quantity: t.quantity, weight: 0, description: '', dimensions: '',
        pickup_date: t.pickup_date || new Date(), delivery_date: t.delivery_date || new Date(),
        origin_lat: t.origin_lat, origin_long: t.origin_long, destination_lat: t.destination_lat, destination_long: t.destination_long,
        parish: t.parish, dropoff_addon: t.dropoff_addon,
    });
    const saved = [];
    for (const item of t.items) {
        saved.push(await db.booking_requests_items.create({ booking_request_id: request.id, item_type: item.item_type, sub_type: item.sub_type }));
    }
    request.setDataValue('items', saved);
    return request;
}

const signSession = async (user) => {
    const loginTime = helper.unixTimestamp() + Math.floor(Math.random() * 10000000);
    user.loginTime = loginTime;
    await user.save();
    return jwt.sign({ id: user.id, loginTime }, process.env.JWT_SECRET);
};

const publicUser = (u) => ({
    id: u.id, role: u.role, firstName: u.firstName, lastName: u.lastName, email: u.email,
    countryCode: u.countryCode, phoneNumber: u.phoneNumber, image: u.image, survey: u.survey,
    otpVerify: u.otpVerify, status: u.status, loginTime: u.loginTime, hashAccount: u.hashAccount,
    country: u.country, city: u.city, state: u.state, streetAddress: u.streetAddress,
    account_state: u.account_state, isProfileComplete: u.isProfileComplete, profile_step: u.profile_step,
});

module.exports = {
    /* POST /website/guest-quotes — same matching as the logged-in quotes page, nothing persisted. */
    guestQuotes: async (req, res) => {
        try {
            const request = transientRequest(req.body);
            if (!request.origin || !request.destination) return helper.failure(res, 'Origin and destination are required.');
            const { providers, adminCommission } = await web._matchQuotesForRequest(request, '');
            return helper.success(res, 'Quotes fetched successfully.', { bookingRequest: request, providers, adminCommission, guest: true });
        } catch (error) {
            console.error('guestQuotes error:', error);
            return helper.failure(res, error.message);
        }
    },

    /*
     * GET /website/quote-breakdown?requestId=&providerId=[&parish=&shipperLat=&shipperLng=]
     * POST /website/quote-breakdown  { request: <landing payload>, providerId, parish, shipperLat, shipperLng }   (guests)
     * The authoritative Due now / Estimated later figures the checkout page renders.
     */
    quoteBreakdown: async (req, res) => {
        try {
            const src = req.method === 'POST' ? req.body : req.query;
            const providerId = parseInt(src.providerId, 10);
            if (!providerId) return helper.failure(res, 'providerId is required.');
            let request;
            if (src.requestId) {
                request = await quoteService.loadRequest(src.requestId);
                if (!request) return helper.error(res, 'Booking request not found.', 404);
                if (req.user && request.userId && String(request.userId) !== String(req.user.id)) return helper.forbidden(res, 'Not your booking request.');
            } else if (src.request) {
                request = transientRequest(typeof src.request === 'string' ? JSON.parse(src.request) : src.request);
            } else {
                return helper.failure(res, 'requestId or request is required.');
            }
            const provider = await quoteService.loadProvider(providerId);
            if (!provider || Number(provider.documentVerify) !== 1 || String(provider.provider?.status) !== '1') {
                return helper.error(res, 'This forwarder is not available.', 404);
            }
            const bd = await quoteService.buildBreakdown({
                request, provider,
                parish: src.parish !== undefined && src.parish !== '' ? src.parish : undefined,
                shipperLat: num(src.shipperLat) || undefined,
                shipperLng: num(src.shipperLng) || undefined,
                dropoffAddon: src.dropoffAddon !== undefined ? (src.dropoffAddon === true || src.dropoffAddon === 'true' || src.dropoffAddon === '1') : undefined,
            });
            if (!bd) return helper.error(res, 'No rate card matches this shipment.', 404);
            const can = await payouts.providerCanReceiveTransfers(provider.provider);
            return helper.success(res, 'Breakdown computed.', { ...bd, payoutMode: can.ok ? 'destination' : 'held' });
        } catch (error) {
            console.error('quoteBreakdown error:', error);
            return helper.failure(res, error.message);
        }
    },

    /*
     * POST /website/guest-checkout
     * { shipper: {firstName,lastName,email,phone,countryCode,country}, request: <landing payload>,
     *   booking: <createBooking body minus booking_request_id/providerIds>, providerId }
     * Creates the account (pending_password), the booking request, the booking and its
     * charges, and returns a session so the client can pay through the normal endpoints.
     * An existing email is refused (409) — the customer signs in instead.
     */
    guestCheckout: async (req, res) => {
        try {
            const { shipper = {}, request, booking = {}, providerId } = req.body || {};
            const email = String(shipper.email || '').trim().toLowerCase();
            const firstName = String(shipper.firstName || '').trim();
            const lastName = String(shipper.lastName || '').trim();
            const countryCode = String(shipper.countryCode || '+1').trim();
            const phone = normalizePhoneForCountry(countryCode, shipper.phone);
            if (!firstName || !lastName) return helper.failure(res, 'Your first and last name are required.');
            if (!isEmail(email)) return helper.failure(res, 'A valid email address is required.');
            const phoneErr = validatePhoneForCountry(countryCode, phone);
            if (phoneErr) return helper.failure(res, phoneErr);
            if (!request || !providerId) return helper.failure(res, 'request and providerId are required.');

            const existing = await db.users.findOne({ where: { email } });
            if (existing) {
                return res.status(409).json({ success: false, code: 'EXISTING_ACCOUNT', message: 'An account already exists for this email. Please sign in to continue.' });
            }

            const user = await db.users.create({
                role: '1',
                firstName, lastName, email,
                countryCode, phoneNumber: phone,
                country: shipper.country || '',
                password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
                otpVerify: '0',
                status: '1',
                account_state: 'pending_password',
                accountId: '',
                isProfileComplete: '1',
            });
            const authtoken = await signSession(user);

            const savedRequest = await persistRequest(user.id, request);
            const bookings = await web._createBookingsCore(user.id, {
                ...booking,
                booking_request_id: savedRequest.id,
                providerIds: [parseInt(providerId, 10)],
                shiper_firstName: booking.shiper_firstName || firstName,
                shiper_lastName: booking.shiper_lastName || lastName,
                shiper_email: booking.shiper_email || email,
                shiper_phone_number: booking.shiper_phone_number || phone,
                shiper_country_code: booking.shiper_country_code || countryCode,
            });
            const charges = await chargeService.ensureBookingCharges(bookings);
            return helper.success(res, 'Checkout started.', { authtoken, user: publicUser(user), bookingRequest: savedRequest, bookings, charges });
        } catch (error) {
            console.error('guestCheckout error:', error);
            return helper.failure(res, error.message);
        }
    },

    /* POST /website/charge-intent { bookingChargeId } | { bookingId } (→ that booking's deposit) */
    chargeIntent: async (req, res) => {
        try {
            const { bookingChargeId, bookingId } = req.body || {};
            let charge = null;
            if (bookingChargeId) charge = await db.booking_charges.findByPk(bookingChargeId);
            else if (bookingId) {
                charge = await db.booking_charges.findOne({ where: { booking_id: bookingId, kind: 'deposit' } });
                if (!charge) {
                    const booking = await db.bookings.findByPk(bookingId);
                    if (booking) {
                        const made = await chargeService.ensureBookingCharges([booking]);
                        charge = made[0]?.deposit || null;
                    }
                }
            }
            if (!charge) return helper.error(res, 'Charge not found.', 404);
            if (String(charge.user_id) !== String(req.user.id)) return helper.forbidden(res, 'Not your charge.');
            const booking = await db.bookings.findByPk(charge.booking_id);
            const out = await paymentService.createIntentForCharge(charge, booking);
            return res.status(200).json({ success: true, ...out });
        } catch (error) {
            console.error('chargeIntent error:', error);
            return res.status(400).json({ success: false, message: error.message });
        }
    },

    /* POST /website/confirm-charge { paymentId } */
    confirmCharge: async (req, res) => {
        try {
            const { paymentId } = req.body || {};
            const out = await paymentService.confirmPaidIntent(paymentId, req.user);
            const { charge, booking, paid } = out;

            // First payment on a booking → tell the forwarder (same email as before).
            if (charge?.kind === 'deposit' && booking?.driverId) {
                const provider = await db.users.findByPk(booking.driverId, { attributes: ['id', 'email', 'firstName', 'lastName'] });
                const business = await db.providerDetails.findOne({ where: { providerId: booking.driverId }, attributes: ['businessName'] });
                if (provider?.email) {
                    const customerName = booking.primary_name || `${booking.primary_firstName || ''} ${booking.primary_lastName || ''}`.trim() || 'Customer';
                    mail.sendNewOrderPlacedEmailToProvider12(provider.email, {
                        providerName: business?.businessName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Provider',
                        orderId: booking.orderId, bookingId: booking.id, customerName, totalAmount: paid,
                    }).catch((err) => console.error('New order email to provider failed:', err));
                }
                // Guest accounts get their receipt + set-password link now.
                const customer = await db.users.findByPk(booking.userId);
                if (customer && customer.account_state === 'pending_password') {
                    const later = await db.booking_charges.findOne({ where: { booking_id: booking.id, kind: 'customs_delivery', status: 'pending' } });
                    const token = crypto.randomBytes(32).toString('hex');
                    await customer.update({ setup_token: crypto.createHash('sha256').update(token).digest('hex'), setup_token_expires: new Date(Date.now() + 24 * 3600e3) });
                    mail.sendGuestReceiptEmail(customer.email, {
                        customerName: customer.firstName || 'there',
                        orderId: booking.orderId,
                        businessName: business?.businessName || 'your forwarder',
                        paidNow: paid.toFixed(2),
                        laterEstimate: later ? (later.amount_cents / 100).toFixed(2) : null,
                        setupUrl: `${appUrl()}/account-setup?token=${token}`,
                    }).catch((err) => console.error('Guest receipt failed:', err));
                }
            }
            const charges = booking ? await chargeService.chargesForBooking(booking.id) : [];
            return helper.success(res, 'Payment confirmed.', { charge, booking, charges, paid });
        } catch (error) {
            console.error('confirmCharge error:', error);
            return helper.failure(res, error.message);
        }
    },

    /* GET /website/booking-charges?bookingId= — owner or the booking's forwarder */
    bookingCharges: async (req, res) => {
        try {
            const booking = await db.bookings.findByPk(req.query.bookingId);
            if (!booking) return helper.error(res, 'Booking not found.', 404);
            const uid = String(req.user.id);
            if (uid !== String(booking.userId) && uid !== String(booking.driverId) && String(req.user.role) !== '0') return helper.forbidden(res, 'Not your booking.');
            const charges = await chargeService.chargesForBooking(booking.id);
            return helper.success(res, 'Charges fetched.', charges);
        } catch (error) {
            return helper.failure(res, error.message);
        }
    },

    /* GET /website/my-charges — every pending charge across the customer's bookings (History) */
    myCharges: async (req, res) => {
        try {
            const charges = await db.booking_charges.findAll({
                where: { user_id: req.user.id },
                order: [['status', 'ASC'], ['createdAt', 'DESC']],
            });
            return helper.success(res, 'Charges fetched.', charges);
        } catch (error) {
            return helper.failure(res, error.message);
        }
    },

    /*
     * POST /website/account-setup { password, token? }
     * Completes a pending_password account. With a valid token (from the receipt
     * email) no session is needed and the email counts as verified; with a
     * session (the success page right after paying) the account is activated too.
     */
    accountSetup: async (req, res) => {
        try {
            const { password, token } = req.body || {};
            if (!password || String(password).length < 8) return helper.failure(res, 'Password must be at least 8 characters.');
            let user = null;
            if (token) {
                const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
                user = await db.users.findOne({ where: { setup_token: hashed, setup_token_expires: { [Op.gt]: new Date() } } });
                if (!user) return helper.error(res, 'This link has expired. Use "Forgot password" on the sign-in page instead.', 410);
            } else if (req.user) {
                user = await db.users.findByPk(req.user.id);
            }
            if (!user) return helper.error(res, 'Sign in or use the link from your email.', 401);
            if (user.account_state !== 'pending_password') return helper.failure(res, 'This account already has a password.');
            await user.update({
                password: await bcrypt.hash(String(password), 10),
                account_state: 'active',
                otpVerify: '1',
                setup_token: null,
                setup_token_expires: null,
            });
            const authtoken = await signSession(user);
            return helper.success(res, 'Your account is ready.', { authtoken, user: publicUser(user) });
        } catch (error) {
            return helper.failure(res, error.message);
        }
    },

    /* GET /website/payouts/me — forwarder's held / transferred summary */
    myPayouts: async (req, res) => {
        try {
            if (String(req.user.role) !== '2') return helper.forbidden(res, 'Forwarders only.');
            const summary = await payouts.summaryForProvider(req.user.id);
            const can = await payouts.providerCanReceiveTransfers(req.user);
            return helper.success(res, 'Payouts fetched.', { ...summary, canReceive: can.ok, reason: can.ok ? null : can.reason });
        } catch (error) {
            return helper.failure(res, error.message);
        }
    },

    /* POST /website/payouts/collect — "Collect funds" */
    collectPayouts: async (req, res) => {
        try {
            if (String(req.user.role) !== '2') return helper.forbidden(res, 'Forwarders only.');
            const out = await payouts.collectForProvider(req.user.id, { trigger: 'collect_button' });
            if (!out.ok) return helper.failure(res, out.reason === 'no_account' || out.reason === 'onboarding_incomplete'
                ? 'Finish setting up payouts with Stripe first.' : `Stripe error: ${out.reason}`);
            const summary = await payouts.summaryForProvider(req.user.id);
            return helper.success(res, out.transferred.length
                ? `Transferred ${out.transferred.length} payment${out.transferred.length === 1 ? '' : 's'} to your Stripe account.`
                : (out.failed.length ? 'Some transfers failed — we have alerted VerShip support.' : 'Nothing to collect right now.'),
                { transferred: out.transferred.length, failed: out.failed.length, ...summary });
        } catch (error) {
            return helper.failure(res, error.message);
        }
    },
};
