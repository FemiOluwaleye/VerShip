# VerShip

Shipping / freight-forwarding marketplace. This Replit runs the whole app as
**one full-stack service** for staging; production targets **Render** as a single
web service (see `RENDER_MIGRATION.md`).

## Run & Operate

- **Run button** builds the unified frontend, then starts the server: the
  `Server` workflow runs
  `cd website && pnpm install && pnpm run build && cd ../server && node shipone.js`
  on **port 5000** (forwarded to the dev domain).
- One Express server serves **everything** off port 5000, backed by the Replit
  dev Postgres:
  - `/` → public site, `/admin/*` → admin dashboard (one Vite build, `website/dist`)
  - `/website/*` (public API), `/api/admin/*` (admin API), `/api`, `/users`
  - Socket.IO on the same port.
- The frontend is one app: the public site (Tailwind) with the admin dashboard
  (Bootstrap/jQuery theme) lazy-loaded under `/admin` and code-split, so admin
  code never ships to public visitors.
- Required env: `DATABASE_URL` (injected by Replit); dev secrets live in
  `server/.env` (gitignored).

## Stack

- `server/` — Express 4 + Sequelize + Socket.IO (JavaScript), serves the built
  frontend + API.
- `website/` — the ONE Vite frontend. Public site under `src/`, admin under
  `src/admin/` (lazy `/admin/*` route). Vendor theme assets under `public/vendor/`.
- DB: **PostgreSQL** (Replit dev DB locally, Render managed Postgres in prod).
  The DB layer auto-selects SSL by `DATABASE_URL` (off for Replit, on for Render).

## Gotchas

- The unified build works on Replit now that `swiper` (firewall-blocked) was
  replaced with `embla-carousel`. Admin's jQuery/Bootstrap theme loads only under
  `/admin` (injected/removed by `AdminAssetsLoader`) so it never bleeds onto the
  public Tailwind site.
- Admin auth uses `admin_token`/`admin_userData` in localStorage (namespaced from
  the public site's `token`). Admin API is at `/api/admin/*` (not `/admin`, which
  is the SPA).
- Replit's Bash shell runs with `set -e`; guard `pkill` with `|| true`.
- The `message`/`chat_constant` chat models still don't exist — the socket chat
  handlers are inert (see `RENDER_MIGRATION.md`).
- See `RENDER_MIGRATION.md` for the full Render deployment plan and the
  MySQL→Postgres portability notes.
