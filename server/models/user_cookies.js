const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('user_cookies', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        userid: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        cookieid: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'cookies',
                key: 'id'
            }
        },
        text: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        tableName: 'user_cookies',
        timestamps: true,
        paranoid: false,
    });
};
