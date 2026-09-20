# Checkout redesign, milestone payments & Stripe-optional forwarders — plan

Status: **BUILT on stage 2026-09-20** — every item below is ticked with the
script that proves it (see §7). Prod still needs the release checklist in §8.
Written 2026-09-20 after reproducing every reported issue in code, over the
API and in a real Chromium session.

Decisions already taken by the owner:

| # | Decision |
|---|----------|
| D1 | Forwarders can go live without Stripe. VerShip collects, records what it owes, reminds the forwarder to set up payouts; funds transfer automatically once Stripe confirms the account, with a **Collect funds** button as fallback. |
| D2 | "Pay as Your Shipment Moves": **due now = sea freight + service fee**; **later = customs & delivery**. |
| D3 | Guest checkout: shipper name/email/phone captured **before** payment; password / account completion **after**. |
| D4 | Ship-It Florida prod description → cleared to empty. |

---

## 1. What is true today (verified)

| Area | Finding | Evidence |
|------|---------|----------|
| Forwarder gate | Quote matching filters `users.hashAccount='1'` (Stripe Express onboarding complete). Payment intent rejects any other provider. Doc-verified, active forwarders without Stripe are listed on `/forwarders` but never quoted (prod: Swift Pulse 308). | `webController.js:3014,3472`, `stripeController.js:83`; API test: flipping 417 to `'0'` removed it from quotes. |
| Charge model | Every booking is a **destination charge** (`transfer_data.destination` + `application_fee_amount`), so the forwarder's connected account must exist at charge time. | `stripeController.js:130-137` |
| Amount trust | `createPaymentIntent` charges **`req.body.amount`** as sent by the browser. `updateBookingPayment` later trusts Stripe's `amount_received`, but the charge itself is client-priced. | `stripeController.js:8-26` |
| Webhook bug | `account.updated` sets `hashAccount='1'` for *any* update, without checking `capabilities.transfers === 'active'` (the return-URL handler does check). A half-onboarded forwarder can be flagged payable. | `shipone.js:82-95` vs `stripeController.js:225-233` |
| Journey | Login required before quotes. Quotes page: Best Quote at y≈488px, **Review & Order 2,812px lower**, below 29 inputs in 4 blocks (Primary, Secondary, Shipper, Delivery — Recipient and Delivery are the same person twice). Payment is a further page + a modal. | screenshots B-*, D-* |
| Pay-all-upfront | `paynowamount = finalTotal`, `pay_later: "0"`. Only later-payment mechanism is forwarder-added "additional costs". | `ShipmentDetailsSection.jsx:486,865`, `webController.js:858-975` |
| Phone | Flat 8–15 digit rule for every country; Jamaica shows +1876 and rejects 7 local digits. | `countryPhoneData.js:19-30`; browser: "Phone number must be 8-15 digits" |
| Ship-It Florida | `providerDetails.description = "1111111111"` on **prod** (stage empty). Shown under "Descriptions" on Payment Overview. | prod read-only query; `ShipmentDetailsSection.jsx:578` |
| Statuses | Booking status enum: 0 Pending, 1 Shipped, 2 Delivered, 3 Dispatched, 4 Cancelled/Complete. No "arrived / customs" step to hang a later charge on. | `webController.js:4535-4540` |

---

## 2. Architecture review

### 2.1 Payouts for forwarders without Stripe (D1)

**Options considered**

| Option | Verdict |
|--------|---------|
| A. Keep destination charges, create the Express account early and point `transfer_data` at it | ✗ Stripe rejects transfers to accounts whose `transfers` capability isn't active (`insufficient_capabilities_for_transfer`). |
| B. Manual bank payouts outside Stripe | ✗ Owner rejected; no audit trail; 1099 burden on VerShip. |
| C. **Separate charges and transfers**: charge the platform, ledger the amount owed, `transfers.create` later | ✓ Stripe's documented use case ("charges created before the destination account is known"). Same merchant-of-record position as today. |

**Chosen: C.** Constraints verified in Stripe's docs and how we handle each:

| Constraint | Handling |
|-----------|----------|
| Transfer fails if it exceeds the platform's **available balance**; no auto-retry. Automatic payouts to VerShip's bank sweep the balance. | Owner sets **Minimum balance for automatic payouts** in the Stripe Dashboard to ≥ total owed (admin page shows the number). Transfers use `source_transaction` so they queue behind still-settling charges. Failed transfers → row `failed`, admin alert, retry button. |
| Transfer ≤ source charge, same currency, several transfers per charge allowed. | One ledger row per (booking, charge). Milestone charges are separate PaymentIntents → separate rows. |
| Platform and connected account same region. | Express accounts are created with `country: 'US'`; platform is US. |
| Refunds/disputes debit the platform. | Refund before transfer → ledger row `reversed`. Refund after transfer → `transfers.createReversal` then refund. |
| No Stripe deadline for platform-held funds, but holding third-party money indefinitely is a compliance/optics risk. | Reminder escalation; after 30 days owed with no onboarding → admin alert to resolve (refund or off-platform payout marked `written_off`). |
| Account links expire in minutes. | Reminder emails link to `/businessProfile`, which mints a fresh link. |

**Design**

- Table `forwarder_payouts`: `id, booking_id, booking_charge_id, provider_id, payment_intent_id, charge_id, gross_cents, platform_fee_cents, amount_owed_cents, currency, status ENUM(owed, transferring, transferred, failed, reversed, written_off), transfer_id, transferred_at, failure_reason, reminder_count, last_reminder_at, created_at, updated_at`. Unique on `(charge_id)`.
- Rows are created **only by the `payment_intent.succeeded` webhook** (idempotent on `charge_id`). Never by the client.
- `createPaymentIntent`: if provider has `hashAccount='1'` **and** `capabilities.transfers==='active'` → destination charge exactly as today (Yard & Aboard / Ship-It Florida unchanged). Else → plain platform charge with `transfer_group: booking_<id>`, metadata `payout_mode: 'held'`.
- Split rule unchanged: `platform_fee = round(amount × (adminCommission + serviceFee) / 100)`; `amount_owed = amount − platform_fee`.
- `payoutService.collect(providerId)`: for each `owed`/`failed` row → `transfers.create({amount, currency, destination, source_transaction: charge_id, transfer_group, metadata})`; write `transfer_id`, status. Runs (a) from the `account.updated` webhook once transfers are active, (b) from the return URL, (c) from the **Collect funds** button, (d) nightly for `failed` rows only if admin re-armed them.
- Fix the `account.updated` webhook to require `capabilities.transfers === 'active'` before setting `hashAccount='1'`.
- Reminders (`payoutReminderJob`, daily via `setInterval(...).unref()` as the existing rate-limit sweeper does; guarded by a `payout_reminders_last_run` row so multiple instances don't double-send): forwarders with `SUM(owed) > 0` and `hashAccount != '1'` → email on day 1, 3, 7, then every 7 days; also immediately on each new held booking. Day 30 → admin email. Template: amount held, list of order IDs, "Set up payouts" button → `/businessProfile`.
- Forwarder UI (`/businessProfile` + `/earning`): **Held for you: $X** card; states: *needs setup* (CTA = existing "Start Collecting Payments"), *ready* (CTA = Collect funds), *transferred* (list with dates).
- Admin UI `/admin/payouts`: totals (owed / transferred / failed), per-forwarder rows, drill-down per booking, **Retry** for failed, **Write off** with reason. Headline "Keep at least $X in Stripe" mirrors the owed total.
- Quote matching & pay gate switch from `hashAccount='1'` to `providerDetails.documentVerify=1 AND users.status='1'`.

**Stripe Dashboard tasks for the owner** (both test and live): enable minimum balance; ensure the webhook endpoint subscribes to `payment_intent.succeeded`, `account.updated`, `charge.refunded`, `transfer.reversed` (webhook secret already exists per env).

### 2.2 Milestone payments (D2)

**Options**

| Option | Verdict |
|--------|---------|
| Reuse `booking_additional_costs` as-is for the later charge | ✗ It is forwarder-typed free text with no kind/trigger; the customer UI calls it an "additional cost". |
| **Generalise into `booking_charges`** with a `kind` | ✓ One table, one pay flow, one webhook branch, one History UI. Existing additional-cost rows migrate as `kind='extra'`. |

**Design**

- Table `booking_charges`: `id, booking_id, provider_id, user_id, kind ENUM(deposit, customs_delivery, extra), description, amount_cents, currency, status ENUM(pending, paid, cancelled), due_trigger ENUM(checkout, arrived, manual), payment_intent_id, charge_id, paid_at, notified_at, created_at`. Migration: `booking_additional_costs` → `booking_charges(kind='extra')`; keep the old table read-only for one release, then drop.
- At booking creation the server computes the quote and writes two rows: `deposit` (sea freight + service fee, `due_trigger=checkout`) and `customs_delivery` (parish fee, `due_trigger=arrived`, status pending). Pickup surcharge (own-barrel beyond radius) and drop-off add-on belong to the **deposit** — they are performed before the ship sails.
- Trigger: add booking status **`5` = "Arrived in Jamaica"** (PG: `ALTER TYPE enum_bookings_status ADD VALUE '5'`; migration per env). Forwarder flow becomes Pending → Dispatched → Shipped → **Arrived** → Delivered. Marking Arrived flips the `customs_delivery` row to due, emails + pushes the customer ("Your barrel has arrived — $X customs & delivery is now due") with a pay link into History. Forwarder sees an "Unpaid" badge until paid; we do **not** block Delivered (operational decision left to the forwarder).
- Customer History: existing "Pay now" modal generalised to any pending `booking_charges` row; Order card shows Paid / Due-now / Due-later lines.
- Each milestone is its own PaymentIntent (`metadata.bookingChargeId`) → its own `forwarder_payouts` row; destination vs held is decided per charge at pay time, so a forwarder who onboards between deposit and customs gets the second one directly.
- `bookings.pay_now_price / pay_later_price / total_amount` are kept in sync for the admin pages that read them.

### 2.3 Checkout redesign (issues 2 & 5)

**Layout** (one page after picking a quote, replacing `/quotes-shipown` form half + `/detail` + modal):

```
┌─────────────────────────────────┬──────────────────────────────────┐
│ 1. Your details (shipper)       │ Pay as Your Shipment Moves       │
│    name · email · phone         │ "After entering recipient's      │
│    pickup address (own barrel)  │  details, you will see the       │
│                                 │  remaining estimated charges…"   │
│ 2. Recipient in Jamaica         │                                  │
│    name · phone (+1876 ▾ 7 dig) │ Due now                          │
│    email (optional)             │   Sea freight 1 × $50   $50.00   │
│    street · town · parish       │   Service fee            $6.00   │
│    (parish pre-filled from      │ Estimated later                  │
│     step 1, editable)           │   Customs & delivery    $25.00   │
│                                 │   (St. Andrew, due on arrival)   │
│ Add-ons  ☑ ☐ ☐                  │ ─────────────────────────────    │
│                                 │ [ Stripe Payment Element ]       │
│                                 │ [ Pay $56.00 now ]               │
└─────────────────────────────────┴──────────────────────────────────┘
```

- Secondary Contact removed entirely (payload keys sent empty; server columns untouched).
- Recipient + Delivery merged (one block; `consignee_*` and `primary_*` both written from it, so admin/forwarder pages keep working).
- Stripe **Payment Element inline** with the deferred-intent pattern: `<Elements options={{mode:'payment', amount, currency}}>` mounts immediately; on submit → `elements.submit()` → `POST /website/create-booking` (server prices the booking, creates rows + PaymentIntent, returns `clientSecret`) → `stripe.confirmPayment({elements, clientSecret, redirect:'if_required'})`. No modal, no second page.
- Order summary is computed **server-side** by `GET /website/quote-breakdown?requestId&providerId` (new) and rendered read-only; the client no longer computes money it will be charged. Port of `website/src/utils/pricing.js` to `server/helper/pricing.js` with a fixture test asserting both agree.
- Mobile: columns stack, summary + pay button become a sticky bottom sheet.
- Quote cards: keep the existing list; picking a card scrolls into the checkout, and the (renamed) **Continue to checkout** button sits directly under the Best Quote card as well as at the bottom.
- Success screen: receipt summary, "what happens next" timeline (Picked up → Shipped → Arrived: customs due → Delivered), and the account step from 2.4.

### 2.4 Guest checkout (D3)

**Options**

| Option | Verdict |
|--------|---------|
| Anonymous bookings (`userId NULL`) + claim later | ✗ Every downstream page, email and forwarder view assumes a user; `users.email/phoneNumber` NOT NULL is fine but bookings without an owner leak everywhere. |
| **Deferred-password account**: create the user silently at "Pay now" from the shipper block, issue the normal JWT, continue through the existing endpoints | ✓ Zero changes to the 30+ endpoints that read `req.user`. Password/OTP completed after payment. |

**Design**

- Landing form for guests: no login redirect. `POST /website/guest-quotes` returns providers for a payload without persisting (pure function extracted from `getAvailableQuotes`); the request itself is persisted at pay time.
- "Pay now" for a guest → `POST /website/guest-checkout`: validates shipper block; if email unknown → create user `{role:'1', otpVerify:'0', password:<random hash>, account_state:'pending_password'}`, sign JWT, save booking request, then the normal create-booking path. If email **exists** → 409 → UI shows inline "Welcome back — enter your password" (or "email me a sign-in code", reusing the OTP infra). Never attach a booking to an existing account without proof.
- After payment: "Secure your account" card — set password (+ the existing 6-digit email code so the address is verified). Skippable; the receipt email carries a tokenised "set your password" link (24h). Until set, the account can't log in with a password but the session JWT keeps the success page and History working.
- Rate-limit `guest-checkout` with the existing `authRateLimiter`.

### 2.5 Phone (issue 3)

- `countryPhoneData.js`: per-country rules map (`JM: {local: 7, strip: ['1876','876']}`, `US/CA: {local: 10, strip: ['1']}`, default 8–15). `validatePhoneForCountry` and a new `normalizePhoneForCountry` used by every caller (Signup, Contact ×2, Edit, BarrelRequestForm, QuotesShipownHistory, Business* forms, checkout).
- Server: `register` and `createBooking` normalise the same way so stored `phoneNumber` is always the local part and `countryCode` the dial code.

### 2.6 Data fix (D4)

- `UPDATE "providerDetails" SET description = '' WHERE id = 500 AND description = '1111111111';` on prod via `PROD_DB_URL`, wrapped in a transaction, row count asserted = 1, before/after printed.

---

## 3. Build list with acceptance criteria

Each item lists **Code AC** (unit/API — provable without a browser) and **Visual AC** (a Playwright script under `e2e/` driving the real built site on `:5000`, screenshots kept). An item is done only when both pass and the screenshot is reviewed.

### Phase 0 — Groundwork

| ID | Item | Code AC | Visual AC |
|----|------|---------|-----------|
| 0.1 | `server/helper/pricing.js` port + fixture test | `node server/tests/pricing.test.js` passes on 12 fixtures (v2 own/dropoff, legacy, tiers 1/5/10, each parish) with identical output from `website/src/utils/pricing.js`. | — |
| 0.2 | `GET /website/quote-breakdown` | Returns `{dueNow:{lines,total}, later:{lines,total}, currency}`; 404 for a provider not quoted for the request; 401 without auth or guest token. | — |
| 0.3 | Webhook hardening | `account.updated` with `transfers: 'pending'` leaves `hashAccount='0'`; with `'active'` sets `'1'` and triggers collect. Stripe CLI replay test. | — |
| 0.4 | Migrations `migrate-booking-charges.js`, `migrate-forwarder-payouts.js`, `migrate-booking-status-arrived.js` | Idempotent (re-run = no-op); existing `booking_additional_costs` rows appear as `kind='extra'` with same amounts/status. Run on stage. | — |

### Phase 1 — Payouts (D1)

| ID | Item | Code AC | Visual AC |
|----|------|---------|-----------|
| 1.1 | Gate switch | Quotes include a doc-verified, `status='1'`, `hashAccount='0'` provider (stage: ShippingJa 396 once doc-verified, or 417 flipped). Deactivated (`status='0'`) or unverified providers still excluded. | `e2e/payouts.mjs` §A: quote list shows the un-onboarded forwarder; screenshot. |
| 1.2 | Held charge | `createPaymentIntent` for that provider creates a PI **without** `transfer_data`, with `transfer_group=booking_<id>` and `metadata.payout_mode='held'`; for an onboarded provider the payload is byte-identical to today's. Amount comes from 0.2, not the body (body amount ignored; mismatch logged). | §B: pay with `4242…` → success screen; Stripe test dashboard shows platform charge, no transfer. |
| 1.3 | Ledger | Webhook creates exactly one `forwarder_payouts` row per charge (replaying the event = still one). `amount_owed = amount − round(amount×pct/100)`. | — |
| 1.4 | Forwarder "Held for you" | `GET /website/payouts/me` returns owed/transferred totals + rows. | §C: log in as that forwarder → profile shows "Held for you $X" + "Start Collecting Payments"; screenshot. |
| 1.5 | Auto-transfer on onboarding | Simulated `account.updated` (transfers active) → `transfers.create` called with `source_transaction=charge_id`, row → `transferred`, `transfer_id` stored. Stripe test mode: transfer visible on the connected account. | §D: after onboarding, profile shows "Transferred $X on <date>"; screenshot. |
| 1.6 | Collect funds button | Click → collects `owed` + `failed` rows; button disabled when nothing owed; failure shows reason. | §E: button state before/after; screenshot. |
| 1.7 | Reminders | Job selects the right forwarders (day 1/3/7/weekly rule unit-tested against fixed dates); email rendered with amount + order IDs; `reminder_count` increments; no email when owed = 0. Day-30 admin email. | Rendered email HTML saved to `e2e/out/` and eyeballed. |
| 1.8 | Admin `/admin/payouts` | API: totals, filter by status/forwarder; Retry re-runs a `failed` row; Write-off requires reason and role 0. | §F: page renders totals + rows; retry on a forced-failure row; screenshot. |
| 1.9 | Refund paths | Refund of a held booking → row `reversed`; refund after transfer → reversal created then refund; both verified with Stripe CLI events. | — |

### Phase 2 — Milestones & checkout (D2, issues 2/5)

| ID | Item | Code AC | Visual AC |
|----|------|---------|-----------|
| 2.1 | `booking_charges` at booking creation | Two rows per booking: `deposit` (= sea + service [+ pickup surcharge + dropoff add-on]) and `customs_delivery` (= parish fee); sum equals today's `finalTotal` for the same inputs (fixture test). | — |
| 2.2 | Checkout page | Single route `/checkout/:requestId/:providerId`; `create-booking` returns `clientSecret`; server rejects if request/provider mismatch or already paid. | `e2e/checkout.mjs` §A: quote → checkout in one click; recipient + payment side by side at 1400px; **no** "Secondary Contact"; heading "Pay as Your Shipment Moves" + blurb present; Due now / Estimated later with correct numbers; Payment Element visible without scrolling on desktop; pay with `4242…` → success. §B: 390px viewport — stacked, sticky pay bar, no horizontal scroll. Screenshots of each. |
| 2.3 | 3DS card | `4000 0025 0000 3155` → auth challenge → success; declined card `4000 0000 0000 9995` → inline error, no booking marked paid. | §C screenshots. |
| 2.4 | "Arrived" status | Forwarder can set 5 only from 1 or 3; sets `customs_delivery` due, `notified_at`, sends email + push. | §D: as forwarder mark Arrived → as customer, History shows "Customs & delivery $25 — due now" with Pay; pay → Paid. Screenshots. |
| 2.5 | Existing additional costs | Forwarder "add cost" still works and appears as `extra`. | §E screenshot. |
| 2.6 | Admin pages | Bookings list/detail show deposit/later/extra lines; totals unchanged for legacy bookings. | §F screenshot. |

### Phase 3 — Guest checkout (D3)

| ID | Item | Code AC | Visual AC |
|----|------|---------|-----------|
| 3.1 | Guest quotes | `POST /website/guest-quotes` returns the same providers as the logged-in path for identical payloads (fixture). No DB writes. | `e2e/guest.mjs` §A: logged-out user gets quotes; screenshot. |
| 3.2 | Guest pay | New email → user created `pending_password`, booking + charge rows, PI; JWT returned. Existing email → 409, nothing written. | §B: guest pays → success page; §C: existing email → inline "Welcome back" login; screenshots. |
| 3.3 | Secure account | Set password + code → `otpVerify='1'`, can log in; skip → receipt email has a working 24h link; expired link → clear error. | §D screenshots. |
| 3.4 | Abandon protection | Booking exists with shipper email/phone even if the user closes the tab on the success page (DB check). | — |

### Phase 4 — Phone & data

| ID | Item | Code AC | Visual AC |
|----|------|---------|-----------|
| 4.1 | Per-country phone | Unit table: JM `5551234` ✓, `8765551234` → stored `5551234` ✓, `18765551234` → `5551234` ✓, `55512` ✗; US `4125550123` ✓, `5550123` ✗; default 8–15 preserved for others. Server normalises identically. | `e2e/phone.mjs`: Signup and checkout accept 7 digits with +1876 selected; error copy reads "Enter the 7-digit number after +1876". Screenshots. |
| 4.2 | Ship-It Florida | Prod row updated; count = 1; description now `''`. | Prod payment overview for a Ship-It Florida quote shows "No description available" (screenshot from prod, read-only browsing). |

### Phase 5 — Regression & release

| ID | Item | AC |
|----|------|----|
| 5.1 | Full-app browser regression | `e2e/smoke-after-baseprice-removal.mjs` + `e2e/verify-ux-issues.mjs` (updated to the new flow) + new scripts all green; zero console errors / 4xx-5xx on every route. |
| 5.2 | Stage soak | Two real test bookings (held + destination) end-to-end on stage in Stripe test mode, including Arrived → customs paid → transfer. |
| 5.3 | Release checklist | Migrations run on prod in order; Stripe live: minimum balance set, webhook events enabled; `replit.md` + memory updated; rollback = feature flag `PAYOUTS_HELD_ENABLED=false` returns to today's gate. |

---

## 4. Sequencing & effort (rough)

1. Phase 0 (½ day) → 2. Phase 1 (2 days) → 3. Phase 2 (2–3 days) → 4. Phase 3 (1 day) → 5. Phase 4 (½ day) → 6. Phase 5 (½ day).
Payouts first because it is the piece with real money-movement risk and the one the checkout page depends on (held vs destination decision at pay time).

## 5. Risks

| Risk | Mitigation |
|------|-----------|
| Platform balance swept before transfer | Minimum balance in Stripe; admin headline number; failed-transfer alerting + retry. |
| Pricing drift between client and server | Server is the source of truth (0.1/0.2); client only renders. |
| Enum change on `bookings.status` on prod | Same `ALTER TYPE … ADD VALUE` pattern already used for `'4'`; migration script per env. |
| Forwarders never onboarding | Reminders + day-30 admin escalation; write-off path. |
| Guest email typos | Email shown back on the success screen with "wrong email? fix it" before the receipt is sent; receipt goes out after 60 s or on confirm. |

## 6. Open points (need an answer before Phase 2)

1. New status name/label: "Arrived in Jamaica" — OK? Should forwarders be *able* to mark Delivered while customs is unpaid (proposed: yes, with an Unpaid badge)?
2. Reminder cadence day 1/3/7/weekly and day-30 admin escalation — OK?
3. Minimum balance in Stripe: owner action; we'll surface the number, but someone must set it in the Dashboard.

---

## 7. Build status (2026-09-20)

| Item | Status | Proof |
|------|--------|-------|
| 0.1 server pricing + fixture test | ✅ | `node server/tests/pricing.test.mjs` (8 fixtures + spot checks) |
| 0.2 `GET/POST /website/quote-breakdown` | ✅ | `server/tests/payouts.api.test.mjs` §0.2; checkout UI figures match server (`e2e/checkout.mjs` §A) |
| 0.3 webhook hardening (`account.updated` checks capabilities; module `helper/stripeWebhook.js`) | ✅ | `payouts.api.test.mjs` §0.3 |
| 0.4 `migrate-checkout-payouts.js` (enum '5', users columns, tables, additional costs → charges, historical deposits) | ✅ stage + prod | stage ran twice, idempotent; prod run 2026-09-20 (21 paid bookings backfilled) |
| 1.1 gate switch (doc-verified + active, Stripe no longer required; `PAYOUTS_HELD_ENABLED=false` rolls back) | ✅ | api §1.1, `e2e/payouts.mjs` §A |
| 1.2 held charge (platform charge, `transfer_group`, amount from DB) | ✅ | api §1.2 |
| 1.3 ledger (`forwarder_payouts`, replay-safe) | ✅ | api §1.3 |
| 1.4 forwarder "Held for you" card (profile + earnings) | ✅ | `e2e/payouts.mjs` §C |
| 1.5 auto-transfer on onboarding (`source_transaction`) | ✅ real Stripe test transfer | api §1.5, e2e §D |
| 1.6 Collect funds button | ✅ | e2e §E |
| 1.7 instant "new booking paid" email on each held payment + reminders day 1/3/7/weekly + day-30 admin escalation, job guarded by `job_runs` | ✅ | api §1.7 schedule; live job run sent + skipped second run; template screenshot |
| 1.8 admin `/admin/payouts` (totals, min-balance hint, per-forwarder, retry, write-off) | ✅ | e2e §F |
| 1.9 refund → ledger reversed + transfer reversal | ✅ | api §1.9 |
| 2.1 `booking_charges` deposit + customs_delivery at booking creation | ✅ | api §2.1 |
| 2.2 one-page checkout (side by side, no Secondary Contact, heading + blurb, inline Payment Element, 390px) | ✅ | `e2e/checkout.mjs` §A/§B |
| 2.3 3DS + declined cards | ✅ | checkout §C |
| 2.4 Arrived in Jamaica → customs due → email/push → pay in History | ✅ | checkout §D |
| 2.5 forwarder extras via charges | ✅ | checkout §E |
| 2.6 admin bookings show charge rows (+ fixed leftover "ride" status labels) | ✅ | `e2e/admin-booking-charges.mjs` |
| 2.7 admin bookings screens relabelled (Ride/Driver/Passenger → Order/Forwarder/Barrels/Route; dead ride-type helper removed; controller includes route + quantity) | ✅ | `e2e/admin-booking-charges.mjs`; routes 48/48; grep shows no ride/driver/passenger labels |
| 3.1 guest quotes | ✅ | `e2e/guest.mjs` §A |
| 3.2 guest pay → pending-password account; existing email → inline sign-in | ✅ | guest §B/§C |
| 3.3 set password on success page / 24h email link / expired link | ✅ | guest §B/§D |
| 3.4 abandon protection (shipper contact captured before payment) | ✅ | guest §B (user row + booking exist before the password step) |
| 4.1 per-country phone (JM 7 digits, strip 876/1876; server normalises) | ✅ | `e2e/phone-and-routes.mjs` §4.1; checkout uses 7 digits |
| 4.2 Ship-It Florida description cleared on prod | ✅ prod | one-row UPDATE, rowCount 1, before/after logged |
| 5.1 route regression (48 checks, 4 roles, zero console / 4xx-5xx) + legacy smoke (29/29) | ✅ | `e2e/phone-and-routes.mjs`, `e2e/smoke-after-baseprice-removal.mjs` |

Retired: `/detail` (Payment Overview + modal) now redirects to `/history`; `Quotes.jsx`, `QuotesShipownHistory.jsx`, `QuotesShipown.jsx` (old) kept as `*.legacy.jsx`, unrouted, for one release.

## 8. Release checklist (prod)

1. ✅ done 2026-09-20 — `node server/migrate-checkout-payouts.js` against prod (idempotent; adds enum '5', user columns, new tables, copies additional costs, backfills deposit rows for paid bookings).
2. Stripe **live** Dashboard: Settings → Payouts → **Minimum balance** ≥ the "Keep at least $X" figure on `/admin/payouts` (starts at $0; raise as held payments arrive).
3. ✅ done 2026-09-20 — Stripe live webhook endpoint (`/stripe/webhook`) receives `payment_intent.succeeded`, `account.updated`, `charge.refunded`.
4. Deploy (Publish). Optional env: `PROD_APP_URL` (email links), `PAYOUTS_HELD_ENABLED=false` to roll back the gate without redeploying code.
5. Smoke on prod with a real card for $1 is not possible (live keys) — verify instead: quotes page → checkout renders with Payment Element; `/admin/payouts` loads; a forwarder profile shows the payouts card.
