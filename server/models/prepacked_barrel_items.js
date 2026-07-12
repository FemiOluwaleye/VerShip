const Sequelize = require('sequelize');
// One line of a pre-packed barrel's contents (e.g. "Rice" x 3). Parent→child of
// prepacked_barrel (as: 'contents'), mirroring booking_requests → items.
// Admin edits these; the FK column is defined explicitly so sync() creates it
// (associations in index.js run after sync and only power query-time includes).
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('prepacked_barrel_items', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        prepacked_barrel_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        quantity: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "1"
        },
        // optional emoji/icon shown next to the item on the landing page
        icon: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        sequelize,
        tableName: 'prepacked_barrel_items',
        timestamps: true,
        paranoid: true
    });
};
