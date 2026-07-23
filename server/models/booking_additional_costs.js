const Sequelize = require('sequelize');
// A forwarder-initiated extra charge on a booking (storage, oversize, re-delivery…).
// Created by the provider, emailed to the customer, and paid in-app through the
// same Stripe split-payment path bookings use. Amount is snapshotted at creation.
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('booking_additional_costs', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        booking_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        provider_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        amount: {
            type: DataTypes.STRING(32),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        // '0' requested/unpaid, '1' paid, '2' cancelled by provider
        status: {
            type: DataTypes.STRING(8),
            allowNull: false,
            defaultValue: '0'
        },
        transaction_id: {
            type: DataTypes.STRING(191),
            allowNull: true
        }
    }, {
        tableName: 'booking_additional_costs',
        timestamps: true
    });
};
