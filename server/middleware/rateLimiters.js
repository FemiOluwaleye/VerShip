// Rate limiters for auth-sensitive endpoints (express-rate-limit).
//
// Two layers of defense complement the per-account OTP attempt lockout in otpHelper:
//   - per-IP limits here stop distributed brute force and credential-stuffing bursts;
//   - the OTP attempt counter stops guessing a single account's code.
//
// Notes:
//   - The app sits behind Render/Replit proxies, so trust proxy must be enabled on the app
//     (see shipone.js) for the client IP to be correct. We also add an email-aware key so a
//     single account can't be hammered from many IPs.
//   - Limits are deliberately generous enough for real users, tight enough to blunt attacks.

const rateLimit = require('express-rate-limit');

const clientIp = (req) => req.ip || req.connection?.remoteAddress || 'unknown';
const emailKey = (req) => String(req.body?.email || '').trim().toLowerCase();

const jsonFail = (message) => (req, res) =>
    res.status(429).json({ status: false, message });

// Requesting a code (forgot-password / resend / register). Keyed by IP + email so both an IP and
// a targeted address are throttled. 5 requests / 15 min.
const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${clientIp(req)}:${emailKey(req)}`,
    handler: jsonFail('Too many requests. Please wait a few minutes and try again.'),
});

// Submitting a code / reset ticket (verify / reset-password). 10 attempts / 15 min per IP+email.
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${clientIp(req)}:${emailKey(req)}`,
    handler: jsonFail('Too many attempts. Please wait a few minutes and try again.'),
});

// Password login. 10 attempts / 15 min per IP+email.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${clientIp(req)}:${emailKey(req)}`,
    handler: jsonFail('Too many login attempts. Please wait a few minutes and try again.'),
});

module.exports = { otpRequestLimiter, otpVerifyLimiter, loginLimiter };
