/*
 * Admin view of money VerShip holds for forwarders (forwarder_payouts).
 *   GET  /api/admin/payouts            totals + rows (filter ?status= &providerId=)
 *   POST /api/admin/payouts/:id/retry  re-run the transfer(s) for that row's forwarder
 *   POST /api/admin/payouts/:id/write-off { reason }  settled outside Stripe / refunded
 * The "keep at least $X in Stripe" figure is the sum of owed+failed rows: with
 * separate charges & transfers the platform balance must still contain the
 * money when the transfer is finally made (Stripe → Payouts → Minimum balance).
 */
const { Op } = require('sequelize');
const db = require('../../models');
const helper = require('../../helper/helper');
const payouts = require('../../helper/payoutService');

const cents = (n) => (n / 100).toFixed(2);

module.exports = {
    list: async (req, res) => {
        try {
            const where = {};
            if (req.query.status) where.status = req.query.status;
            if (req.query.providerId) where.provider_id = req.query.providerId;
            const rows = await db.forwarder_payouts.findAll({ where, order: [['createdAt', 'DESC']] });
            const all = await db.forwarder_payouts.findAll({ attributes: ['provider_id', 'status', 'amount_owed_cents', 'createdAt'] });

            const providerIds = [...new Set(all.map((r) => r.provider_id))];
            const users = providerIds.length ? await db.users.findAll({ where: { id: { [Op.in]: providerIds } }, attributes: ['id', 'firstName', 'email', 'hashAccount', 'accountId'] }) : [];
            const details = providerIds.length ? await db.providerDetails.findAll({ where: { providerId: { [Op.in]: providerIds } }, attributes: ['providerId', 'businessName'] }) : [];
            const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter(Boolean))];
            const bookings = bookingIds.length ? await db.bookings.findAll({ where: { id: { [Op.in]: bookingIds } }, attributes: ['id', 'orderId'] }) : [];
            const userById = Object.fromEntries(users.map((u) => [u.id, u]));
            const bizById = Object.fromEntries(details.map((d) => [d.providerId, d.businessName]));
            const orderById = Object.fromEntries(bookings.map((b) => [b.id, b.orderId]));

            const sum = (st) => all.filter((r) => st.includes(r.status)).reduce((a, r) => a + r.amount_owed_cents, 0);
            const heldRows = all.filter((r) => ['owed', 'failed', 'transferring'].includes(r.status));
            const oldest = heldRows.length ? Math.min(...heldRows.map((r) => new Date(r.createdAt).getTime())) : null;

            // Per-forwarder rollup for the top of the page
            const byProvider = {};
            for (const r of all) {
                const p = (byProvider[r.provider_id] ||= { providerId: r.provider_id, heldCents: 0, transferredCents: 0, failedCents: 0, count: 0, oldestHeld: null });
                p.count++;
                if (['owed', 'failed', 'transferring'].includes(r.status)) {
                    p.heldCents += r.amount_owed_cents;
                    const t = new Date(r.createdAt).getTime();
                    p.oldestHeld = p.oldestHeld ? Math.min(p.oldestHeld, t) : t;
                }
                if (r.status === 'transferred') p.transferredCents += r.amount_owed_cents;
                if (r.status === 'failed') p.failedCents += r.amount_owed_cents;
            }

            return helper.success(res, 'Payouts fetched.', {
                totals: {
                    held: cents(sum(['owed', 'failed', 'transferring'])),
                    owed: cents(sum(['owed'])),
                    failed: cents(sum(['failed'])),
                    transferred: cents(sum(['transferred'])),
                    reversed: cents(sum(['reversed'])),
                    writtenOff: cents(sum(['written_off'])),
                    oldestHeldDays: oldest ? Math.floor((Date.now() - oldest) / 864e5) : 0,
                    minimumBalanceHint: cents(sum(['owed', 'failed', 'transferring'])),
                },
                forwarders: Object.values(byProvider).map((p) => ({
                    ...p,
                    held: cents(p.heldCents), transferred: cents(p.transferredCents), failed: cents(p.failedCents),
                    oldestHeldDays: p.oldestHeld ? Math.floor((Date.now() - p.oldestHeld) / 864e5) : 0,
                    businessName: bizById[p.providerId] || userById[p.providerId]?.firstName || `#${p.providerId}`,
                    email: userById[p.providerId]?.email || '',
                    stripeConnected: userById[p.providerId]?.hashAccount === '1',
                })).sort((a, b) => b.heldCents - a.heldCents),
                rows: rows.map((r) => ({
                    id: r.id,
                    providerId: r.provider_id,
                    businessName: bizById[r.provider_id] || userById[r.provider_id]?.firstName || `#${r.provider_id}`,
                    email: userById[r.provider_id]?.email || '',
                    bookingId: r.booking_id,
                    orderId: orderById[r.booking_id] || null,
                    gross: cents(r.gross_cents),
                    platformFee: cents(r.platform_fee_cents),
                    amount: cents(r.amount_owed_cents),
                    status: r.status,
                    transferId: r.transfer_id,
                    transferredAt: r.transferred_at,
                    failureReason: r.failure_reason,
                    reminders: r.reminder_count,
                    lastReminderAt: r.last_reminder_at,
                    writtenOffReason: r.written_off_reason,
                    createdAt: r.createdAt,
                    ageDays: Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 864e5),
                })),
            });
        } catch (error) {
            console.error('admin payouts list error:', error);
            return helper.error(res, error.message, 500);
        }
    },

    retry: async (req, res) => {
        try {
            const row = await db.forwarder_payouts.findByPk(req.params.id);
            if (!row) return helper.error(res, 'Row not found.', 404);
            if (!['owed', 'failed'].includes(row.status)) return helper.failure(res, `Row is ${row.status}; nothing to retry.`);
            const out = await payouts.collectForProvider(row.provider_id, { trigger: `admin_retry:${req.admin?.id || ''}` });
            if (!out.ok) return helper.failure(res, out.reason === 'onboarding_incomplete' || out.reason === 'no_account'
                ? 'The forwarder has not finished Stripe onboarding; the transfer cannot be made yet.' : `Stripe: ${out.reason}`);
            await row.reload();
            return helper.success(res, `${out.transferred.length} transferred, ${out.failed.length} failed.`, { row, transferred: out.transferred.length, failed: out.failed.length });
        } catch (error) {
            return helper.error(res, error.message, 500);
        }
    },

    writeOff: async (req, res) => {
        try {
            const reason = String(req.body?.reason || '').trim();
            if (reason.length < 5) return helper.failure(res, 'A reason (at least 5 characters) is required.');
            const row = await db.forwarder_payouts.findByPk(req.params.id);
            if (!row) return helper.error(res, 'Row not found.', 404);
            if (!['owed', 'failed'].includes(row.status)) return helper.failure(res, `Row is ${row.status}; only owed/failed rows can be written off.`);
            await row.update({ status: 'written_off', written_off_reason: reason, written_off_by: req.admin?.id || null });
            return helper.success(res, 'Written off.', { row });
        } catch (error) {
            return helper.error(res, error.message, 500);
        }
    },
};
