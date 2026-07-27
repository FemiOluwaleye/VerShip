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
        // Which group the item is listed under on the public page. Free text so
        // the owner can add groups later, but the UI offers the three canonical
        // ones ("Food", "Household Items", "Personal Care"). Anything blank or
        // unrecognised falls back to "Food" at render time.
        category: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "Food"
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
