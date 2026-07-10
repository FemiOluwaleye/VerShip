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

// View engine (required for error.ejs and legacy routes)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware setup
app.use(logger('dev'));

app.post('/stripe/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  console.log('[WEBHOOK] Stripe webhook received');

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('[WEBHOOK] Stripe initialized');

  const db = require('./models');
  console.log('[WEBHOOK] Database models loaded');

  const sig = req.headers['stripe-signature'];
  console.log('[WEBHOOK] Stripe signature captured:', sig ? 'Present' : 'Missing');

  try {
    console.log('[WEBHOOK] Parsing request body');
    let event = JSON.parse(req.body.toString());
    console.log('[WEBHOOK] Event parsed successfully, type:', event.type);

    if (event.type === 'account.updated') {
      console.log('[WEBHOOK] Processing account.updated event');
      const acct = event.data.object;
      console.log('[WEBHOOK] Account data extracted, account ID:', acct?.id);

      try {
        if (acct && acct.id) {
          console.log('[WEBHOOK] Updating user with accountId:', acct.id);
          await db.users.update(
            { hashAccount: '1' },
            { where: { accountId: acct.id } }
          );
          console.log('[WEBHOOK] User updated successfully for accountId:', acct.id);
        } else {
          console.log('[WEBHOOK] Account or account ID missing, skipping update');
        }
      } catch (e) {
        console.error('[WEBHOOK] Error updating user on account.updated webhook:', e);
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      console.log('[WEBHOOK] Processing payment_intent.succeeded event');
      const paymentIntent = event.data.object;
      console.log('[WEBHOOK] Payment intent ID:', paymentIntent.id);

      const bookingId = paymentIntent?.metadata?.bookingId;
      console.log('[WEBHOOK] Booking ID from metadata:', bookingId);

      if (bookingId) {
        console.log('[WEBHOOK] Searching for booking with ID:', bookingId);
        const booking = await db.bookings.findOne({ where: { id: bookingId } });

        if (booking) {
          console.log('[WEBHOOK] Booking found, updating payment status');
          await db.bookings.update(
            {
              payment_status: '1',
              trasaction_id: paymentIntent.id,
            },
            { where: { id: bookingId } }
          );
          console.log('[WEBHOOK] Booking updated successfully, transaction ID:', paymentIntent.id);

          if (booking.booking_request_id) {
            console.log('[WEBHOOK] Updating booking request ID:', booking.booking_request_id);
            await db.booking_requests.update(
              { payment_status: 1 },
              { where: { id: booking.booking_request_id } }
            );
            console.log('[WEBHOOK] Booking request updated successfully');
          } else {
            console.log('[WEBHOOK] No booking_request_id found on booking');
          }
        } else {
          console.log('[WEBHOOK] Booking not found for ID:', bookingId);
        }
      } else {
        console.log('[WEBHOOK] No bookingId in payment intent metadata');
      }
    }

    console.log('[WEBHOOK] Sending success response');
    res.json({ received: true });
    console.log('[WEBHOOK] Response sent successfully');

  } catch (err) {
    console.error('[WEBHOOK] Error caught in try-catch block');
    console.error('[WEBHOOK] Error message:', err.message);
    console.error('[WEBHOOK] Error stack:', err.stack);

    console.log('[WEBHOOK] Sending error response with status 400');
    res.status(400).send(`Webhook Error: ${err.message}`);
    console.log('[WEBHOOK] Error response sent');
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileupload());
app.use(cors());

// Frontend serving. On Replit (staging) the SPAs are built into these folders
// and served here so the whole app previews at one URL. On Render the frontends
// deploy as separate CDN Static Sites, so these folders are absent in the API
// service and the server runs API-only automatically (no dead routes, no 500s).
const buildpath = path.resolve(__dirname, "../client/build");
const websiteBuildPath = path.resolve(__dirname, "../website/dist");
const serveClient = fs.existsSync(path.join(buildpath, "index.html"));
const serveWebsite = fs.existsSync(path.join(websiteBuildPath, "index.html"));
console.log(`Frontend serving: ${serveClient || serveWebsite ? 'ON (staging monolith)' : 'OFF (API-only)'}`);

// User uploads live on the persistent disk (UPLOAD_DIR) in production, or the
// local public folder in dev. Serve them at /images regardless of location so
// the stored `/images/<file>` URLs keep resolving after the move to Render.
const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, "public");
app.use('/images', express.static(path.join(uploadRoot, "images")));
app.use('/admin/images', express.static(path.join(uploadRoot, "images")));

if (serveWebsite) app.use('/dev/shipone/website', express.static(websiteBuildPath));
if (serveClient) app.use(express.static(buildpath));

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
app.use('/admin', adminRouter);
app.use('/api', apiRouter);
app.use('/website', websiteRouter);
// Catch-all for frontend routing (Single Page Apps) — only when the builds are
// present (Replit staging). On Render's API-only service these are skipped so
// unmatched routes fall through to the 404 handler instead of erroring.
if (serveWebsite) {
  app.get('/dev/shipone/website/*', (req, res) => {
    res.sendFile(path.join(websiteBuildPath, "index.html"));
  });
}

if (serveClient) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildpath, "index.html"));
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
