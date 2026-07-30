const db = require("../../models");
const helper = require("../../helper/helper");
const bcrypt = require("bcryptjs");
const { sendPricingChangedEmailToProvider } = require("../../helper/mailHelper");

/*
 * Admin visibility + editing for freight-forwarder pricing (barrelsprices).
 *
 * A "rate card" is ONE barrelsprices row, identified by
 * (providerId, type, originCountry -> destinationCountry). Forwarders
 * legitimately hold several — one per origin route, per barrel type — and
 * website/src/utils/pricing.js selectRateCard() picks among them by route,
 * preferring the v2 model. So everything here is per-card, never per-provider.
 *
 * Three rules this module exists to enforce:
 *
 * 1. NEVER destroy+recreate. The forwarder's own write path (webController
 *    completeProfile) does destroy({providerId, type}) then bulkCreate, which is
 *    fine when the form owns every card but would collapse a 10-card provider
 *    down to whatever an admin form happened to post. Admin writes update ONE
 *    row, scoped by both id and providerId.
 *
 * 2. Keep the three copies of the headline price in sync. The per-barrel price
 *    is stored in barrelsprices.seaFreightPrice (drives v2 quotes),
 *    barrelsprices.barrelPrice/basePrice (drives legacy quotes and the
 *    getAvailableQuotes display override), and providerDetails.basePrice (drives
 *    the public /forwarders card). Writing only one of them makes the public
 *    listing advertise a price checkout will not honour.
 *
 * 3. Route identity is frozen. type / originCountry / destinationCountry / the
 *    lat-longs decide which bookings a card prices; editing them would silently
 *    re-point live matching. Admins change numbers, not routes.
 *
 * Editing a card affects FUTURE quotes only: bookings snapshot their own
 * pay_now_price / subtotal / serviceFee / base_price at booking time.
 */

// Jamaica's 14 parishes — the unit for the v2 combined "Customs & Delivery"
// fee. Must stay in sync with website/src/utils/parishes.js JAMAICA_PARISHES.
const JAMAICA_PARISHES = [
    'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary', 'St. Ann',
    'Trelawny', 'St. James', 'Hanover', 'Westmoreland', 'St. Elizabeth',
    'Manchester', 'Clarendon', 'St. Catherine',
];

// Absurd-value backstop. Not a business rule — a typo catcher, so an extra zero
// on a $395 parish fee is rejected rather than quoted to a customer.
const MAX_MONEY = 100000;
const MAX_MILES = 10000;

// Fields an admin may write, by pricing model. Anything not listed is ignored
// on input (see rule 3 above) rather than erroring, so a client that echoes the
// whole row back does not need to strip it first.
const V2_FIELDS = {
    seaFreightPrice: { label: 'Sea freight (per barrel)', kind: 'money' },
    discount5to9: { label: 'Discount, 5-9 barrels', kind: 'money' },
    discount10plus: { label: 'Discount, 10+ barrels', kind: 'money' },
    pickupCharge: { label: 'Flat pickup charge', kind: 'money' },
    pickupRadius: { label: 'Free pickup radius', kind: 'miles' },
    extraMileageCost: { label: 'Cost per extra mile', kind: 'money' },
    transitTime: { label: 'Transit time', kind: 'text' },
    parishFees: { label: 'Customs & delivery by parish', kind: 'parishFees' },
};

const LEGACY_FIELDS = {
    basePrice: { label: 'Base price (per barrel)', kind: 'money' },
    pricePerMile: { label: 'Price per mile', kind: 'money' },
    freeMiles: { label: 'Free miles', kind: 'miles' },
    customsAndHandling: { label: 'Customs & handling', kind: 'csvMoney' },
    isVolumeDiscount: { label: 'Volume discount enabled', kind: 'bool' },
    discountAfter: { label: 'Volume discount after N barrels', kind: 'int' },
    discountPercent: { label: 'Volume discount percent', kind: 'percent' },
    flatPickupCharge: { label: 'Flat pickup charge', kind: 'money' },
    pickupFreeMiles: { label: 'Pickup free miles', kind: 'miles' },
    pickupPerMileCharge: { label: 'Pickup per-mile charge', kind: 'money' },
    flatDeliveryCharge: { label: 'Flat delivery charge', kind: 'money' },
    deliveryFreeMiles: { label: 'Delivery free miles', kind: 'miles' },
    deliveryPerMileCharge: { label: 'Delivery per-mile charge', kind: 'money' },
    transitTime: { label: 'Transit time', kind: 'text' },
};

// A card uses the v2 model when seaFreightPrice is a positive number. Mirrors
// isPricingV2() in website/src/utils/pricing.js — the two must agree, or admin
// would edit one model while the customer is quoted on the other.
const isPricingV2 = (bp) =>
    bp && String(bp.seaFreightPrice ?? '').trim() !== '' && parseFloat(bp.seaFreightPrice) > 0;

const parseParishFees = (raw) => {
    let fees = raw;
    if (typeof fees === 'string') {
        try { fees = JSON.parse(fees); } catch (e) { return null; }
    }
    if (!fees || typeof fees !== 'object' || Array.isArray(fees)) return null;
    return fees;
};

// Legacy scalar entries (from the pricing-v2 auto-migration) are a flat
// per-order fee; treat them as { first: value, additional: 0 } exactly as
// v2ParishEntry() does client-side.
const parishEntry = (raw) => {
    if (raw === undefined || raw === null || raw === '') return null;
    if (typeof raw === 'object') {
        return { first: parseFloat(raw.first) || 0, additional: parseFloat(raw.additional) || 0 };
    }
    return { first: parseFloat(raw) || 0, additional: 0 };
};

const countParishCoverage = (bp) => {
    const fees = parseParishFees(bp.parishFees);
    if (!fees) return 0;
    return JAMAICA_PARISHES.filter((p) => {
        const e = parishEntry(fees[p]);
        return e && e.first > 0;
    }).length;
};

module.exports = {
    /*
     * GET /admin/pricing
     * Cross-provider pricing index. Answers "who is live, on which model, at
     * what price, and what is stopping the rest" in one request.
     *
     * The four publish gates mirror getForwarders() in
     * server/controller/apicontroller/webController.js — role '2', status '1',
     * providerDetails.documentVerify 1, and at least one live barrelsprices row.
     * They are returned as explicit booleans so the UI names the failing gate
     * instead of just saying "not live".
     */
    pricingOverview: async (req, res) => {
        try {
            const Op = db.Sequelize.Op;
            let { page, limit, search, filter } = req.query;
            page = parseInt(page) || 1;
            limit = parseInt(limit) || 20;

            const where = { role: '2' };
            if (search && search.trim() !== '') {
                const s = search.trim();
                where[Op.or] = [
                    { firstName: { [Op.iLike]: `%${s}%` } },
                    { lastName: { [Op.iLike]: `%${s}%` } },
                    { email: { [Op.iLike]: `%${s}%` } },
                ];
            }

            const providers = await db.users.findAll({
                where,
                attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'status', 'image', 'createdAt'],
                include: [{
                    model: db.providerDetails,
                    as: 'businessInfo',
                    required: false,
                    attributes: ['id', 'businessName', 'documentVerify', 'basePrice', 'transitTime', 'shipmentType'],
                }],
                order: [['id', 'DESC']],
            });

            // One query for every card, grouped in memory. Cheaper and simpler
            // than a correlated subquery per provider, and the table is small.
            const allCards = await db.barrelsprices.findAll({
                paranoid: false,
                order: [['id', 'ASC']],
            });
            const byProvider = new Map();
            for (const row of allCards) {
                const c = row.toJSON();
                if (!byProvider.has(c.providerId)) byProvider.set(c.providerId, []);
                byProvider.get(c.providerId).push(c);
            }

            let rows = providers.map((p) => {
                const u = p.toJSON();
                const cards = byProvider.get(u.id) || [];
                const live = cards.filter((c) => !c.deletedAt);
                const v2 = live.filter(isPricingV2);

                // Two live cards sharing type+route is an ambiguity
                // selectRateCard() resolves arbitrarily — worth flagging.
                const seen = new Map();
                let routeCollisions = 0;
                for (const c of live) {
                    const key = [c.type, c.originCountry, c.destinationCountry]
                        .map((x) => String(x || '').toLowerCase().trim()).join('|');
                    if (seen.has(key)) routeCollisions += 1;
                    seen.set(key, true);
                }

                const ownCard = v2.find((c) => c.type === 'own') || live.find((c) => c.type === 'own') || live[0] || null;
                const gates = {
                    role: String(u.role) === '2',
                    status: String(u.status) === '1',
                    documentVerify: Number(u.businessInfo?.documentVerify) === 1,
                    hasLiveCard: live.length > 0,
                };

                return {
                    id: u.id,
                    businessName: u.businessInfo?.businessName || u.firstName || `Provider ${u.id}`,
                    email: u.email,
                    image: u.image,
                    createdAt: u.createdAt,
                    gates,
                    isLive: Object.values(gates).every(Boolean),
                    failingGates: Object.entries(gates).filter(([, ok]) => !ok).map(([k]) => k),
                    modelVersion: v2.length ? 'v2' : (live.length ? 'legacy' : 'none'),
                    liveCardCount: live.length,
                    v2CardCount: v2.length,
                    staleCardCount: cards.length - live.length,
                    routeCollisions,
                    // Headline price the public listing shows, and the card it
                    // came from, so a mismatch between them is visible here.
                    listedBasePrice: u.businessInfo?.basePrice ?? null,
                    headlinePrice: ownCard
                        ? (isPricingV2(ownCard) ? ownCard.seaFreightPrice : ownCard.barrelPrice)
                        : null,
                    route: ownCard ? `${ownCard.originCountry} → ${ownCard.destinationCountry}` : null,
                    parishCoverage: ownCard ? countParishCoverage(ownCard) : 0,
                    parishTotal: JAMAICA_PARISHES.length,
                };
            });

            if (filter === 'live') rows = rows.filter((r) => r.isLive);
            else if (filter === 'notlive') rows = rows.filter((r) => !r.isLive);
            else if (filter === 'v2') rows = rows.filter((r) => r.modelVersion === 'v2');
            else if (filter === 'legacy') rows = rows.filter((r) => r.modelVersion === 'legacy');
            else if (filter === 'priced') rows = rows.filter((r) => r.liveCardCount > 0);
            else if (filter === 'misconfigured') {
                // Has pricing but cannot be booked, or is bookable but
                // inconsistent — the set worth an admin's attention.
                rows = rows.filter((r) =>
                    (r.liveCardCount > 0 && !r.isLive) ||
                    r.routeCollisions > 0 ||
                    (r.modelVersion === 'v2' && r.parishCoverage < r.parishTotal) ||
                    (r.isLive && r.headlinePrice != null && r.listedBasePrice != null &&
                        parseFloat(r.headlinePrice) !== parseFloat(r.listedBasePrice))
                );
            }

            const totalRows = rows.length;
            const offset = (page - 1) * limit;
            const paged = rows.slice(offset, offset + limit);

            return helper.success(res, 'Pricing overview fetched successfully.', {
                data: paged,
                currentPage: page,
                totalPages: Math.max(1, Math.ceil(totalRows / limit)),
                totalProviders: totalRows,
                summary: {
                    live: rows.filter((r) => r.isLive).length,
                    priced: rows.filter((r) => r.liveCardCount > 0).length,
                    v2: rows.filter((r) => r.modelVersion === 'v2').length,
                    legacy: rows.filter((r) => r.modelVersion === 'legacy').length,
                    unpriced: rows.filter((r) => r.liveCardCount === 0).length,
                },
            });
        } catch (error) {
            console.error('pricingOverview error:', error);
            return helper.error(res, error.message || 'Internal server error');
        }
    },

    /*
     * GET /admin/provider/:id/pricing
     * Every rate card for one forwarder, plus the soft-deleted history (the
     * forwarder's own save path soft-deletes on every edit, so this is where
     * "what did their pricing used to be" is answerable), plus the audit trail
     * of admin edits.
     */
    providerPricing: async (req, res) => {
        try {
            const providerId = parseInt(req.params.id, 10);
            if (!providerId) return helper.error(res, 'Provider id is required.');

            const provider = await db.users.findOne({
                where: { id: providerId, role: '2' },
                attributes: ['id', 'firstName', 'lastName', 'email', 'status', 'role', 'phoneNumber'],
                include: [{ model: db.providerDetails, as: 'businessInfo', required: false }],
            });
            if (!provider) return helper.error(res, 'Provider not found.', 404);

            const cards = await db.barrelsprices.findAll({
                where: { providerId },
                paranoid: false,
                order: [['id', 'DESC']],
            });

            const audit = await db.pricing_audit.findAll({
                where: { providerId },
                order: [['id', 'DESC']],
                limit: 50,
            });

            // The platform service fee is a global percentage taken off the
            // barrel line (see getServiceFeePercentFromAddons in
            // website/src/utils/pricing.js). Returned here so the admin quote
            // preview shows the customer-facing total rather than just the
            // forwarder's inputs, without a second round trip.
            const addons = await db.addons.findAll({ where: { status: 1 } });
            const serviceFeeAddon = addons.find((a) =>
                /service\s*fee|customs\s*clearance/i.test(String(a.name || ''))
            );

            const shape = (row) => {
                const c = row.toJSON();
                const v2 = isPricingV2(c);
                return {
                    ...c,
                    parishFees: parseParishFees(c.parishFees),
                    modelVersion: v2 ? 'v2' : 'legacy',
                    isLive: !c.deletedAt,
                    parishCoverage: countParishCoverage(c),
                    editableFields: Object.keys(v2 ? V2_FIELDS : LEGACY_FIELDS),
                };
            };

            const u = provider.toJSON();
            const shaped = cards.map(shape);
            const live = shaped.filter((c) => c.isLive);

            return helper.success(res, 'Provider pricing fetched successfully.', {
                provider: {
                    id: u.id,
                    businessName: u.businessInfo?.businessName || u.firstName,
                    email: u.email,
                    phoneNumber: u.phoneNumber,
                    status: u.status,
                    documentVerify: u.businessInfo?.documentVerify ?? 0,
                    listedBasePrice: u.businessInfo?.basePrice ?? null,
                    listedTransitTime: u.businessInfo?.transitTime ?? null,
                    gates: {
                        role: String(u.role) === '2',
                        status: String(u.status) === '1',
                        documentVerify: Number(u.businessInfo?.documentVerify) === 1,
                        hasLiveCard: live.length > 0,
                    },
                },
                cards: live,
                history: shaped.filter((c) => !c.isLive),
                audit: audit.map((a) => {
                    const j = a.toJSON();
                    let changes = null;
                    try { changes = j.changes ? JSON.parse(j.changes) : null; } catch (e) { changes = null; }
                    return { ...j, changes };
                }),
                parishes: JAMAICA_PARISHES,
                serviceFeePercent: parseFloat(serviceFeeAddon?.price_in_percent) || 0,
                serviceFeeLabel: serviceFeeAddon?.name || 'Service fee',
            });
        } catch (error) {
            console.error('providerPricing error:', error);
            return helper.error(res, error.message || 'Internal server error');
        }
    },

    /*
     * PUT /admin/provider/:id/pricing/:cardId
     * Surgical update of one rate card. Body: { password, reason, notify, patch }.
     *
     * The admin password is verified in THIS request rather than via a separate
     * /verify-password call: a step-up that happens in a different request can
     * be skipped by calling the write endpoint directly with a valid admin
     * token, which defeats the point.
     */
    updateRateCard: async (req, res) => {
        try {
            const providerId = parseInt(req.params.id, 10);
            const cardId = parseInt(req.params.cardId, 10);
            const { password, reason, patch } = req.body || {};
            // Default to notifying: silently changing a third party's published
            // pricing should take a deliberate opt-out, not a forgotten flag.
            const notify = req.body?.notify === undefined ? true : !!req.body.notify;

            if (!providerId || !cardId) return helper.error(res, 'Provider id and card id are required.');
            if (!password) return helper.error(res, 'Your admin password is required to change pricing.');
            if (!reason || String(reason).trim().length < 3) {
                return helper.error(res, 'A reason for this pricing change is required.');
            }
            if (!patch || typeof patch !== 'object') return helper.error(res, 'No changes supplied.');

            const admin = await db.users.findOne({ where: { id: req.admin.id, role: '0' } });
            if (!admin) return helper.error(res, 'Admin not found.');
            if (!(await bcrypt.compare(password, admin.password))) {
                return helper.error(res, 'Incorrect password.');
            }

            // Scope by BOTH ids so a mismatched pair cannot cross-edit another
            // forwarder's card.
            const card = await db.barrelsprices.findOne({ where: { id: cardId, providerId } });
            if (!card) return helper.error(res, 'Rate card not found for this provider.', 404);

            const before = card.toJSON();
            const spec = isPricingV2(before) ? V2_FIELDS : LEGACY_FIELDS;
            const { updates, changes, errors } = buildUpdate(before, patch, spec);

            if (errors.length) return helper.error(res, errors.join(' '));
            if (!Object.keys(changes).length) return helper.error(res, 'Nothing changed.');

            const provider = await db.users.findOne({
                where: { id: providerId, role: '2' },
                include: [{ model: db.providerDetails, as: 'businessInfo', required: false }],
            });
            if (!provider) return helper.error(res, 'Provider not found.', 404);

            // Rule 2: keep the headline price consistent across all three homes.
            // The public /forwarders card reads providerDetails.basePrice, which
            // tracks the 'own' card; leaving it stale advertises a price the
            // checkout will not honour.
            const effectivePerBarrel = updates.seaFreightPrice !== undefined
                ? updates.seaFreightPrice
                : (updates.basePrice !== undefined ? updates.basePrice : null);
            if (effectivePerBarrel !== null) {
                updates.barrelPrice = effectivePerBarrel;
                updates.basePrice = effectivePerBarrel;
            }

            await db.sequelize.transaction(async (t) => {
                await card.update(updates, { transaction: t });

                if (before.type === 'own' && provider.businessInfo) {
                    const mirror = {};
                    if (effectivePerBarrel !== null) mirror.basePrice = effectivePerBarrel;
                    if (updates.transitTime !== undefined) mirror.transitTime = updates.transitTime;
                    if (Object.keys(mirror).length) {
                        await provider.businessInfo.update(mirror, { transaction: t });
                    }
                }
            });

            // Audit before notifying: the record of the change must survive a
            // mail failure.
            const auditRow = await db.pricing_audit.create({
                adminId: admin.id,
                adminEmail: admin.email,
                providerId,
                cardId,
                action: 'update',
                changes: JSON.stringify(changes),
                reason: String(reason).trim(),
                notified: false,
            });

            let notifyError = null;
            if (notify) {
                try {
                    await sendPricingChangedEmailToProvider(provider.email, {
                        businessName: provider.businessInfo?.businessName || provider.firstName,
                        route: `${before.originCountry} → ${before.destinationCountry}`,
                        barrelType: before.type === 'dropoff' ? 'Barrel drop-off' : 'Ship your own barrel',
                        changes,
                        fieldLabels: Object.fromEntries(
                            Object.entries(spec).map(([k, v]) => [k, v.label])
                        ),
                        reason: String(reason).trim(),
                    });
                    await auditRow.update({ notified: true });
                } catch (mailErr) {
                    notifyError = mailErr.message || 'Email failed';
                    console.error('Pricing change notification failed:', notifyError);
                    await auditRow.update({ notifyError: notifyError.slice(0, 500) });
                }
            }

            const fresh = await db.barrelsprices.findByPk(cardId);
            return helper.success(res, 'Rate card updated successfully.', {
                card: { ...fresh.toJSON(), parishFees: parseParishFees(fresh.parishFees) },
                changes,
                notified: notify && !notifyError,
                notifyError,
            });
        } catch (error) {
            console.error('updateRateCard error:', error);
            return helper.error(res, error.message || 'Internal server error');
        }
    },

    /*
     * DELETE /admin/provider/:id/pricing/:cardId
     * Soft-delete (retire) one rate card. For clearing stale duplicates and
     * route collisions, not for de-listing a forwarder — removing their last
     * live card silently drops them off the public listing, so that case is
     * refused and pointed at the status/document controls instead.
     */
    retireRateCard: async (req, res) => {
        try {
            const providerId = parseInt(req.params.id, 10);
            const cardId = parseInt(req.params.cardId, 10);
            const { password, reason } = req.body || {};
            const notify = req.body?.notify === undefined ? true : !!req.body.notify;

            if (!providerId || !cardId) return helper.error(res, 'Provider id and card id are required.');
            if (!password) return helper.error(res, 'Your admin password is required to retire a rate card.');
            if (!reason || String(reason).trim().length < 3) {
                return helper.error(res, 'A reason for retiring this rate card is required.');
            }

            const admin = await db.users.findOne({ where: { id: req.admin.id, role: '0' } });
            if (!admin) return helper.error(res, 'Admin not found.');
            if (!(await bcrypt.compare(password, admin.password))) {
                return helper.error(res, 'Incorrect password.');
            }

            const card = await db.barrelsprices.findOne({ where: { id: cardId, providerId } });
            if (!card) return helper.error(res, 'Rate card not found for this provider.', 404);

            const liveCount = await db.barrelsprices.count({ where: { providerId } });
            if (liveCount <= 1) {
                return helper.error(
                    res,
                    'This is the forwarder\'s only live rate card — retiring it would remove them from the public listing. Use the provider status or document-verification controls instead.'
                );
            }

            const before = card.toJSON();
            await card.destroy();

            const auditRow = await db.pricing_audit.create({
                adminId: admin.id,
                adminEmail: admin.email,
                providerId,
                cardId,
                action: 'retire',
                changes: JSON.stringify({
                    retired: {
                        from: `${before.type} · ${before.originCountry} → ${before.destinationCountry} · ${isPricingV2(before) ? before.seaFreightPrice : before.barrelPrice}`,
                        to: null,
                    },
                }),
                reason: String(reason).trim(),
                notified: false,
            });

            let notifyError = null;
            if (notify) {
                try {
                    const provider = await db.users.findOne({
                        where: { id: providerId },
                        include: [{ model: db.providerDetails, as: 'businessInfo', required: false }],
                    });
                    await sendPricingChangedEmailToProvider(provider.email, {
                        businessName: provider.businessInfo?.businessName || provider.firstName,
                        route: `${before.originCountry} → ${before.destinationCountry}`,
                        barrelType: before.type === 'dropoff' ? 'Barrel drop-off' : 'Ship your own barrel',
                        retired: true,
                        changes: {},
                        fieldLabels: {},
                        reason: String(reason).trim(),
                    });
                    await auditRow.update({ notified: true });
                } catch (mailErr) {
                    notifyError = mailErr.message || 'Email failed';
                    console.error('Pricing retire notification failed:', notifyError);
                    await auditRow.update({ notifyError: notifyError.slice(0, 500) });
                }
            }

            return helper.success(res, 'Rate card retired successfully.', {
                cardId,
                notified: notify && !notifyError,
                notifyError,
            });
        } catch (error) {
            console.error('retireRateCard error:', error);
            return helper.error(res, error.message || 'Internal server error');
        }
    },
};

/*
 * Validate + normalize a patch against a field spec, returning the Sequelize
 * update payload, a { field: {from, to} } diff for the audit trail, and any
 * validation errors. Unknown fields are ignored so a client may post the whole
 * row back; only the spec's fields are ever written.
 */
function buildUpdate(before, patch, spec) {
    const updates = {};
    const changes = {};
    const errors = [];

    const num = (raw, label, max) => {
        const s = String(raw ?? '').trim();
        if (s === '') return 0;
        const n = Number(s);
        if (!Number.isFinite(n)) { errors.push(`${label} must be a number.`); return null; }
        if (n < 0) { errors.push(`${label} cannot be negative.`); return null; }
        if (n > max) { errors.push(`${label} looks wrong (${n} exceeds the ${max} limit) — check for a mistyped digit.`); return null; }
        return n;
    };

    for (const [field, def] of Object.entries(spec)) {
        if (!(field in patch)) continue;
        const raw = patch[field];

        let next;
        switch (def.kind) {
            case 'money': {
                const n = num(raw, def.label, MAX_MONEY);
                if (n === null) continue;
                next = n.toFixed(2);
                break;
            }
            case 'miles': {
                const n = num(raw, def.label, MAX_MILES);
                if (n === null) continue;
                next = String(n);
                break;
            }
            case 'percent': {
                const n = num(raw, def.label, 100);
                if (n === null) continue;
                next = String(n);
                break;
            }
            case 'int': {
                const n = num(raw, def.label, 100000);
                if (n === null) continue;
                next = String(Math.round(n));
                break;
            }
            case 'bool':
                next = (raw === true || raw === 1 || raw === '1' || raw === 'true') ? 1 : 0;
                break;
            case 'text':
                next = String(raw ?? '').trim().slice(0, 255);
                break;
            case 'csvMoney': {
                // Legacy 25-slot CSV. Preserve the shape — the quote path reads
                // it positionally — but validate each slot.
                const slots = String(raw ?? '').split(',').map((s) => s.trim());
                let bad = false;
                for (const s of slots) {
                    if (s === '') continue;
                    const n = Number(s);
                    if (!Number.isFinite(n) || n < 0 || n > MAX_MONEY) { bad = true; break; }
                }
                if (bad) { errors.push(`${def.label} contains a value that is not a valid amount.`); continue; }
                next = slots.join(',');
                break;
            }
            case 'parishFees': {
                const fees = typeof raw === 'string' ? parseParishFees(raw) : raw;
                if (!fees || typeof fees !== 'object' || Array.isArray(fees)) {
                    errors.push('Customs & delivery fees must be an object keyed by parish.');
                    continue;
                }
                const out = {};
                let bad = false;
                for (const parish of JAMAICA_PARISHES) {
                    const entry = parishEntry(fees[parish]);
                    if (!entry || !(entry.first > 0)) {
                        errors.push(`${parish} needs a first-barrel customs & delivery fee.`);
                        bad = true;
                        continue;
                    }
                    if (entry.first > MAX_MONEY || entry.additional > MAX_MONEY) {
                        errors.push(`${parish} fee looks wrong — check for a mistyped digit.`);
                        bad = true;
                        continue;
                    }
                    if (entry.additional < 0) {
                        errors.push(`${parish} additional-barrel fee cannot be negative.`);
                        bad = true;
                        continue;
                    }
                    out[parish] = { first: entry.first.toFixed(2), additional: entry.additional.toFixed(2) };
                }
                if (bad) continue;
                next = JSON.stringify(out);
                break;
            }
            default:
                continue;
        }

        // Compare normalized-to-normalized so a no-op reformat ("95" -> "95.00")
        // is not recorded as a change.
        const prevRaw = before[field];
        const prevNorm = normalizeForCompare(prevRaw, def.kind);
        const nextNorm = normalizeForCompare(next, def.kind);
        if (prevNorm === nextNorm) continue;

        updates[field] = next;
        changes[field] = { from: prevRaw ?? null, to: next };
    }

    // Cross-field rules — only meaningful for v2, and only checked when the
    // relevant fields are in play (using the post-patch effective values so a
    // partial patch is validated against what the row will actually become).
    if (spec === V2_FIELDS) {
        const eff = (f) => (updates[f] !== undefined ? updates[f] : before[f]);
        const sea = parseFloat(eff('seaFreightPrice')) || 0;
        const d59 = parseFloat(eff('discount5to9')) || 0;
        const d10 = parseFloat(eff('discount10plus')) || 0;

        if ('seaFreightPrice' in updates && !(sea > 0)) {
            errors.push('Sea freight price must be greater than zero — a zero would take this forwarder off the v2 pricing model.');
        }
        if (d59 > sea) errors.push('The 5-9 barrel discount cannot exceed the sea freight price.');
        if (d10 > sea) errors.push('The 10+ barrel discount cannot exceed the sea freight price.');
        if (d10 < d59) errors.push('The 10+ barrel discount must be at least the 5-9 barrel discount, or larger orders would cost more per barrel.');
    }

    return { updates, changes, errors };
}

function normalizeForCompare(v, kind) {
    if (kind === 'parishFees') {
        const fees = parseParishFees(v);
        if (!fees) return '';
        return JSON.stringify(JAMAICA_PARISHES.map((p) => {
            const e = parishEntry(fees[p]);
            return e ? [e.first.toFixed(2), e.additional.toFixed(2)] : null;
        }));
    }
    if (kind === 'text' || kind === 'csvMoney') return String(v ?? '').trim();
    if (kind === 'bool') return (v === true || v === 1 || v === '1' || v === 'true') ? '1' : '0';
    const s = String(v ?? '').trim();
    if (s === '') return '0';
    const n = Number(s);
    return Number.isFinite(n) ? n.toFixed(4) : s;
}
