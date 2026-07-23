const express = require('express');
const router = express.Router();
const webController = require('../controller/apicontroller/webController');

const { verifyUser } = require('../middleware/authtoken');
const { otpRequestLimiter, otpVerifyLimiter, loginLimiter } = require('../middleware/rateLimiters');

// Pre-packed food barrel (owner-sold fixed product) — public, no auth.
router.get('/prepacked-barrel', (req, res, next) => {
    webController.getPrepackedBarrel(req, res);
});
router.post('/prepacked-order', (req, res, next) => {
    webController.createPrepackedOrder(req, res);
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
router.get('/get-earnings', verifyUser, (req, res, next) => {
    webController.getEarnings(req, res);
});
router.get('/get-booking-detail', verifyUser, (req, res, next) => {
    webController.getBookingDetail(req, res);
});
router.post('/update-booking-status', verifyUser, (req, res, next) => {
    webController.updateBookingStatus(req, res);
});

router.post('/update-booking-payment', verifyUser, (req, res, next) => {
    webController.updateBookingPayment(req, res);
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

router.post('/create-payment-intent', verifyUser, (req, res, next) => {
    stripeController.createPaymentIntent(req, res);
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
module.exports = router;
