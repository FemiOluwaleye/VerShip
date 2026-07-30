const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('pricing_audit', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        // Who made the change (users.id of a role='0' admin).
        adminId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        adminEmail: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ''
        },
        // Whose pricing changed (users.id of the role='2' forwarder).
        providerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        // The barrelsprices row that changed.
        cardId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        action: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'update'
        },
        // Only the fields that actually changed, as { field: { from, to } }.
        // Storing the diff rather than whole rows keeps the trail readable and
        // avoids copying a provider's full rate card on every keystroke-sized fix.
        changes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        // Free-text justification, required by the API on every write.
        reason: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: ''
        },
        // Whether the forwarder was emailed about this change, and why not when
        // they weren't — admins may suppress the notice, and that choice is
        // itself part of the record.
        notified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        notifyError: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },
    }, {
        sequelize,
        tableName: 'pricing_audit',
        timestamps: true,
        indexes: [
            { name: 'pricing_audit_provider_idx', fields: ['providerId'] },
            { name: 'pricing_audit_card_idx', fields: ['cardId'] },
        ]
    });
};
