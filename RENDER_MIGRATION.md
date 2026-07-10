# AWS → Render migration runbook

This repo has been prepared to run on **Render** (Postgres + persistent disk)
instead of AWS (RDS MySQL + local disk). Code changes are already applied on the
`render-migration` branch; the steps below are the one-time ops you run.

## What changed in the code

| Area | Change |
| --- | --- |
| DB driver | `mysql2` → `pg` + `pg-hstore` (`server/package.json`) |
| DB connection | `server/models/index.js` now reads `DATABASE_URL` (Postgres over SSL); `config/config.json` is only used for local dev |
| Dialect fixes | Quoted camelCase identifiers in raw `literal()` SQL; `IFNULL`→`COALESCE`; `""`→`''`; inlined the `Receiver_user_id` alias in chat queries; `TINYINT`→`SMALLINT` |
| Schema portability | Removed the MySQL-only `PRIMARY`-named index from all models; made `providerDetails.providerId` `unique` (Postgres FK targets need a unique constraint); numeric columns with `defaultValue: ""` → `null`; removed per-table index names that collided in Postgres' per-schema namespace (`bookingId` on reports vs reviewrating) so Sequelize auto-names them |
| Dep bumps | Bumped 2018-vintage express-generator pins (ejs 2→3, express 4.16→4.21, http-errors 1→2, morgan, debug, cookie-parser) — required to install behind Replit's package firewall; all within-ecosystem-compatible and identical on Render |
| Uploads | `helper/helper.js` + `shipone.js` now use `UPLOAD_DIR` (the mounted disk) instead of `public/images` |
| Maintenance scripts | `update_db.js` / `checkSchema.js` rewritten to be dialect-agnostic |
| Frontends | API base URLs are now env-driven (`REACT_APP_API_URL`, `VITE_API_URL`) |
| Infra | `render.yaml` blueprint defines all 3 services + DB + disk |

## Running locally in Replit (dev)

The app runs in this Replit against the **Replit-provided Postgres** dev DB — the
same code path that runs on Render, so it doubles as a live test of the port.

- **Connection:** Replit injects `DATABASE_URL` (with `?sslmode=disable`). The DB
  code turns SSL off when the URL says so or `DATABASE_SSL=false`, and on
  otherwise — so Render (SSL required) and Replit (SSL off) both work unchanged.
- **Dev env:** `server/.env` (gitignored) holds `PORT=5000`, `JWT_SECRET`, and
  dummy Stripe/SMTP so the app boots. It does **not** set `DATABASE_URL`, so the
  Replit-injected one wins (dotenv doesn't override existing env vars).
- **Schema:** created by `sequelize.sync()` on first boot (all 20 tables). Verified
  working, including the ported `literal()` provider/forwarder queries.
- **One codebase, two serving modes:** `shipone.js` serves a frontend build only
  if its folder is present (`serveClient`/`serveWebsite`). On Replit the builds
  are present → single-URL staging monolith. On Render's API service they're never
  built (`rootDir: server`) → the server is API-only and the frontends are separate
  Static Sites. No config flags, no drift in the API/DB/socket code.
- **Run:** click **Run** — the `Server` workflow runs `cd server && node shipone.js`
  on port 5000, forwarded to the dev domain. Logs `Frontend serving: ON (staging
  monolith)`.
- **Admin panel (client):** rebuilt for staging — points at the Replit origin via
  `client/.env.local` (gitignored). Rebuild after changes with
  `cd client && CI=false node node_modules/react-scripts/bin/react-scripts.js build`.
- **Public website:** **cannot be built on Replit** — its deps (swiper + others)
  are hard-blocked by Replit's Socket Security firewall (Critical-CVE policy), at
  every version. It builds fine on Render (no firewall). Its stale prod-pointed
  build was moved to `website/dist.prodbuild-stale` so staging does NOT serve a
  prod-pointed booking form (which would write to the prod DB). Stage the website
  on a **Render preview environment** instead, or restore that folder for a
  visual-only look (accepting it calls prod).

## Step 1 — Create the services

Push `render-migration`, then in Render: **New → Blueprint**, point at this repo.
It provisions `vershipgo-db` (Postgres), `vershipgo-api` (web), and the two
static sites. Fill every `sync: false` env var in the dashboard (Stripe, SMTP,
`JWT_SECRET`, etc. — see `render.yaml` for the full list).

## Step 2 — Migrate the data (MySQL → Postgres)

Use **pgloader** — it maps types and copies data in one pass. From a machine
that can reach both databases:

```bash
# pgloader command file: migrate.load
cat > migrate.load <<'EOF'
LOAD DATABASE
  FROM mysql://USER:PASS@OLD_MYSQL_HOST/vershipgo
  INTO postgresql://USER:PASS@RENDER_PG_EXTERNAL_HOST/vershipgo
WITH include drop, create tables, create indexes, reset sequences,
     data only = false
SET work_mem to '128MB', maintenance_work_mem to '512MB';
EOF

pgloader migrate.load
```

Notes:
- Use the Render Postgres **External** connection string (the internal one only
  works from inside Render).
- pgloader creates the schema from MySQL, so run it **before** the API's first
  boot. The app's `sequelize.sync({ alter: false })` will then no-op against the
  existing tables (it never drops anything).
- After loading, spot-check row counts and that `ENUM`/`SMALLINT` columns look
  right: `SELECT count(*) FROM users;` etc.

## Step 3 — Move existing uploaded files onto the disk

Uploads were never committed (`.gitignore` excludes `public/images`). Copy the
current files from the AWS box into the Render disk once:

```bash
# from the old server, then into the Render disk at /var/data/images
rsync -av OLD_HOST:/path/to/server/public/images/  ./images/
# upload to the disk via a one-off Render shell, or scp into /var/data/images
```

New uploads land in `/var/data/images` automatically and survive deploys.

## Step 4 — Point the frontends at the API

Set on the static sites (Step 1 covers where):
- `vershipgo-admin` → `REACT_APP_API_URL = https://<api-host>/admin`
- `vershipgo-website` → `VITE_API_URL = https://<api-host>`

Redeploy the static sites so the values bake into the build.

## Step 5 — Cut over DNS

Repoint `admin.vershipgo.com` (and the public domain) to the Render services via
custom domains. Keep AWS running until you've verified Render, then decommission.

## ⚠️ Test before cutover — highest-risk areas

Static edits can't prove runtime SQL. Smoke-test these against Postgres first:

1. **Chat / messaging** (`server/socket/socket.js`) — the most MySQL-specific
   code. Exercise: open a conversation list, send a message, load message
   history, and confirm unread counts. This is where a missed identifier quote
   would surface. **⚠️ See "Chat is dead code" below — this cannot be tested in
   this codebase as-is.**
2. **Provider listing / ratings** (`providerController.js`, `webController.js`
   forwarder list) — the `literal()` subqueries for `delivery_avg`, `safety_avg`,
   `review_count`.
3. **File upload + retrieval** — upload a profile/business doc, confirm it saves
   to `/var/data/images` and serves back at `/images/<file>`.

## ✅ Verification performed on Replit/Postgres (2026-07-10)

Runtime-tested against the live Replit Postgres dev DB (SSL off), the same code
path that runs on Render:

- **Boot + schema:** `sequelize.sync()` builds all **20 tables**; server serves
  on port 5000; SSL auto-toggle (`sslmode=disable`) confirmed working.
- **Ported `literal()` rating/forwarder SQL (risk #2) — PASS with real rows.**
  Empty tables can't prove aggregate SQL, so a temporary fixture (1 verified
  provider + `providerDetails` + `barrelsprices` + 2 `reviewrating` rows) was
  seeded and torn down. Results:
  - `/website/get-forwarders` → the `literal()` `review_count` subquery returned
    `2`; quoted camelCase identifiers (`"ratedTo"`, `"deletedAt"`) resolve
    correctly in Postgres; `businessInfo`/`barrelPrices` joins populate.
  - `/website/providerlist` → 200/success (rating aggregate subqueries execute).
  - `/website/ratings` → aggregate computed `averageRating 4.5 / totalReviews 2`.
  - Fixture fully removed afterward (all table counts back to 0).

### ⚠️ Chat is dead code — socket messaging cannot run as-is

`server/socket/socket.js` (`send_message`, `get_message_list`,
`user_constant_list`, read-status) reference **`db.message` and
`db.chat_constant`, which do not exist** — there are no `message`/`chat_constant`
model files, no associations in `models/index.js`/`init-models.js`, and no such
tables in the database. `socket.js` is the *only* file that references them. Any
of these socket events therefore throws `Cannot read properties of undefined`
(swallowed by the handler's try/catch) and silently no-ops.

Implication: the IFNULL→COALESCE / camelCase-quoting port applied to the chat
SQL is **correct but currently unreachable** — it can't be smoke-tested here
because the underlying models were never part of this codebase. Two paths:
- If chat is **not** a launch requirement → nothing to do; it's inert.
- If chat **is** required → the `message` and `chat_constant` Sequelize models
  (and their tables/associations) must be authored before this code runs. That
  is a **feature-completion task, not part of the MySQL→Postgres migration**, and
  needs the original chat schema to reproduce it faithfully.

Also noted (pre-existing, not a migration regression): `send_message` reads
`socketUser.socket_id`, but the users model field is `socketId` — so even with
models present, the recipient live-push targets `undefined`. Flag for whoever
completes the chat feature.
