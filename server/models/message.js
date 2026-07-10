const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    // Individual chat messages. Reverse-engineered from server/socket/socket.js
    // (send_message / get_message_list / cont_unread_msg). paranoid:true gives
    // the deletedAt column the read handler filters on; deletedId is a separate
    // per-user soft-hide flag matching chat_constant.
    return sequelize.define('message', {
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
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        // 'text', 'image', etc.
        msgType: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        chatConstant_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        bookingId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        // 0 = unread, 1 = read.
        readStatus: {
            type: DataTypes.SMALLINT,
            allowNull: true,
            defaultValue: 0,
        },
        // Per-user soft-hide (see chat_constant.deletedId).
        deletedId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
    }, {
        sequelize,
        tableName: 'message',
        timestamps: true,
        paranoid: true
    });
};
