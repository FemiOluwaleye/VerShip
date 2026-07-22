const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('booking_requests', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },

        origin: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        destination: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        origin_city: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null
        },
        payment_status: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },

        weight: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null
        },
        description: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        pickup_date: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
        },
        delivery_date: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
        },
        dimensions: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        account_type: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        phone: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        whatsapp: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        drop_off_address: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        parish: {                  // consignee destination parish (pricing v2)
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },

        drop_off_lat: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        drop_off_long: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        origin_lat: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        origin_long: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        destination_lat: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        destination_long: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        firstName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        lastName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        suite_apt_building: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
         streetAddress: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        city: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        state: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },

    }, {
        sequelize,
        tableName: 'booking_requests',
        timestamps: true,
        paranoid: false
    });
};
