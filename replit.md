# VerShip

Shipping / freight-forwarding marketplace. This Replit runs the whole app as
**one full-stack service**, and it is where **production** lives: the published
Replit Deployment IS prod. The workspace Run button is stage. Render remains a
possible target (`RENDER_MIGRATION.md` + `render.yaml`) but is not what serves
users today.

## Deploy

- **Publish (Replit Deployment) = production.** `.replit` `[deployment]` is an
  autoscale target: it builds the frontend, installs server deps, then runs
  `cd server && node shipone.js`.
- Publish builds from the **workspace filesystem, not from git** — uncommitted
  edits ship. Commit for history/Render, not to make a deploy pick a change up.
  (Replit also tends to auto-commit at publish time: the `Published your App`
  commits.)
- Stage vs prod is resolved automatically by `server/helper/envConfig.js`:
  Replit sets `REPLIT_DEPLOYMENT=1` inside a Deployment, so `env('FOO')` reads
  `PROD_FOO` there and `STAGE_FOO` in the workspace, falling back to an
  unprefixed `FOO`. Override with `APP_ENV=stage|prod`. The startup log prints
  which environment resolved.
- `DATABASE_URL` is read straight from `process.env` in `server/models/index.js`
  (**not** through `envConfig`), so the Deployment connects to whatever Replit
  injects for it — it is not switched by the `PROD_` prefix.
- Migrations (`server/migrate-*.js`) are **per environment**: running one in the
  workspace does not touch the deployment's DB.

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
- DB: **PostgreSQL** (Replit Postgres; Render managed Postgres if/when that
  target is used). The DB layer auto-selects SSL by `DATABASE_URL` (off for
  Replit, on for Render).

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
