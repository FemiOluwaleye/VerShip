const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define('bookings', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    booking_request_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    orderId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    document: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    pay_now_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      // defaultValue: ""
    },
    trasaction_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      // defaultValue: ""
    },
    pay_later_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      // defaultValue: ""
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      // defaultValue: ""
    },
    isAssigned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: "0",
      comment: "0=>not assigned,1=>done,2=>not done"
    },
    status: {
      type: DataTypes.ENUM('0', '1', '2', '3'),
      allowNull: false,
      defaultValue: "0",
      comment: "0=>pending,1=>shiped,2=>delivered,3=> dispatched"
    },
    total_distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    delivery_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    serviceFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    flat_pickup_charge: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    flat_delivery_charge: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    is_pay_later: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "0=>pending, 1=>paid"
    },
    trasaction_id_later: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // request: {
    //   type: DataTypes.ENUM('0','1','2'),
    //   allowNull: false,
    //   defaultValue: "0"
    // },
    // otpbooking: {
    //   type: DataTypes.STRING(255),
    //   allowNull: false,
    //   defaultValue: ""
    // },
    // pickupLocation: {
    //   type: DataTypes.STRING(255),
    //   allowNull: false,
    //   defaultValue: ""
    // },
    dropLocation: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    // pickupLatitude: {
    //   type: DataTypes.STRING(255),
    //   allowNull: false,
    //   defaultValue: ""
    // },
    // pickupLongitude: {
    //   type: DataTypes.STRING(255),
    //   allowNull: false,
    //   defaultValue: ""
    // },
    dropLatitude: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    dropLongitude: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    payment_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: "0",
      comment: "0=>pending,1=>completed,2 =>failed"
    },
    // pickupName: {
    //   type: DataTypes.STRING(255),
    //   allowNull: false,
    //   defaultValue: ""
    // },
    // pickupContact: {
    //   type: DataTypes.STRING(255),
    //   allowNull: false,
    //   defaultValue: ""
    // },
    // pickupEmail: {
    //   type: DataTypes.STRING(255),
    //   allowNull: false,
    //   defaultValue: ""
    // },
    dropName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    dropContact: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    dropEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    addOns: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    adminCommission: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    // numberOfPassenger: {
    //   type: DataTypes.STRING(255),
    //   allowNull: false,
    //   defaultValue: ""
    // },
    rideType: {
      type: DataTypes.ENUM('0', '1'),
      allowNull: false,
      defaultValue: "0",
      comment: "0=>single ride,1=>pool ride"
    },
    bookingPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: "0.00"
    },
    primary_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    primary_firstName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    primary_lastName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    primary_phone_number: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    primary_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    primary_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    primary_suite_apt_building: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    primary_full_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    primary_lat: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    secondary_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    secondary_firstName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    secondary_lastName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    secondary_phone_number: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    secondary_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'secondary_email'
    },
    secondary_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    secondary_suite_apt_building: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    secondary_full_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    secondary_lat: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    secondary_lng: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    primary_lng: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    paymentMethod: {
      type: DataTypes.ENUM('0', '1'),
      allowNull: false,
      defaultValue: "0",
      comment: "0=>cash,1=>online"
    },
    bookingDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    },
    shiper_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    shiper_firstName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    shiper_lastName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    shiper_phone_number: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    shiper_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    shiper_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: ""
    },
    shiper_suite_apt_building: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    shiper_full_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    shiper_lat: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    shiper_lng: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },

    consignee_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    consignee_firstName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    consignee_lastName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    consignee_phone_number: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    consignee_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    consignee_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    consignee_suite_apt_building: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    consignee_full_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    consignee_lat: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    consignee_lng: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "set when provider dispatches (status=3)"
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "set when provider delivers (status=2)"
    },
    avg_time: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "delivery duration in hours (end_time - start_time)"
    },
    barrel_discount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    base_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null
    },
    isVolumeDiscount: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      defaultValue: 0,
      comment: "0=>no volume discount, 1=>volume discount applied"
    },
    discountAfter: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    discountPercent: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    freeMiles: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "0"
    },
    primary_city: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    primary_state: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    secondary_city: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    secondary_state: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    shiper_city: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    shiper_state: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    consignee_city: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    consignee_state: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    // pickup_date: {
    //   type: DataTypes.DATE,
    //   allowNull: true,
    // },
    // delivery_date: {
    //   type: DataTypes.DATE,
    //   allowNull: true,
    // },
    primary_streetAddress: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    secondary_streetAddress: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    shiper_streetAddress: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    consignee_streetAddress: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
  }, {
    sequelize,
    tableName: 'bookings',
    timestamps: true,
    paranoid: false
  });
};
