const Sequelize = require('sequelize');
// One row per amount a customer pays on a booking — "Pay as Your Shipment Moves".
//   deposit           sea freight + service fee (+ pickup, drop-off add-on); due at checkout
//   customs_delivery  the consignee parish's customs & delivery fee; due when the
//                     forwarder marks the shipment Arrived in Jamaica
//   extra             a forwarder-initiated extra (storage, oversize…); replaces
//                     booking_additional_costs, whose rows migrate into here
// Amounts are snapshotted in cents at creation. Paid status is set by the
// Stripe webhook (or the verified confirm endpoint), never by the client.
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('booking_charges', {
        id: { autoIncrement: true, type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
        booking_id: { type: DataTypes.INTEGER, allowNull: false },
        provider_id: { type: DataTypes.INTEGER, allowNull: false },
        user_id: { type: DataTypes.INTEGER, allowNull: false },
        kind: { type: DataTypes.STRING(32), allowNull: false }, // deposit | customs_delivery | extra
        description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
        amount_cents: { type: DataTypes.INTEGER, allowNull: false },
        currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'usd' },
        // VerShip's share (application fee on destination charges, retained on held ones)
        platform_fee_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        // pending | paid | cancelled
        status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
        // checkout | arrived | manual — when the customer is asked for it
        due_trigger: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'manual' },
        due_at: { type: DataTypes.DATE, allowNull: true },
        notified_at: { type: DataTypes.DATE, allowNull: true },
        payment_intent_id: { type: DataTypes.STRING(191), allowNull: true },
        charge_id: { type: DataTypes.STRING(191), allowNull: true },
        paid_at: { type: DataTypes.DATE, allowNull: true },
        // JSON snapshot of the server-side breakdown lines for this charge
        breakdown: { type: DataTypes.TEXT, allowNull: true },
        // Row copied from booking_additional_costs (id) by the migration
        legacy_additional_cost_id: { type: DataTypes.INTEGER, allowNull: true },
    }, {
        tableName: 'booking_charges',
        timestamps: true,
        indexes: [{ fields: ['booking_id'] }, { fields: ['provider_id', 'status'] }, { fields: ['payment_intent_id'] }],
    });
};
