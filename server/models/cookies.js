const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('cookies', {
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
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        type: {
            type: DataTypes.STRING(100), // e.g., Essential, Analytical, Marketing
            allowNull: true,
            defaultValue: "Essential"
        },
        duration: {
            type: DataTypes.STRING(100), // e.g., 2 years, Session
            allowNull: true,
            defaultValue: ""
        },
        status: {
            type: DataTypes.INTEGER, // 1 for active, 0 for inactive
            allowNull: false,
            defaultValue: 1
        }
    }, {
        sequelize,
        tableName: 'cookies',
        timestamps: true,
        paranoid: false
    });
};
