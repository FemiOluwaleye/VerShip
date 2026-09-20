const express = require('express');
const router = express.Router();
const webController = require('../controller/apicontroller/webController');

const { verifyUser, optionalUser } = require('../middleware/authtoken');
const checkoutController = require('../controller/apicontroller/checkoutController');
const { otpRequestLimiter, otpVerifyLimiter, loginLimiter } = require('../middleware/rateLimiters');

// Pre-packed food barrel (owner-sold fixed product) — public, no auth.
router.get('/prepacked-barrel', (req, res, next) => {
    webController.getPrepackedBarrel(req, res);
});
router.post('/prepacked-order', (req, res, next) => {
    webController.createPrepackedOrder(req, res);
});
router.post('/prepacked-order/confirm', (req, res, next) => {
    webController.confirmPrepackedPayment(req, res);
});
router.get('/prepacked-orders', verifyUser, (req, res, next) => {
    webController.getMyPrepackedOrders(req, res);
});

// Website CMS Routes
router.get('/privacy', (req, res, next) => {
    req.query.type = 1;
    webController.getCmsContent(req, res);
});

router.get('/about', (req, res, next) => {
    req.query.type = 2;
    webController.getCmsContent(req, res);
});

router.get('/terms', (req, res, next) => {
    req.query.type = 3;
    webController.getCmsContent(req, res);
});
router.get('/cookie-policy', (req, res, next) => {
    req.query.type = 4;
    webController.getCmsContent(req, res);
});
router.get('/freight-content', (req, res, next) => {
    req.query.type = 5;
    webController.getCmsContent(req, res);
});
router.get('/refund-policy', (req, res, next) => {
    req.query.type = 6;
    webController.getCmsContent(req, res);
});
router.get('/faq', (req, res, next) => {
    webController.getFaq(req, res);
});
router.get('/get-cookies', (req, res, next) => {
    webController.getCookies(req, res);
});
router.post('/save-user-cookies', (req, res, next) => {
    webController.saveUserCookies(req, res);
});
router.get('/get-addons', (req, res, next) => {
    webController.getAddons(req, res);
});
router.post('/contact/us', (req, res, next) => {
    webController.contactUs(req, res);
});
router.get('/ratings', (req, res, next) => {
    webController.ratinglist(req, res);
});
router.post('/login', loginLimiter, (req, res, next) => {
    webController.login(req, res);
});
router.post('/logout', verifyUser, (req, res, next) => {
    webController.logout(req, res);
});
router.post('/social-login', (req, res, next) => {
    webController.socialLogin(req, res);
});
router.post('/register', otpRequestLimiter, (req, res, next) => {
    webController.register(req, res);
});
router.post('/verify', otpVerifyLimiter, (req, res, next) => {
    webController.verify(req, res);
});
router.post('/resend-otp', otpRequestLimiter, (req, res, next) => {
    webController.resendOtp(req, res);
});
router.post('/forgot-password', otpRequestLimiter, (req, res, next) => {
    webController.forgotPassword(req, res);
});
router.post('/reset-password', otpVerifyLimiter, (req, res, next) => {
    webController.resetPassword(req, res);
});
router.post('/update-profile', verifyUser, (req, res, next) => {
    webController.updateProfile(req, res);
});
router.post('/delete-account', verifyUser, (req, res, next) => {
    webController.deleteAccount(req, res);
});
router.post('/complete-profile', verifyUser, (req, res, next) => {
    webController.completeProfile(req, res);
});
router.get('/get-profile', verifyUser, (req, res, next) => {
    webController.getProviderProfile(req, res);
});
router.get('/providerlist',  (req, res, next) => {
    webController.providerList(req, res);
});
router.post('/save-booking-request', verifyUser, (req, res, next) => {
    webController.saveBookingRequest(req, res);
});
router.post('/update-booking-request/:id', verifyUser, (req, res, next) => {
    webController.updateBookingRequest(req, res);
});
router.get('/get-available-quotes', verifyUser, (req, res, next) => {
    webController.getAvailableQuotes(req, res);
});
router.post('/create-booking', verifyUser, (req, res, next) => {
    webController.createBooking(req, res);
});
router.get('/get-bookings', verifyUser, (req, res, next) => {
    webController.getBookings(req, res);
});
// Forwarder-requested additional costs on a booking
router.post('/booking-additional-cost', verifyUser, (req, res, next) => {
    webController.addBookingAdditionalCost(req, res);
});
router.post('/additional-cost/pay-intent', verifyUser, (req, res, next) => {
    webController.payAdditionalCostIntent(req, res);
});
router.post('/additional-cost/confirm', verifyUser, (req, res, next) => {
    checkoutController.confirmCharge(req, res);
});
router.get('/get-earnings', verifyUser, (req, res, next) => {
    webController.getEarnings(req, res);
});
router.get('/get-booking-detail', verifyUser, (req, res, next) => {
    webController.getBookingDetail(req, res);
});
router.post('/update-booking-status', verifyUser, (req, res, next) => {
    webController.updateBookingStatus(req, res);
});

// Legacy name kept for older clients: now verifies the PaymentIntent with
// Stripe and applies the same idempotent update as the webhook.
router.post('/update-booking-payment', verifyUser, (req, res) => {
    checkoutController.confirmCharge(req, res);
});

router.post('/update-pay-later-status', verifyUser, (req, res, next) => {
    webController.updatePayLaterStatus(req, res);
});

router.post('/newsletter/subscribe', (req, res, next) => {
    webController.subscribeNewsletter(req, res);
});

router.post('/upload-booking-document', verifyUser, (req, res, next) => {
    webController.uploadBookingDocument(req, res);
});
router.get('/get-notifications', verifyUser, (req, res, next) => {
    webController.getNotifications(req, res);
});
const stripeController = require('../controller/apicontroller/stripeController');

// Legacy name kept for older clients: the amount now comes from the booking's
// deposit charge (server-priced); any amount in the body is ignored.
router.post('/create-payment-intent', verifyUser, (req, res) => {
    checkoutController.chargeIntent(req, res);
});
router.post('/createStripeAccount', verifyUser, (req, res, next) => {
    stripeController.createStripeAccount(req, res);
});
router.get('/stripe/return/:userId', stripeController.stripeReturn);


router.delete('/clear-notifications', verifyUser, (req, res, next) => {
    webController.clearNotifications(req, res);
});
router.post('/update-device-token', verifyUser, (req, res, next) => {
    webController.updateDeviceToken(req, res);
});
router.post('/submit-rating', verifyUser, (req, res, next) => {
    webController.submitRating(req, res);
});
router.get('/check-rating-status', verifyUser, (req, res, next) => {
    webController.checkRatingStatus(req, res);
});
router.get('/get-user-cookies', verifyUser, (req, res, next) => {
    webController.getUserCookies(req, res);
});
router.get('/get-forwarders', (req, res, next) => {
    webController.getForwarders(req, res);
});

// ── Checkout redesign: guest quotes, server-priced breakdown, milestone charges,
//    guest checkout, post-payment account setup, forwarder held payouts ──
router.post('/guest-quotes', (req, res) => checkoutController.guestQuotes(req, res));
// Publishable key for mounting the Payment Element before a PaymentIntent exists.
router.get('/stripe-config', (req, res) => {
    const { env } = require('../helper/envConfig');
    res.json({ success: true, body: { publishableKey: env('STRIPE_PUBLISHABLE_KEY') || '' } });
});
router.get('/quote-breakdown', optionalUser, (req, res) => checkoutController.quoteBreakdown(req, res));
router.post('/quote-breakdown', optionalUser, (req, res) => checkoutController.quoteBreakdown(req, res));
router.post('/guest-checkout', (req, res) => checkoutController.guestCheckout(req, res));
router.post('/charge-intent', verifyUser, (req, res) => checkoutController.chargeIntent(req, res));
router.post('/confirm-charge', verifyUser, (req, res) => checkoutController.confirmCharge(req, res));
router.get('/booking-charges', verifyUser, (req, res) => checkoutController.bookingCharges(req, res));
router.get('/my-charges', verifyUser, (req, res) => checkoutController.myCharges(req, res));
router.post('/account-setup', optionalUser, (req, res) => checkoutController.accountSetup(req, res));
router.get('/payouts/me', verifyUser, (req, res) => checkoutController.myPayouts(req, res));
router.post('/payouts/collect', verifyUser, (req, res) => checkoutController.collectPayouts(req, res));

module.exports = router;
