const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('serviceAreaRoutes', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    providerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Store multiple selected countries as a comma‑separated string.
    // Using TEXT allows an arbitrary number of country names.
    country: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    freightType: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "1=>flight, 2=>ship, 3=>container"
    },
    flightsPerWeekTo: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    },
    flightsPerWeekFrom: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    }

  }, {
    sequelize,
    tableName: 'serviceAreaRoutes',
    timestamps: true,
    paranoid: true
  });
};
