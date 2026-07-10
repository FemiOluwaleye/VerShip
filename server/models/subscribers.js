const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('subscribers', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },

        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
    }, {
        sequelize,
        tableName: 'subscribers',
        timestamps: true,
        paranoid: true
    });
};
