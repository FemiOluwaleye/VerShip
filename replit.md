# VerShip

Shipping / freight-forwarding marketplace. This Replit runs the app as a single
artifact (one server) for staging; production targets **Render** (see
`RENDER_MIGRATION.md`).

## Run & Operate

- **Run button** starts the one artifact: the `Server` workflow runs
  `cd server && node shipone.js` on **port 5000** (forwarded to the dev domain).
- It serves the admin panel (`client/build`) at `/` and exposes the REST API
  (`/admin`, `/api`, `/website`) + Socket.IO, backed by the Replit dev Postgres.
- Rebuild the admin UI after changes:
  `cd client && CI=false node node_modules/react-scripts/bin/react-scripts.js build`
- Required env: `DATABASE_URL` (injected by Replit); dev secrets live in
  `server/.env` (gitignored).

## Stack

- App code: `server/` (Express 4 + Sequelize + Socket.IO), `client/` (CRA admin),
  `website/` (Vite public site — builds on Render, not Replit; see below).
- DB: **PostgreSQL** (Replit dev DB locally, Render managed Postgres in prod).
- The old pnpm-workspace template artifacts (hello-world / api-server /
  mockup-sandbox) were removed — VerShip is the only artifact.

## Gotchas

- The **public website can't build on Replit** — its deps (swiper, etc.) are
  blocked by Replit's Socket Security firewall. It builds fine on Render.
- Replit's Bash shell runs with `set -e`; guard `pkill` with `|| true`.
- See `RENDER_MIGRATION.md` for the full Render deployment plan and the
  MySQL→Postgres portability notes.
