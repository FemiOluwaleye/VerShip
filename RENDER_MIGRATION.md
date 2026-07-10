# AWS → Render migration runbook

This repo has been prepared to run on **Render** (Postgres + persistent disk)
instead of AWS (RDS MySQL + local disk). Code changes are already applied on the
`render-migration` branch; the steps below are the one-time ops you run.

> **Now a single full-stack app.** The former three pieces (`server/` API,
> `client/` CRA admin, `website/` Vite public site) were consolidated into ONE
> service: the public site and the admin dashboard are one Vite build
> (`website/dist`, admin lazy-loaded under `/admin`), served by the Express
> server which also exposes the API + Socket.IO. `client/` is gone. Deploys to
> Render as **one web service**, previews on Replit as one Run. The DB/SSL
> portability work below is unchanged.

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
| Frontends | Merged into one Vite app (`website/`): public site + admin (`src/admin/`, lazy `/admin/*`). API is same-origin (`/website/*`, `/api/admin/*`); no build-time API-URL vars. `swiper`→`embla` (Replit firewall); admin auth namespaced to `admin_token` |
| Infra | `render.yaml` blueprint = ONE web service (builds the frontend + runs the server) + DB + disk |

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
- **One build, one server:** `shipone.js` serves `website/dist` (the unified
  build) at `/` (public) and `/admin/*` (admin SPA), plus the API + Socket.IO. If
  the build is absent it runs API-only. Same code path on Replit and Render.
- **Run:** click **Run** — the `Server` workflow builds the frontend
  (`cd website && pnpm install && pnpm run build`) then starts the server
  (`cd ../server && node shipone.js`) on port 5000. Logs
  `Frontend serving: ON (unified app: / + /admin)`.
- **Admin dashboard:** lives at `/admin/*` (login → `/admin/login`), built as part
  of the one Vite build — no separate rebuild. Its Bootstrap/jQuery theme loads
  only under `/admin` (injected/removed by `AdminAssetsLoader`) so it never bleeds
  onto the public Tailwind site; admin code is code-split so public visitors don't
  download it.
- **Public website builds on Replit now:** the sole blocker (`swiper`, hard-blocked
  by Replit's Socket Security firewall) was replaced with `embla-carousel`. The
  whole app builds and previews on Replit.

## Step 1 — Create the services

Push `render-migration`, then in Render: **New → Blueprint**, point at this repo.
It provisions `vershipgo-db` (Postgres) and `vershipgo` (one web service that
builds the frontend and runs the server). Fill every `sync: false` env var in the
dashboard (Stripe, SMTP, `JWT_SECRET`, etc. — see `render.yaml` for the full list).

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

## Step 4 — (nothing to wire — frontend is same-origin)

The frontend calls the API on the same origin (`/website/*`, `/api/admin/*`), so
there are no `REACT_APP_API_URL` / `VITE_API_URL` build vars to set. The single
service serves both. Skip straight to DNS.

## Step 5 — Cut over DNS

Repoint the domain(s) to the one Render service via a custom domain (the public
site is `/`, admin is `/admin`). Keep AWS running until you've verified Render,
then decommission.

## ⚠️ Test before cutover — highest-risk areas

Static edits can't prove runtime SQL. Smoke-test these against Postgres first:

1. **Chat / messaging** (`server/socket/socket.js`) — the most MySQL-specific
   code. Exercise: open a conversation list, send a message, load message
   history, and confirm unread counts. **✅ Built + verified — see below.**
2. **Provider listing / ratings** (`providerController.js`, `webController.js`
   forwarder list) — the `literal()` subqueries for `delivery_avg`, `safety_avg`,
   `review_count`.
3. **File upload + retrieval** — upload a profile/business doc, confirm it saves
   to `/var/data/images` and serves back at `/images/<file>`.

## ✅ Verification performed on Replit/Postgres (2026-07-10)

Runtime-tested against the live Replit Postgres dev DB (SSL off), the same code
path that runs on Render:

- **Boot + schema:** `sequelize.sync()` builds all tables (22 after adding the
  chat models); server serves on port 5000; SSL auto-toggle (`sslmode=disable`)
  confirmed working.
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

### ✅ Chat / messaging (risk #1) — built + verified with real rows

`server/socket/socket.js` (`send_message`, `get_message_list`,
`user_constant_list`, `cont_unread_msg`) used `db.message` and `db.chat_constant`,
which had **no model files** — so the events silently no-op'd. Both models were
**reverse-engineered from socket.js** (the only consumer) and added:
`server/models/message.js` + `chat_constant.js`, with associations in
`models/index.js`. `sequelize.sync()` now creates the `message` + `chat_constant`
tables (22 tables total). Postgres-native types; no MySQL-only constructs.

Also fixed: `send_message` read `socketUser.socket_id`, but the users field is
`socketId` (set on `connectUser`) — so recipient live-push targeted `undefined`.
Now reads `socketId`, so real-time delivery works.

Verified end-to-end with two socket.io clients against Postgres (seeded two
users, torn down after):
- `send_message` A→B delivered to B **in real time** (socketId fix), persisted.
- `get_message_list` returns history with the `CONCAT("firstName","lastName")`
  name literals.
- `user_constant_list` — the most MySQL-specific query — returns the correct
  `Receiver_user_id` (the inlined `CASE` expression), `COALESCE` last message,
  `unread_msg` count (2), and `ReceiverName`.
- `cont_unread_msg` marks read → unread drops to 0.

> **Prod caveat:** if the original prod MySQL DB already has `message`/
> `chat_constant` tables, reconcile these reverse-engineered models with that
> schema before pgloader (sync won't alter existing tables). On a from-scratch
> Postgres they're created correctly.
