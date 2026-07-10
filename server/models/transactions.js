const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('transactions', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        booking_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'bookings',
                key: 'id'
            }
        },
        transaction_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        reciever_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: "e.g., succeeded, pending, failed"
        }
    }, {
        sequelize,
        tableName: 'transactions',
        timestamps: true,
        paranoid: false
    });
};
