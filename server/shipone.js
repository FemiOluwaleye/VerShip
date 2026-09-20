require('dotenv').config();
const createError = require('http-errors');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const logger = require('morgan');
const fileupload = require('express-fileupload');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
// const admin = require("firebase-admin");

// Safety net for the consolidated single-service architecture: a stray
// un-awaited promise rejection (e.g. a mail/DB call missing .catch) must not
// take down the API + admin + public site for every user. Log and stay up.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason && reason.stack ? reason.stack : reason);
});

/*
// Initialize Firebase Admin
try {
  const serviceAccount = require("./config/firebase-service-account.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin initialized successfully.");
} catch (error) {
  console.error("Firebase Admin initialization failed. Service account might be missing:", error.message);
}
*/

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');
const websiteRouter = require('./routes/website');

const app = express();
const PORT = process.env.PORT || 8182;

// Behind Render/Replit's proxy: trust the first hop so req.ip reflects the real client,
// which the auth rate limiters key on. Scoped to one proxy (not `true`) to avoid IP spoofing.
app.set('trust proxy', 1);

// View engine (required for error.ejs and legacy routes)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware setup
app.use(logger('dev'));

app.post('/stripe/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const { env } = require('./helper/envConfig');
  const stripe = require('stripe')(env('STRIPE_SECRET_KEY'));
  const { handleStripeEvent } = require('./helper/stripeWebhook');
  const sig = req.headers['stripe-signature'];

  const endpointSecret = env('STRIPE_WEBHOOK_SECRET');
  if (!endpointSecret) {
    console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET is not configured — rejecting unverifiable webhook');
    return res.status(500).send('Webhook secret not configured');
  }
  // Verify the event genuinely came from Stripe using the raw request body.
  // Without this, anyone could POST a forged payment_intent.succeeded and mark
  // bookings as paid.
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('[WEBHOOK] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    const result = await handleStripeEvent(event);
    console.log('[WEBHOOK]', event.type, JSON.stringify(result));
    res.json({ received: true });
  } catch (err) {
    // 500 makes Stripe retry the delivery, which is what we want for a DB hiccup.
    console.error('[WEBHOOK] handler failed for', event.type, err);
    res.status(500).send('Webhook handler error');
  }
});

// Daily pass over forwarders who are owed money but can't receive it yet:
// reminder emails (day 1/3/7/weekly) and auto-collect once they connect.
// Guarded by job_runs so a restart or second instance can't double-send.
{
  const { runReminderJob } = require('./helper/payoutService');
  const tick = () => runReminderJob().then((r) => { if (!r.skipped) console.log('[payouts] reminder job:', JSON.stringify(r)); })
    .catch((e) => console.error('[payouts] reminder job failed:', e.message));
  setTimeout(tick, 60 * 1000).unref?.();
  setInterval(tick, 6 * 3600 * 1000).unref?.();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileupload());
app.use(cors());

// --- Security headers (dependency-free; no CSP to avoid breaking the SPA's
// Stripe/Apple/Firebase/Google integrations). Hardens against clickjacking,
// MIME sniffing, referrer leakage and protocol downgrade. ---
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  // Only assert HSTS when the request actually arrived over TLS (via proxy).
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

// --- Basic in-memory rate limiter for auth-sensitive endpoints (brute-force
// mitigation). Generous enough never to affect real users; keyed by client IP.
// In-memory is fine for a single instance; swap for Redis if scaled out. ---
const authAttempts = new Map();
const AUTH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const AUTH_MAX = 40;                   // attempts per window per IP
const authRateLimiter = (req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || 'unknown')
    .toString().split(',')[0].trim();
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || now - entry.start > AUTH_WINDOW_MS) {
    authAttempts.set(ip, { start: now, count: 1 });
    return next();
  }
  entry.count += 1;
  if (entry.count > AUTH_MAX) {
    return res.status(429).json({
      success: false,
      status: 429,
      message: 'Too many attempts. Please try again in a few minutes.',
    });
  }
  next();
};
// Opportunistic cleanup so the Map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of authAttempts) {
    if (now - e.start > AUTH_WINDOW_MS) authAttempts.delete(ip);
  }
}, AUTH_WINDOW_MS).unref?.();

app.use([
  '/website/login', '/website/register', '/website/verify', '/website/resend-otp',
  '/website/forgot-password', '/website/reset-password', '/website/social-login',
  '/api/admin/login', '/api/login',
], authRateLimiter);

// Frontend serving. On Replit (staging) the SPAs are built into these folders
// and served here so the whole app previews at one URL. On Render the frontends
// deploy as separate CDN Static Sites, so these folders are absent in the API
// service and the server runs API-only automatically (no dead routes, no 500s).
// Single unified frontend: the public site (/) and the admin dashboard (/admin/*)
// are ONE Vite build (website/dist). Served by this same web service on both
// Replit and Render. If the build is absent the server runs API-only.
const appBuildPath = path.resolve(__dirname, "../website/dist");
const serveApp = fs.existsSync(path.join(appBuildPath, "index.html"));
console.log(`Frontend serving: ${serveApp ? 'ON (unified app: / + /admin)' : 'OFF (API-only)'}`);

// User uploads live on the persistent disk (UPLOAD_DIR) in production, or the
// local public folder in dev. Serve them at /images regardless of location so
// the stored `/images/<file>` URLs keep resolving after the move to Render.
const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, "public");
app.use('/images', express.static(path.join(uploadRoot, "images")));
app.use('/admin/images', express.static(path.join(uploadRoot, "images")));

// ---- Admin subdomain ----
// The dashboard is reachable at admin.<domain> with clean URLs (/dashboard).
// The SPA detects the host itself (see website/src/admin/adminBase.js); here we
// only handle redirects. ADMIN_HOST (e.g. "admin.vershipgo.com") additionally
// moves the main domain's /admin/* over to the subdomain — leave it unset in
// dev/staging where no subdomain exists and /admin keeps working as before.
// Resolved via envConfig so on Replit's single secret store PROD_ADMIN_HOST
// applies only to the published Deployment, never the workspace Run.
const ADMIN_HOST = require('./helper/envConfig').env('ADMIN_HOST') || "";
const isAdminHost = (req) => /^admin\./i.test(req.hostname || "");
app.use((req, res, next) => {
  const underAdminPath = req.path === '/admin' || req.path.startsWith('/admin/');
  if (!underAdminPath || req.path.startsWith('/admin/images')) return next();
  if (isAdminHost(req)) {
    // Old-style deep link on the subdomain -> clean path (/admin/x -> /x)
    return res.redirect(301, req.originalUrl.replace(/^\/admin\/?/, '/'));
  }
  if (ADMIN_HOST) {
    // Admin moved to its subdomain; keep old main-domain bookmarks working.
    return res.redirect(301, `${req.protocol}://${ADMIN_HOST}${req.originalUrl.replace(/^\/admin/, '') || '/'}`);
  }
  return next();
});

// redirect:false so a prerendered directory route (e.g. dist/about/) isn't
// auto-redirected to a trailing slash before the catch-all can serve it cleanly.
if (serveApp) app.use(express.static(appBuildPath, { redirect: false }));

// Prevent caching for specific routes
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Socket.io setup
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {

  }
});

// Import socket-related logic
try {
  require("./socket/socket")(io);
} catch (error) {
  console.error("Socket initialization failed:", error);
}

// Routes

app.use('/admin', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', indexRouter);
app.use('/users', usersRouter);
// Admin API moved off /admin so the /admin/* URL space belongs to the SPA.
app.use('/api/admin', adminRouter);
app.use('/api', apiRouter);
app.use('/website', websiteRouter);
// Catch-all for frontend routing (Single Page Apps) — only when the builds are
// present (Replit staging). On Render's API-only service these are skipped so
// unmatched routes fall through to the 404 handler instead of erroring.
if (serveApp) {
  app.get('*', (req, res) => {
    // Admin subdomain: every path is an admin SPA route — serve the shell
    // directly and skip the public-site prerender lookup.
    if (isAdminHost(req)) return res.sendFile(path.join(appBuildPath, "index.html"));
    // Prefer a prerendered per-route page (from `npm run prerender`) so crawlers
    // get real content + per-page metadata; otherwise serve the SPA shell.
    // Falls back safely when no prerendered files exist.
    const cleanPath = req.path.replace(/\/+$/, "");
    if (cleanPath && !path.extname(cleanPath)) {
      const candidate = path.resolve(appBuildPath, "." + cleanPath, "index.html");
      if (candidate.startsWith(appBuildPath + path.sep) && fs.existsSync(candidate)) {
        return res.sendFile(candidate);
      }
    }
    res.sendFile(path.join(appBuildPath, "index.html"));
  });
}

// 404 Error handling
app.use((req, res, next) => {
  next(createError(404));
});

// General Error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  const isApiRequest =
    req.path.startsWith('/api') ||
    req.path.startsWith('/admin') ||
    req.path.startsWith('/website') ||
    req.get('accept')?.includes('application/json');

  if (isApiRequest) {
    return res.status(status).json({
      success: false,
      message: err.message || (status === 404 ? 'Not Found' : 'Internal Server Error'),
    });
  }

  res.status(status);
  res.render('error');
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});


module.exports = app;
