const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('barrelsprices', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        providerId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        type: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        barrelPrice: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        barrelNumber: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        freeMiles: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        pricePerMile: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        customsAndHandling: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: "0"
        },
        basePrice: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        originCountry: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        destinationCountry: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        originLat: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        originLong: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        destinationLat: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        destinationLong: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        transitTime: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        shipmentContents: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        discount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0
        },
        isVolumeDiscount: {
            type: DataTypes.SMALLINT,
            allowNull: true,
            defaultValue: 0
        },
        discountAfter: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        discountPercent: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        flatPickupCharge: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        pickupFreeMiles: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        pickupPerMileCharge: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        flatDeliveryCharge: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        deliveryFreeMiles: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        deliveryPerMileCharge: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
    }, {
        sequelize,
        tableName: 'barrelsprices',
        timestamps: true,
        paranoid: true,
    });
};