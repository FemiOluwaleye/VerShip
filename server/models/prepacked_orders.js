const Sequelize = require('sequelize');
// A direct purchase of a pre-packed barrel. Deliberately decoupled from the
// provider `bookings`/quote machinery: no provider, no Stripe (v1). Payment is
// arranged offline, so orders start unpaid. Price is snapshotted at order time.
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('prepacked_orders', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        orderId: {
            type: DataTypes.STRING(64),
            allowNull: false
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        prepacked_barrel_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        unit_price: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        total_price: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        currency: {
            type: DataTypes.STRING(8),
            allowNull: false,
            defaultValue: "USD"
        },
        recipient_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        recipient_phone: {
            type: DataTypes.STRING(64),
            allowNull: true,
            defaultValue: ""
        },
        recipient_email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        delivery_street: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        delivery_town: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        delivery_parish: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        delivery_country: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: "Jamaica"
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // '0' = placed, '1' = processing, '2' = shipped, '3' = delivered, '4' = cancelled
        status: {
            type: DataTypes.STRING(4),
            allowNull: false,
            defaultValue: "0"
        },
        // 0 = unpaid (payment arranged offline in v1), 1 = paid
        payment_status: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        sequelize,
        tableName: 'prepacked_orders',
        timestamps: true,
        paranoid: false
    });
};
