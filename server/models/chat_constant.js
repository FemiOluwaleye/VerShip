const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    // One row per conversation (a sender/receiver pair, optionally scoped to a
    // booking). Reverse-engineered from server/socket/socket.js, which is the
    // only consumer: user_constant_list / send_message read and write these
    // columns. Postgres-native types (no MySQL-only constructs).
    return sequelize.define('chat_constant', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        sender_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        reciever_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        bookingId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        // id of the most recent message in this conversation (used to surface a
        // preview in the conversation list).
        lastMessage_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        // Per-user soft-hide: set to the id of the user who cleared the thread.
        // The list query filters `deletedId != <viewer>` and send_message resets
        // it to 0 so a new message un-hides the conversation for both parties.
        deletedId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
    }, {
        sequelize,
        tableName: 'chat_constant',
        timestamps: true,
        paranoid: false
    });
};
