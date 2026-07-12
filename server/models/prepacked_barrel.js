const Sequelize = require('sequelize');
// The "VerShip Pre-Packed Food Barrel" product — an owner-sold, fixed-price
// product (NOT provider/quote driven). Admin-managed (mirrors the banners CRUD).
// Its contents live in prepacked_barrel_items (as: 'contents').
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('prepacked_barrel', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "VerShip Pre-Packed Food Barrel"
        },
        tagline: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        image: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        price: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "0"
        },
        currency: {
            type: DataTypes.STRING(8),
            allowNull: false,
            defaultValue: "USD"
        },
        transitTime: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        // '1' = active/featured (shown on the landing page), '0' = hidden
        status: {
            type: DataTypes.STRING(4),
            allowNull: false,
            defaultValue: "1"
        }
    }, {
        sequelize,
        tableName: 'prepacked_barrel',
        timestamps: true,
        paranoid: true
    });
};
