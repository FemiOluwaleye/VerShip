const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        "provider_shipment_item_types",
        {
            id: {
                autoIncrement: true,
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
            },
            provider_detail_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            item_type: {
                type: DataTypes.STRING(255),
                allowNull: false,
                defaultValue: "",
            },
            sub_type: {
                type: DataTypes.STRING(255),
                allowNull: false,
                defaultValue: "",
            },
        },
        {
            sequelize,
            tableName: "provider_shipment_item_types",
            timestamps: true,
            paranoid: false,
        }
    );
};
