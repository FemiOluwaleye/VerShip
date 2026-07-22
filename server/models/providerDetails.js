const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "providerDetails",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      providerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        // One provider-details row per provider. Postgres requires a UNIQUE
        // constraint here because barrelsprices references it as a foreign key
        // (targetKey: providerId); MySQL allowed the non-unique reference.
        unique: true,
      },
      businessName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      registerationNumber: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      countryOfRegistration: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      businessAddress: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      businessLongitude: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      businessLatitude: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      serviceType: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      phone: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      shipmentType: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      originCountry: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      originLat: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      originLong: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      destinationLat: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      destinationLong: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      destinationCountry: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      basePrice: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "0",
      },
      pricePerMile: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "0",
      },
      customsAndHandling: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "0",
      },
      validFrom: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      freightType: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: "",
      },
      validTo: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      transitTime: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      shipmentContents: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      primaryContactPerson: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: "",
      },
      primaryContactPersonLastName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      primaryContactPersonFirstName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      certificateOfIncorporation: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      ValidBusinessId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      AddressProof: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      documentVerify: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "0=>pending,1=>verified,2=>rejected",
      },
      deliveryTimeline: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      deliveryPolicy: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: "",
      },
      pricingDocument: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      pricePerPound: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: "",
      },
      streetAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: "",
      },
      city: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      state: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: "",
      },
      zip: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: "",
      },
      primaryContactEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: "",
      },
    },
    {
      sequelize,
      tableName: "providerDetails",
      timestamps: true,
      paranoid: false,
    }
  );
};
