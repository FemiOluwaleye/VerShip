const db = require('../../models');
const bcrypt = require('bcryptjs');
const helper = require('../../helper/helper');
const { Validator } = require('node-input-validator');
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { Sequelize } = require('sequelize');
const otpHelper = require('../../helper/otpHelper');
const mailHelper = require('../../helper/mailHelper');

// A random 4-digit delivery PIN (rideOtp). This is the code a customer hands the
// driver on delivery — unrelated to the login/email OTP, but it must not be a
// hardcoded '1111'. Mirrors the generation already used in createAccount().
const generateRideOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

module.exports = {
    login: async (req, res) => {
        try {
            const v = new Validator(req.body, {
                countryCode: "required",
                phoneNumber: "required",
                role: "required",
                // Email is required because the OTP is delivered by email (Resend). Without a
                // real SMS provider this is how the mobile code reaches the user.
                email: "required|email",
            });

            const errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.failure(res, errorsResponse);
            }

            const {
                deviceToken,
                deviceType,
                phoneNumber,
                countryCode,
                role,
            } = req.body;
            const email = String(req.body.email).trim().toLowerCase();

            const existingUser = await db.users.findOne({
                where: {
                    phoneNumber: phoneNumber,
                    countryCode: countryCode,
                    role: role,
                    deletedAt: null
                }
            });

            let user;
            let isNewUser = false;

            if (existingUser) {
                if (existingUser.status === "0") {
                    return helper.failure(res, 'Your account has been deactivated by admin.');
                }
                // if (existingUser.role === "2" && existingUser.approve === "0") {
                //     return helper.failure(res, 'Your account is not approved by admin.');
                // }

                user = existingUser;
            } else {
                const userWithSamePhone = await db.users.findOne({
                    where: {
                        phoneNumber: phoneNumber,
                        countryCode: countryCode,
                        deletedAt: null
                    }
                });

                if (userWithSamePhone) {
                    return helper.failure(res, 'Phone number already registered with a different role');
                }

                user = await db.users.create({
                    countryCode: countryCode,
                    phoneNumber: phoneNumber,
                    role: role,
                    deviceToken: deviceToken || null,
                    deviceType: deviceType || null,
                    status: "1"
                });

                isNewUser = true;
            }

            // Keep contact + device details current, and refresh the delivery PIN.
            user.email = email;
            user.rideOtp = generateRideOtp();
            if (deviceToken) {
                user.deviceToken = deviceToken;
                user.deviceType = deviceType || null;
            }
            user.otpVerify = "0";
            user.updatedAt = helper.unixTimestamp();

            // Generate + persist a hashed, expiring code (issueCode saves the instance, so the
            // email/rideOtp/device changes above are persisted in the same write).
            const code = await otpHelper.issueCode(user, otpHelper.PURPOSE.VERIFY_EMAIL);

            try {
                await mailHelper.sendVerificationOtpEmail(email, code);
            } catch (mailErr) {
                console.error('Failed to send login OTP email:', mailErr.message);
                return helper.failure(res, 'Could not send verification code. Please try again.');
            }

            // NOTE: no token is issued here. The client must call /verifyOtp with the emailed
            // code to obtain a session — proving control of the inbox before authentication.
            const responseData = {
                phoneNumber,
                countryCode,
                email,
                role,
                isNewUser,
            };
            if (isNewUser) {
                return helper.success(res, 'Account created. A verification code has been sent to your email.', responseData);
            }
            return helper.success(res, 'A verification code has been sent to your email.', responseData);

        } catch (error) {
            console.error('Login error:', error);
            return helper.failure(res, 'Something went wrong');
        }
    },
    verifyOtp: async (req, res) => {
        try {
            const v = new Validator(req.body, {
                otp: 'required',
                countryCode: 'required',
                phoneNumber: 'required',
            });

            let errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.failure(res, errorsResponse);
            }

            let user = await db.users.findOne({
                where: {
                    phoneNumber: req.body.phoneNumber,
                    countryCode: req.body.countryCode,
                    deletedAt: null
                },
            });

            if (!user) {
                return helper.failure(res, 'User not found.');
            }

            if (user.status === 0 || user.status === "0") {
                return helper.failure(res, "Your account is in-active by Admin. Please contact the admin for assistance.");
            }

            const result = await otpHelper.verifyCode(user, req.body.otp, otpHelper.PURPOSE.VERIFY_EMAIL);
            if (!result.ok) {
                if (result.reason === 'locked') {
                    return helper.failure(res, 'Too many incorrect attempts. Please request a new code.');
                }
                if (result.reason === 'expired' || result.reason === 'no_code') {
                    return helper.failure(res, 'Your code has expired. Please request a new one.');
                }
                return helper.failure(res, 'Incorrect verification code.');
            }

            // Code verified — NOW issue the session token, signed with the loginTime we persist
            // so the single-session check in verifyUser stays consistent.
            const loginTime = helper.unixTimestamp();
            user.otpVerify = "1";
            user.loginTime = loginTime;
            await user.save();

            const token = jwt.sign(
                { loginTime: loginTime, id: user.id },
                process.env.JWT_SECRET
            );

            const responseData = user.toJSON();
            delete responseData.password;
            delete responseData.otpHash;

            return helper.success(res, 'OTP verified successfully.', {
                ...responseData,
                token: token
            });
        } catch (error) {
            console.error('verifyOtp error:', error);
            return helper.failure(res, 'Something went wrong');
        }
    },
    resendOTP: async (req, res) => {
        try {
            const v = new Validator(req.body, {
                countryCode: "required",
                phoneNumber: "required",
            });

            const errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.failure(res, errorsResponse);
            }

            const { countryCode, phoneNumber } = req.body;

            // Model instance (not raw) so otpHelper can persist via save().
            const user = await db.users.findOne({
                where: {
                    phoneNumber,
                    countryCode,
                    deletedAt: null
                },
            });

            if (!user) {
                return helper.failure(res, "User not found");
            }

            if (!user.email) {
                return helper.failure(res, "No email on file for this account. Please log in again.");
            }

            // Throttle resends per account.
            if (otpHelper.isOnCooldown(user)) {
                const wait = otpHelper.cooldownSecondsRemaining(user);
                return helper.failure(res, `Please wait ${wait}s before requesting another code.`);
            }

            user.otpVerify = "0";
            const code = await otpHelper.issueCode(user, otpHelper.PURPOSE.VERIFY_EMAIL);

            try {
                await mailHelper.sendVerificationOtpEmail(user.email, code);
            } catch (mailErr) {
                console.error('Failed to resend OTP email:', mailErr.message);
                return helper.failure(res, "OTP Not Sent!");
            }

            return helper.success(res, "A new verification code has been sent to your email.");
        } catch (error) {
            console.error('resendOTP error:', error);
            return helper.failure(res, "OTP Not Sent!");
        }
    },
    createAccount: async (req, res) => {
        try {
            let profile = await db.users.findOne({
                where: {
                    id: req.user.id,
                },
            });
            const rideOtp = Math.floor(1000 + Math.random() * 9000).toString();
            const updatedProfileData = {
                ...req.body,
                rideOtp: rideOtp
            };
            await db.users.update(updatedProfileData, {
                where: {
                    id: req.user.id,
                },
            });
            profile = await db.users.findOne({
                where: {
                    id: req.user.id,
                },
                raw: true,
            });
            return helper.success(res, "Profile addeed successfully.", profile);
        } catch (error) {
            return helper.failure(res, "An error occurred while added the profile.");
        }
    },
    getProfile: async (req, res) => {
        try {
            const userId = req.user.id;

            const get_user_details = await db.users.findOne({
                where: { id: userId },
                raw: true,
            });

            if (!get_user_details) {
                return helper.error(res, "User not found.");
            }

            return helper.success(
                res,
                "Get user Profile Successfully.",
                get_user_details
            );
        } catch (error) {
            return helper.failure(res, "Something went wrong.");
        }
    },
    editProfile: async (req, res) => {
        try {
            let profile = await db.users.findOne({
                where: {
                    id: req.user.id,
                },
            });

            const updatedProfileData = {
                ...req.body,
            };
            await db.users.update(updatedProfileData, {
                where: {
                    id: req.user.id,
                },
            });
            profile = await db.users.findOne({
                where: {
                    id: req.user.id,
                },
                raw: true,
            });
            return helper.success(res, "Profile updated successfully.", profile);
        } catch (error) {
            return helper.failure(res, "An error occurred while updating the profile.");
        }
    },
    deleteAccount: async (req, res) => {
        try {
            const deletedAt = new Date();

            let updatedUser = await db.users.update(
                {
                    deletedAt: deletedAt,
                },
                {
                    where: {
                        id: req.user.id,
                    },
                }
            );

            return helper.success(res, "Account deleted successfully.", {});
        } catch (error) {
            return helper.failure(res, "Error during account deletion.", {});
        }
    },
    logout: async (req, res) => {
        try {
            let loginTime = helper.unixTimestamp();
            await db.users.update(
                {
                    deviceToken: "",
                    loginTime: loginTime,
                },
                {
                    where: {
                        id: req.user.id,
                    },
                }
            );

            return helper.success(res, "Logout Successfully", {});
        } catch (error) {
            return helper.failure(res, "Error during account logout.", {});

        }
    },
    getCmsContent: async (req, res) => {
        try {
            const { type } = req.query;
            if (![1, 2, 3].includes(Number(type))) {
                return helper.failure(
                    res,
                    "Invalid type. Use 1 for Privacy Policy, 3 for Terms and Conditions, 2 for About us."
                );
            }
            const cmsContent = await db.cms.findOne({
                where: {
                    type: Number(type),
                },
            });

            if (!cmsContent) {
                return helper.failure(res, "Content not found.");
            }

            let message = "";
            switch (Number(type)) {
                case 1:
                    message = "Privacy policy guidelines retrieved successfully.";
                    break;
                case 2:
                    message = "About us content retrieved successfully.";
                    break;
                case 3:
                    message = "Terms and conditions retrieved successfully.";

                    break;
            }

            return helper.success(res, message, cmsContent);
        } catch (error) {
            return helper.failure(res, error);
        }
    },
    notificationOnOff: async (req, res) => {
        try {
            const isNotificationOn = parseInt(req.body.isNotificationOn, 10);

            if (![0, 1].includes(isNotificationOn)) {
                return helper.failure(res, "Invalid value. Use 1 or 0 as integer.");
            }
            let user = await db.users.findOne({
                where: { id: req.user.id },
                raw: true,
            });

            if (!user) {
                return helper.failure(res, "User not found.");
            }

            const msg = isNotificationOn === 1 ? "Notifications ON." : "Notifications OFF.";

            await db.users.update(
                { isNotificationOn: isNotificationOn.toString() },
                { where: { id: req.user.id } }
            );

            return helper.success(res, msg, { isNotificationOn: isNotificationOn });
        } catch (error) {
            return helper.failure(res, "Something went wrong.", {});
        }
    },
    createContactUs: async (req, res) => {
        try {
            const v = new Validator(req.body, {
                name: "required",
                email: "required|email",
                message: "required",
                phoneNumber: "required",
                countryCode: "required",
            });

            const errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.failure(res, errorsResponse);
            }

            const supportData = {
                name: req.body.name,
                email: req.body.email,
                message: req.body.message,
                phoneNumber: req.body.phoneNumber,
                countryCode: req.body.countryCode,
                location: req.body.location || null,
            };

            const create_contact = await db.contactus.create(supportData);

            return helper.success(
                res,
                "Information submitted successfully.",
                create_contact
            );
        } catch (error) {
            return helper.failure(res, "Something went wrong. Please try again.");
        }
    },
    vehicleAdd: async (req, res) => {
        try {
            const v = new Validator(req.body, {
                vehicleBrand: "required",
                vehicleModel: "required",
                vehicleYear: "required",
                vehicleNumber: "required",
                vehicleColor: "required",
                vehicleDocument: "required",
                drivingLicence: "required"
            });

            const errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.failure(res, errorsResponse);
            }

            const {
                vehicleBrand,
                vehicleModel,
                vehicleYear,
                vehicleNumber,
                vehicleColor,
                vehicleDocument,
                drivingLicence
            } = req.body;

            const driverId = req.user.id;

            const driver = await db.users.findOne({
                where: {
                    id: driverId,
                    role: "2"
                }
            });

            if (!driver) {
                return helper.failure(res, 'User not found or not authorized as driver');
            }

            const existingVehicle = await db.vehicleDetails.findOne({
                where: { driverId }
            });

            if (existingVehicle) {
                return helper.failure(res, 'Vehicle already registered for this driver');
            }

            const existingVehicleNumber = await db.vehicleDetails.findOne({
                where: { vehicleNumber }
            });

            if (existingVehicleNumber) {
                return helper.failure(res, 'Vehicle number already registered');
            }

            const transaction = await db.sequelize.transaction();

            try {
                const vehicle = await db.vehicleDetails.create({
                    driverId: driverId,
                    vehicleBrand: vehicleBrand,
                    vehicleModel: vehicleModel,
                    vehicleYear: vehicleYear,
                    vehicleNumber: vehicleNumber,
                    vehicleColor: vehicleColor,
                    vehicleDocument: vehicleDocument,
                    drivingLicence: drivingLicence
                }, { transaction });

                await db.users.update(
                    { vehicle: "1", isProfileComplete: '1' },
                    {
                        where: { id: driverId },
                        transaction
                    }
                );

                await transaction.commit();

                const updatedUser = await db.users.findOne({
                    where: { id: driverId },
                });

                const responseData = {
                    id: vehicle.id,
                    vehicleBrand: vehicle.vehicleBrand,
                    vehicleModel: vehicle.vehicleModel,
                    vehicleYear: vehicle.vehicleYear,
                    vehicleNumber: vehicle.vehicleNumber,
                    vehicleColor: vehicle.vehicleColor,
                    vehicleDocument: vehicle.vehicleDocument,
                    drivingLicence: vehicle.drivingLicence,
                    userVehicleStatus: updatedUser.vehicle
                };

                return helper.success(res, 'Vehicle added successfully', responseData);

            } catch (error) {
                await transaction.rollback();
                throw error;
            }

        } catch (error) {
            return helper.failure(res, `Something went wrong while adding vehicle: ${error.message}`);
        }
    },
    fileUploadDriver: async (req, res) => {
        try {
            if (!req.files || !req.files.file) {
                return helper.failure(res, "No file uploaded");
            }

            let files = [];
            const uploadedFiles = Array.isArray(req.files.file) ? req.files.file : [req.files.file];

            for (const file of uploadedFiles) {
                try {
                    const uploadedPath = await helper.fileUpload(file);
                    files.push(uploadedPath);
                } catch (err) {
                    return helper.failure(res, `Error uploading file: ${err.message}`);
                }
            }

            return helper.success(res, "Files uploaded successfully", {
                files: files
            });
        } catch (error) {
            return helper.failure(res, "Error occurred during file upload");
        }
    },
    home: async (req, res) => {
        try {
            const responseData = await db.banners.findAll();
            return helper.success(res, 'All banner detail.', responseData);
        } catch (error) {
            return helper.failure(res, "Something went wrong.");

        }
    },
    vehicleEdit: async (req, res) => {
        ``
        try {
            const v = new Validator(req.body, {

            });

            const errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.failure(res, errorsResponse);
            }

            const {
                vehicleBrand,
                vehicleId,
                vehicleModel,
                vehicleYear,
                vehicleNumber,
                vehicleColor,
                vehicleDocument,
                drivingLicence
            } = req.body;

            const driverId = req.user.id;

            const driver = await db.users.findOne({
                where: {
                    id: driverId,
                    role: "2",
                    deletedAt: null
                }
            });

            if (!driver) {
                return helper.failure(res, 'User not found or not authorized as driver');
            }

            const existingVehicle = await db.vehicleDetails.findOne({
                where: {
                    id: vehicleId,
                    driverId: driverId
                }
            });

            if (!existingVehicle) {
                return helper.failure(res, 'Vehicle not found or not authorized to edit');
            }

            const existingVehicleNumber = await db.vehicleDetails.findOne({
                where: {
                    vehicleNumber: vehicleNumber,
                    id: { [db.Sequelize.Op.ne]: vehicleId }
                }
            });

            if (existingVehicleNumber) {
                return helper.failure(res, 'Vehicle number already registered by another vehicle');
            }

            await db.vehicleDetails.update({
                vehicleBrand: vehicleBrand,
                vehicleModel: vehicleModel,
                vehicleYear: vehicleYear,
                vehicleNumber: vehicleNumber,
                vehicleColor: vehicleColor,
                vehicleDocument: vehicleDocument,
                drivingLicence: drivingLicence,
                updatedAt: new Date()
            }, {
                where: {
                    id: vehicleId,
                    driverId: driverId
                }
            });

            const updatedVehicle = await db.vehicleDetails.findOne({
                where: { id: vehicleId }
            });

            const responseData = {
                id: updatedVehicle.id,
                vehicleBrand: updatedVehicle.vehicleBrand,
                vehicleModel: updatedVehicle.vehicleModel,
                vehicleYear: updatedVehicle.vehicleYear,
                vehicleNumber: updatedVehicle.vehicleNumber,
                vehicleColor: updatedVehicle.vehicleColor,
                vehicleDocument: updatedVehicle.vehicleDocument,
                drivingLicence: updatedVehicle.drivingLicence,
                updatedAt: updatedVehicle.updatedAt
            };

            return helper.success(res, 'Vehicle updated successfully', responseData);

        } catch (error) {
            return helper.failure(res, `Something went wrong while updating vehicle: ${error.message}`);
        }
    },
    vehicleGet: async (req, res) => {
        try {
            const driverId = req.user.id;

            const driver = await db.users.findOne({
                where: {
                    id: driverId,
                    role: "2",
                    deletedAt: null
                }
            });

            if (!driver) {
                return helper.failure(res, 'User not found or not authorized as driver');
            }

            const vehicle = await db.vehicleDetails.findOne({
                where: { driverId },

            });

            if (!vehicle) {
                return helper.failure(res, 'No vehicle found for this driver');
            }

            return helper.success(res, 'Vehicle details fetched successfully', vehicle);

        } catch (error) {
            return helper.failure(res, `Something went wrong while fetching vehicle: ${error.message}`);
        }
    },
    bankDetail: async (req, res) => {
        try {
            const admin = await db.users.findOne({
                where: { role: "0" },
                include: [
                    {
                        model: db.userBanks,
                        as: 'banks',
                        required: false,
                    },
                ],
            });
            return helper.success(res, 'Vehicle details fetched successfully', admin);
        } catch (error) {
            return helper.failure(res, `Something went wrong.`);

        }
    },

    transactionSsHistory: async (req, res) => {
        try {
            const driverId = req.user.id;
            const { status } = req.body;
            const driver = await db.users.findOne({
                where: { id: driverId },
                attributes: ["totalAmount"]
            });
            const currentBalance = driver?.totalAmount || "0.00";
            let whereCondition = { driverId };

            if (status !== undefined && status !== "") {
                whereCondition.status = status;
            }
            const history = await db.transferscreenshot.findAll({
                where: whereCondition,
                order: [["createdAt", "DESC"]],
            });

            return res.status(200).json({
                status: true,
                message: "Transaction history fetched successfully",
                currentBalance: currentBalance,
                history: history
            });

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: "Something went wrong",
                error: error.message
            });
        }
    },

    userActiveRide: async (req, res) => {
        try {
            const userId = req.user.id;

            // Find if user has any active ride
            const activeRide = await db.bookings.findOne({
                where: {
                    userId: userId,
                    status: { [Sequelize.Op.in]: ['0', '1', '2'] },
                    request: '0'
                },
                include: [
                    {
                        model: db.users,
                        as: 'driverbook',
                    },
                ],
                order: [['id', 'DESC']]
            });

            // If no ride active
            if (!activeRide) {
                return helper.success(res, "No active ride", {
                    hasActiveRide: false,
                    ride: null
                });
            }

            // If active ride exists
            const driver = activeRide.driver;

            return helper.success(res, "Active ride found", {
                hasActiveRide: true,
                ride: {
                    id: activeRide.id,
                    orderId: activeRide.orderId,
                    status: activeRide.status,
                    request: activeRide.request,
                    pickupLocation: activeRide.pickupLocation,
                    dropLocation: activeRide.dropLocation,
                    coordinates: {
                        pickup: {
                            latitude: activeRide.pickupLatitude,
                            longitude: activeRide.pickupLongitude
                        },
                        drop: {
                            latitude: activeRide.dropLatitude,
                            longitude: activeRide.dropLongitude
                        }
                    },
                    driver: driver ? {
                        id: driver.id,
                        fullName: `${driver.firstName} ${driver.lastName}`,
                        phone: driver.phoneNumber,
                        image: driver.image,
                        latitude: driver.latitude,
                        longitude: driver.longitude
                    } : null
                }
            });

        } catch (error) {
            console.log("Error in userActiveRide:", error);
            return helper.failure(res, "Something went wrong.");
        }
    },

    


}