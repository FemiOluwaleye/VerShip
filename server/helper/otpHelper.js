// Hardened OTP + password-reset-ticket helper.
//
// Design (industry best practice):
//  - Codes are 6 digits, generated with a CSPRNG (crypto.randomInt), never Math.random.
//  - Codes are NEVER stored in plaintext. We store an HMAC-SHA256 of the code, keyed by a
//    server-side pepper (OTP_PEPPER, falling back to JWT_SECRET) and bound to the user id +
//    purpose, so a code cannot be replayed across users or across the verify/reset flows.
//  - Every code has a real expiry (otpExpiresAt) that IS enforced on verification.
//  - Wrong attempts are counted (otpAttempts) and the code is locked after MAX_ATTEMPTS,
//    defeating brute force of the small 6-digit space.
//  - Resends are throttled by a per-account cooldown (RESEND_COOLDOWN_MS).
//  - After the reset code is verified we do NOT log the user in. Instead we mint a single-use,
//    high-entropy, short-lived reset ticket (256-bit random, stored hashed) that the
//    reset-password step must present. This decouples "proved control of the inbox" from
//    "has a full session", so a guessed code can at most reset the password, not hijack a login.
//
// The five columns this relies on (added by migrate-otp-security.js and declared on the users
// model): otpHash, otpPurpose, otpExpiresAt, otpAttempts, otpLastSentAt.

const crypto = require('crypto');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;        // code valid for 10 minutes
const MAX_ATTEMPTS = 5;                    // wrong tries before the code is burned
const RESEND_COOLDOWN_MS = 60 * 1000;      // min gap between (re)sends per account
const RESET_TICKET_TTL_MS = 15 * 60 * 1000; // reset ticket valid for 15 minutes

// Purposes a code / ticket can be bound to.
const PURPOSE = {
    VERIFY_EMAIL: 'verify_email',
    RESET_PASSWORD: 'reset_password',
    RESET_VERIFIED: 'reset_verified', // interim state: code accepted, awaiting new password
};

const pepper = () => process.env.OTP_PEPPER || process.env.JWT_SECRET || 'insecure-dev-pepper';

// Deterministic keyed hash of a secret, bound to the user + purpose so hashes are not
// interchangeable between accounts or flows. timingSafeEqual is used on compare.
const hmac = (userId, purpose, secret) =>
    crypto.createHmac('sha256', pepper())
        .update(`${userId}:${purpose}:${secret}`)
        .digest('hex');

const safeEqualHex = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) {
        return false;
    }
    try {
        return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch (_) {
        return false;
    }
};

// Cryptographically-secure zero-padded 6-digit code.
const generateCode = () =>
    crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');

// True if this account sent a code too recently (used to throttle resends).
const isOnCooldown = (user) => {
    if (!user.otpLastSentAt) return false;
    const last = new Date(user.otpLastSentAt).getTime();
    return Number.isFinite(last) && (Date.now() - last) < RESEND_COOLDOWN_MS;
};

const cooldownSecondsRemaining = (user) => {
    if (!user.otpLastSentAt) return 0;
    const last = new Date(user.otpLastSentAt).getTime();
    const remaining = RESEND_COOLDOWN_MS - (Date.now() - last);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};

// Generate + persist a fresh code for `purpose` on the given user model instance.
// Returns the PLAINTEXT code (to be emailed) — it is never stored in plaintext or returned
// to the client. Caller is responsible for sending the email.
const issueCode = async (user, purpose) => {
    const code = generateCode();
    user.otpHash = hmac(user.id, purpose, code);
    user.otpPurpose = purpose;
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    // Blank the legacy plaintext column so nothing usable lingers there.
    user.otp = '';
    await user.save();
    return code;
};

// Validate a submitted code for `purpose`. Enforces purpose match, expiry, attempt lockout and
// a constant-time hash comparison. On success clears the code fields. Returns { ok, reason }.
// `reason` is intentionally coarse so callers can surface a single generic message.
const verifyCode = async (user, code, purpose) => {
    if (!user.otpHash || user.otpPurpose !== purpose) {
        return { ok: false, reason: 'no_code' };
    }
    if (!user.otpExpiresAt || new Date(user.otpExpiresAt).getTime() < Date.now()) {
        return { ok: false, reason: 'expired' };
    }
    if ((user.otpAttempts || 0) >= MAX_ATTEMPTS) {
        return { ok: false, reason: 'locked' };
    }

    const candidate = hmac(user.id, purpose, String(code || ''));
    if (!safeEqualHex(candidate, user.otpHash)) {
        user.otpAttempts = (user.otpAttempts || 0) + 1;
        await user.save();
        return { ok: false, reason: 'mismatch' };
    }

    // Success — burn the code.
    user.otpHash = null;
    user.otpPurpose = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.otp = '';
    await user.save();
    return { ok: true };
};

// After a RESET_PASSWORD code is verified, mint a single-use reset ticket. The ticket secret is
// 256-bit random; only its hash is stored. Returns the PLAINTEXT ticket for the client to hold
// and present at the reset-password step.
const issueResetTicket = async (user) => {
    const ticket = crypto.randomBytes(32).toString('hex');
    user.otpHash = hmac(user.id, PURPOSE.RESET_VERIFIED, ticket);
    user.otpPurpose = PURPOSE.RESET_VERIFIED;
    user.otpExpiresAt = new Date(Date.now() + RESET_TICKET_TTL_MS);
    user.otpAttempts = 0;
    user.otp = '';
    await user.save();
    return ticket;
};

// Validate + consume a reset ticket. On success clears the ticket (single use). { ok, reason }.
const consumeResetTicket = async (user, ticket) => {
    if (!user.otpHash || user.otpPurpose !== PURPOSE.RESET_VERIFIED) {
        return { ok: false, reason: 'no_ticket' };
    }
    if (!user.otpExpiresAt || new Date(user.otpExpiresAt).getTime() < Date.now()) {
        return { ok: false, reason: 'expired' };
    }
    const candidate = hmac(user.id, PURPOSE.RESET_VERIFIED, String(ticket || ''));
    if (!safeEqualHex(candidate, user.otpHash)) {
        return { ok: false, reason: 'mismatch' };
    }
    user.otpHash = null;
    user.otpPurpose = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.otp = '';
    await user.save();
    return { ok: true };
};

module.exports = {
    PURPOSE,
    OTP_LENGTH,
    MAX_ATTEMPTS,
    RESEND_COOLDOWN_MS,
    generateCode,
    issueCode,
    verifyCode,
    issueResetTicket,
    consumeResetTicket,
    isOnCooldown,
    cooldownSecondsRemaining,
};
