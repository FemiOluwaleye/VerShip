const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('addons', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        price_in_percent: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        status: {
            type: DataTypes.INTEGER, // 1 for active, 0 for inactive
            allowNull: false,
            defaultValue: 1
        }
    }, {
        sequelize,
        tableName: 'addons',
        timestamps: true,
        paranoid: false
    });
};
