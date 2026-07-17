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
        // Optional "regular" price shown struck-through beside `price` to signal a
        // promotional offer. Empty/null = no promo, only `price` renders.
        compareAtPrice: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
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
        // '1' = active (eligible to show), '0' = hidden everywhere
        status: {
            type: DataTypes.STRING(4),
            allowNull: false,
            defaultValue: "1"
        },
        // When true (and status active), the barrel is shown on the public
        // landing page. Multiple barrels can be featured at once.
        featured: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        sequelize,
        tableName: 'prepacked_barrel',
        timestamps: true,
        paranoid: true
    });
};
