'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';

// Legacy config.json is gitignored and only exists for local dev. On Render
// (and any prod host) it is absent and the connection comes from DATABASE_URL.
let fileConfig = {};
try {
  fileConfig = require(__dirname + '/../config/config.json')[env] || {};
} catch (e) {
  // No config.json — expected in production where DATABASE_URL is injected.
}

const db = {};

let sequelize;
if (process.env.DATABASE_URL) {
  // Managed Postgres via a single connection string: Render in production, the
  // Replit-provided dev database locally. SSL is on by default (Render requires
  // it) but skipped when the URL says sslmode=disable or DATABASE_SSL=false —
  // which is how the internal Replit dev DB connects.
  const url = process.env.DATABASE_URL;
  const sslDisabled = /sslmode=disable/i.test(url) || process.env.DATABASE_SSL === 'false';
  sequelize = new Sequelize(url, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectOptions: sslDisabled ? {} : { ssl: { require: true, rejectUnauthorized: false } },
  });
} else if (fileConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[fileConfig.use_env_variable], fileConfig);
} else {
  sequelize = new Sequelize(fileConfig.database, fileConfig.username, fileConfig.password, fileConfig);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

sequelize.sync({ alter: false })
  .then(() => {
    console.log('Database synced successfully');
  })
  .catch((err) => {
    console.error('Error syncing the database:', err);
  });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
const { users, providerDetails, } = db;





//for booking
db.bookings.belongsTo(db.users, { foreignKey: 'userId', as: 'userbook' });
db.bookings.belongsTo(db.users, { foreignKey: 'driverId', as: 'driverbook' });
db.bookings.belongsTo(db.booking_requests, { foreignKey: 'booking_request_id', as: 'bookingRequest' });

// In your associations file where you define relationships
db.users.hasMany(db.reviewrating, { foreignKey: 'ratedTo', as: 'receivedRatings' });
db.reviewrating.belongsTo(db.users, { foreignKey: 'ratedBy', as: 'ratedby' });
db.reviewrating.belongsTo(db.users, { foreignKey: 'ratedTo', as: 'ratedto' });
db.reviewrating.belongsTo(db.bookings, { foreignKey: 'bookingId', as: 'ratedbooking' });

//report associations 
db.reports.belongsTo(db.users, { foreignKey: 'reportBy', as: 'reportedby' });
db.reports.belongsTo(db.users, { foreignKey: 'reportTo', as: 'reportedto' });
db.reports.belongsTo(db.bookings, { foreignKey: 'bookingId', as: 'reportedbooking' });

users.hasOne(providerDetails, { foreignKey: "providerId", as: "businessInfo", });
providerDetails.belongsTo(users, { foreignKey: "providerId", as: "provider", });

db.users.hasMany(db.serviceAreaRoutes, { foreignKey: "providerId", as: "serviceArea", });
db.serviceAreaRoutes.belongsTo(db.users, { foreignKey: "providerId", as: "provider", });

providerDetails.hasMany(db.provider_shipment_item_types, { foreignKey: "provider_detail_id", as: "shipmentItemTypes", });
db.provider_shipment_item_types.belongsTo(providerDetails, { foreignKey: "provider_detail_id", as: "businessInfo", });
db.user_cookies.belongsTo(db.users, { foreignKey: "userid", as: "cookieDetail", });
providerDetails.hasMany(db.barrelsprices, { foreignKey: "providerId", sourceKey: "providerId", as: "barrelPrices", });
db.barrelsprices.belongsTo(providerDetails, { foreignKey: "providerId", targetKey: "providerId", as: "providerInfo", });

// Booking Request Associations
db.booking_requests.hasMany(db.booking_requests_items, { foreignKey: 'booking_request_id', as: 'items' });
db.booking_requests_items.belongsTo(db.booking_requests, { foreignKey: 'booking_request_id', as: 'request' });
db.booking_requests.belongsTo(db.users, { foreignKey: 'userId', as: 'user' });
db.transactions.belongsTo(db.users, { foreignKey: 'user_id', as: 'user' });
db.transactions.belongsTo(db.bookings, { foreignKey: 'booking_id', as: 'booking' });
// Notification Associations
db.notifications.belongsTo(db.users, { foreignKey: 'sender_id', as: 'sender' });
db.notifications.belongsTo(db.users, { foreignKey: 'reciever_id', as: 'receiver' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;