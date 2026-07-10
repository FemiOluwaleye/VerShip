var DataTypes = require("sequelize").DataTypes;
var _banners = require("./banners");
var _bookings = require("./bookings");
var _cms = require("./cms");
var _contactus = require("./contactus");
var _faqs = require("./faqs");
var _reports = require("./reports");
var _reviewrating = require("./reviewrating");
var _users = require("./users");
var _providerDetails = require("./providerDetails");
var _serviceAreaRoutes = require("./serviceAreaRoutes");
var _transactions = require("./transactions");


function initModels(sequelize) {
  var banners = _banners(sequelize, DataTypes);
  var bookings = _bookings(sequelize, DataTypes);
  var cms = _cms(sequelize, DataTypes);
  var contactus = _contactus(sequelize, DataTypes);
  var faqs = _faqs(sequelize, DataTypes);
  var reports = _reports(sequelize, DataTypes);
  var reviewrating = _reviewrating(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);
  var providerDetails = _providerDetails(sequelize, DataTypes);
  var serviceAreaRoutes = _serviceAreaRoutes(sequelize, DataTypes);
  var transactions = _transactions(sequelize, DataTypes);



  reports.belongsTo(bookings, { as: "booking", foreignKey: "bookingId" });
  bookings.hasMany(reports, { as: "reports", foreignKey: "bookingId" });
  reviewrating.belongsTo(bookings, { as: "booking", foreignKey: "bookingId" });
  bookings.hasMany(reviewrating, { as: "reviewratings", foreignKey: "bookingId" });

  bookings.belongsTo(users, { as: "user", foreignKey: "userId" });
  users.hasMany(bookings, { as: "bookings", foreignKey: "userId" });
  reports.belongsTo(users, { as: "reportBy_user", foreignKey: "reportBy" });
  users.hasMany(reports, { as: "reports", foreignKey: "reportBy" });
  reports.belongsTo(users, { as: "reportTo_user", foreignKey: "reportTo" });
  users.hasMany(reports, { as: "reportTo_reports", foreignKey: "reportTo" });
  reviewrating.belongsTo(users, { as: "ratedBy_user", foreignKey: "ratedBy" });
  users.hasMany(reviewrating, { as: "reviewratings", foreignKey: "ratedBy" });
  reviewrating.belongsTo(users, { as: "ratedTo_user", foreignKey: "ratedTo" });
  users.hasMany(reviewrating, { as: "ratedTo_reviewratings", foreignKey: "ratedTo" });

  users.hasOne(providerDetails, { foreignKey: "providerId", as: "businessInfo", });
  providerDetails.belongsTo(users, { foreignKey: "providerId", as: "provider", });

  users.hasOne(serviceAreaRoutes, { foreignKey: "providerId", as: "serviceArea" });
  serviceAreaRoutes.belongsTo(users, { foreignKey: "providerId", as: "provider" });

  transactions.belongsTo(bookings, { as: "booking", foreignKey: "booking_id" });
  bookings.hasMany(transactions, { as: "transactions", foreignKey: "booking_id" });
  transactions.belongsTo(users, { as: "user", foreignKey: "user_id" });
  users.hasMany(transactions, { as: "transactions", foreignKey: "user_id" });
  transactions.belongsTo(users, { as: "receiver", foreignKey: "reciever_id" });
  users.hasMany(transactions, { as: "received_transactions", foreignKey: "reciever_id" });



  return {
    banners,
    bookings,
    cms,
    contactus,
    faqs,
    reports,
    reviewrating,
    users,
    providerDetails,
    serviceAreaRoutes,
    transactions,

  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
