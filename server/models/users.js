const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('users', {
        id: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        role: {
            type: DataTypes.ENUM('0', '1', '2', '3'),
            allowNull: false,
            defaultValue: "1",
            comment: "o=>admin,1=>user,2=>provider"
        },
        document: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: "",
            comment: "user document"
        },
        firstName: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "",
            comment: "user first name / company legal name"
        },
        lastName: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "",
            comment: "user last name / doing business as name"
        },
        isProfileComplete: {
            type: DataTypes.ENUM('0', '1'),
            allowNull: false,
            defaultValue: "0"
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        countryCode: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: ""
        },
        phoneNumber: {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: ""
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        image: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        survey: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
            // 1 for fast delivery,2 for safest delivery,3 for best price,4 for other
        },
        // Free text the customer types when they pick "Other" in the signup survey.
        // Captured verbatim so we can read what actually matters to people beyond
        // the three fixed choices.
        surveyOther: {
            type: DataTypes.STRING(500),
            allowNull: true,
            defaultValue: ""
        },
        full_address: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        suite_apt_building: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: ""
        },
        otp: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        // Hardened OTP / password-reset fields (see helper/otpHelper.js). The plaintext `otp`
        // column above is kept for the legacy mobile flow but is no longer used by the web flow.
        otpHash: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null,
            comment: "HMAC of the current OTP or reset ticket; never the plaintext code"
        },
        otpPurpose: {
            type: DataTypes.STRING(32),
            allowNull: true,
            defaultValue: null,
            comment: "verify_email | reset_password | reset_verified"
        },
        otpExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        },
        otpAttempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: "wrong-attempt counter for brute-force lockout"
        },
        otpLastSentAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
            comment: "timestamp of last OTP send, for resend cooldown"
        },
        social_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        social_type: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        otpVerify: {
            type: DataTypes.ENUM('0', '1'),
            allowNull: false,
            defaultValue: "0",
            comment: "0=>not verify,1=>verify"
        },
        status: {
            type: DataTypes.ENUM('0', '1'),
            allowNull: false,
            defaultValue: "1",
            comment: "0=>incative,1=>active"
        },
        loginTime: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        bio: {
            type: DataTypes.STRING(900),
            allowNull: false,
            defaultValue: ""
        },
        location: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        latitude: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        longitude: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        isNotificationOn: {
            type: DataTypes.ENUM('0', '1'),
            allowNull: false,
            defaultValue: "1",
            comment: "0 off ,1 on"
        },
        deviceToken: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        deviceType: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: ""
        },
        socketId: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        online: {
            type: DataTypes.ENUM('0', '1'),
            allowNull: false,
            defaultValue: "0",
            comment: "for chat 1=>online, 0=>offline"
        },
        customerId: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "",
            comment: "for Stripe Payment "
        },
        accountId: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "",
            comment: "for Stripe Payment "
        },
        hashAccount: {
            type: DataTypes.ENUM('0', '1'),
            allowNull: false,
            defaultValue: "0",
            comment: "for Stripe Payment   0=>pending,1=>complete"
        },
        // Guest checkout creates the account silently at "Pay now"
        // ('pending_password'); the customer sets a password afterwards via the
        // success page or the tokenised link in the receipt email.
        account_state: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: "active"
        },
        setup_token: {
            type: DataTypes.STRING(128),
            allowNull: true
        },
        setup_token_expires: {
            type: DataTypes.DATE,
            allowNull: true
        },
        country: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        city: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        state: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
        zip: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: ""
        },
        gender: {
            type: DataTypes.ENUM('0', '1', '2'),
            allowNull: false,
            defaultValue: "0",
            comment: "for chat 0=>male, 1=>female, 2=>other"
        },
        // block: {
        //   type: DataTypes.ENUM('0','1'),
        //   allowNull: false,
        //   defaultValue: "0",
        //   comment: " 0=>unblock, 1=>block"
        // },
        // suspend: {
        //   type: DataTypes.ENUM('0','1'),
        //   allowNull: false,
        //   defaultValue: "0",
        //   comment: " 0=>unsuspend, 1=>suspend"
        // },
        // approve: {
        //   type: DataTypes.ENUM('0','1','2'),
        //   allowNull: false,
        //   defaultValue: "0",
        //   comment: " 0=>pending, 1=>aproved, 2=>rejected"
        // },
        documentVerify: {
            type: DataTypes.ENUM('0', '1', '2'),
            allowNull: false,
            defaultValue: "0",
            comment: " 0=>pending, 1=>verified, 2=>rejected"
        },
        adminCommission: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "",
            comment: "for admin charge"
        },
        overallCommission: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "",
            comment: "overall commission percent for admin"
        },
        working_as: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: "",
        },
        // totalAmount: {
        //   type: DataTypes.STRING(255),
        //   allowNull: false,
        //   defaultValue: ""
        // },
        // vehicle: {
        //   type: DataTypes.ENUM('0','1'),
        //   allowNull: false,
        //   defaultValue: "0"
        // }
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        },
        profile_step: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: "for provider signup steps"
        },
        avg_rating: {
            type: DataTypes.DECIMAL(3, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: "average rating from user reviews"
        },
        ranking: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            comment: "provider ranking position"
        },
        streetAddress: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: ""
        },
       
    }, {
        sequelize,
        tableName: 'users',
        timestamps: true,
        paranoid: true
    });
};
