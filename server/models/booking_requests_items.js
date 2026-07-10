const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('booking_requests_items', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        booking_request_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },

        item_type: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        sub_type: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        // quantity: {
        //     type: DataTypes.STRING(255),
        //     allowNull: true,
        // },
        // weight: {
        //     type: DataTypes.STRING(255),
        //     allowNull: true,
        // },
        // dimensions: {
        //     type: DataTypes.STRING(255),
        //     allowNull: true,
        // },
        // description: {
        //     type: DataTypes.TEXT,
        //     allowNull: true,
        // },
    }, {
        sequelize,
        tableName: 'booking_requests_items',
        timestamps: true,
        paranoid: true
    });
};
