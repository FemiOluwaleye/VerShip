const Sequelize = require('sequelize');
// Ledger of money VerShip holds for forwarders who have not finished Stripe
// onboarding. A booking charge paid to such a forwarder lands in VerShip's own
// Stripe balance (separate charges & transfers); one row here records what is
// owed and, once the forwarder's Express account can receive transfers, the
// Stripe transfer that settled it. Rows are created by the payment_intent
// webhook only, keyed by the Stripe charge so replays cannot double-count.
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('forwarder_payouts', {
        id: { autoIncrement: true, type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
        booking_id: { type: DataTypes.INTEGER, allowNull: true },
        booking_charge_id: { type: DataTypes.INTEGER, allowNull: true },
        provider_id: { type: DataTypes.INTEGER, allowNull: false },
        payment_intent_id: { type: DataTypes.STRING(191), allowNull: false },
        charge_id: { type: DataTypes.STRING(191), allowNull: false, unique: true },
        gross_cents: { type: DataTypes.INTEGER, allowNull: false },
        platform_fee_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        amount_owed_cents: { type: DataTypes.INTEGER, allowNull: false },
        currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'usd' },
        // owed | transferring | transferred | failed | reversed | written_off
        status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'owed' },
        transfer_id: { type: DataTypes.STRING(191), allowNull: true },
        transferred_at: { type: DataTypes.DATE, allowNull: true },
        failure_reason: { type: DataTypes.TEXT, allowNull: true },
        reminder_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        last_reminder_at: { type: DataTypes.DATE, allowNull: true },
        written_off_reason: { type: DataTypes.TEXT, allowNull: true },
        written_off_by: { type: DataTypes.INTEGER, allowNull: true },
    }, {
        tableName: 'forwarder_payouts',
        timestamps: true,
        indexes: [{ fields: ['provider_id', 'status'] }, { fields: ['booking_id'] }],
    });
};
