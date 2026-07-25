const db = require('../../models');
const helper = require('../../helper/helper');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendResetEmail, sendSubscriptionEmail, sendBookingStatusUpdateEmailToUser, sendOtpEmail, sendOtpEmail12, sendVerificationOtpEmail, sendFreightForwarderRegistrationEmail, sendNewOrderPlacedEmailToProvider, sendNewOrderPlacedEmailToProvider12, sendAdditionalCostRequestEmail, sendOrderConfirmationToCustomer } = require('../../helper/mailHelper');
const otpHelper = require('../../helper/otpHelper');
const { env } = require('../../helper/envConfig');

// Fields that must never be serialised back to a client — OTP/reset material and the password hash.
const SENSITIVE_USER_FIELDS = ['password', 'otp', 'otpHash', 'otpPurpose', 'otpExpiresAt', 'otpAttempts', 'otpLastSentAt'];

// Return a plain object of the user safe to send to the client.
const sanitizeUser = (user) => {
    if (!user) return user;
    const obj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
    for (const f of SENSITIVE_USER_FIELDS) delete obj[f];
    return obj;
};

// Recompute the post-login redirect flags for a role-1 (customer) user based on their latest
// booking request. Shared by login and verify so the two stay in lockstep.
const buildRedirectState = async (user) => {
    const state = {
        pendingRequestId: null,
        isQuotesRedirect: false,
        isBookingComplete: false,
        isShipOwn: false,
        isDropOff: false,
    };
    if (user.role !== '1') return state;

    const latestRequest = await db.booking_requests.findOne({
        where: { userId: user.id },
        include: [{ model: db.booking_requests_items, as: 'items' }],
        order: [['id', 'DESC']],
    });

    if (!latestRequest) {
        state.isBookingComplete = true;
        return state;
    }
    if (latestRequest.payment_status == 1) {
        state.isBookingComplete = true;
        return state;
    }
    const items = latestRequest.items || [];
    state.isShipOwn = items.some((item) => (item.sub_type || '').includes('Ship Your Own Barrel'));
    state.isDropOff = items.some((item) => (item.sub_type || '').includes('Request Barrel Drop-Off'));
    if (state.isShipOwn) {
        state.isQuotesRedirect = true;
    } else if (state.isDropOff) {
        if (!latestRequest.drop_off_address) {
            state.pendingRequestId = latestRequest.id;
        } else {
            state.isQuotesRedirect = true;
        }
    } else if (!latestRequest.drop_off_address) {
        state.isQuotesRedirect = true;
    } else {
        state.pendingRequestId = latestRequest.id;
    }
    return state;
};
module.exports = {
    logout: async (req, res) => {
        try {
            const userId = req.user.id;
            await db.booking_requests.destroy({ where: { userId, payment_status: 0 } });
            return helper.success(res, "Logged out successfully.");
        } catch (error) {
            console.log("error=------logout----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    deleteAccount: async (req, res) => {
        try {
            const { email, reason } = req.body;

            const user = await db.users.findOne({
                where: { email }
            });

            if (!user) {
                return helper.failure(res, "User not found.");
            }

            // Option A: Set reason before destroy
            user.reason = reason;
            await user.save();

            // Then destroy (this sets deletedAt automatically)
            await user.destroy();

            return helper.success(res, "Account deleted successfully.");

        } catch (error) {
            console.log("error=------deleteAccount----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    updateProfile: async (req, res) => {
        try {
            const { name, lastName, email, phoneNumber, longitude, latitude } = req.body;

            const user = await db.users.findOne({
                where: {
                    email,
                },
            });
            // if (user) {
            //     return helper.failure(res, "User already exists.");

            // Logged-in "change my password" (old -> new). The forgotten-password reset is handled
            // separately by the ticket-gated /reset-password endpoint. We operate strictly on the
            // AUTHENTICATED user (req.user.id), never an email from the body, so a signed-in user
            // can't change another account's password.
            if (req.body.type == "reset") {
                const authUser = await db.users.findOne({ where: { id: req.user.id } });
                if (!authUser) {
                    return helper.failure(res, "User not found.");
                }
                if (!req.body.oldPassword || req.body.oldPassword == "") {
                    return helper.failure(res, "Old password is required.");
                }
                if (req.body.newPassword == "" || req.body.confirmPassword == "") {
                    return helper.failure(res, "New password and confirm password are required.");
                }
                if (req.body.newPassword !== req.body.confirmPassword) {
                    return helper.failure(res, "New password and confirm password does not match.");
                }
                if (String(req.body.newPassword).length < 8) {
                    return helper.failure(res, "Password must be at least 8 characters.");
                }
                if (req.body.oldPassword === req.body.newPassword) {
                    return helper.failure(res, "New password cannot be same as old password.");
                }
                const oldMatches = await bcrypt.compare(req.body.oldPassword, authUser.password);
                if (!oldMatches) {
                    return helper.failure(res, "Incorrect old password.");
                }
                authUser.password = await bcrypt.hash(req.body.newPassword, 10);
                await authUser.save();
                return helper.success(res, "Password updated successfully.", sanitizeUser(authUser));
            } else {
                // console.log("req.body=----------------------->>>>>", req.body);
                // return
                if (req.files && req.files.image) {
                    user.image = await helper.fileUpload(req.files.image);
                }
                user.firstName = name;
                user.lastName = lastName;
                user.email = email;
                user.phoneNumber = phoneNumber;
                user.countryCode = req.body.countryCode || user.countryCode;
                user.streetAddress = req.body.streetAddress || user.streetAddress;
                user.city = req.body.city || user.city;
                user.state = req.body.state || user.state;
                user.latitude = req.body.latitude || user.latitude;
                user.longitude = req.body.longitude || user.longitude;
                await user.save();
                let updateduser = await db.users.findOne({
                    attributes: ['id', 'streetAddress', 'role', 'firstName', 'lastName', 'isProfileComplete', 'email', 'countryCode', 'phoneNumber', 'image', 'survey', 'otpVerify', 'status', 'loginTime', 'bio', 'location', 'latitude', 'longitude', 'isNotificationOn', 'deviceToken', 'deviceType', 'socketId', 'online', 'customerId', 'accountId', 'hashAccount', 'country', 'city', 'state', 'gender', 'documentVerify', 'adminCommission', 'profile_step', 'createdAt', 'updatedAt', 'deletedAt'],
                    where: {
                        email,
                    },
                });

                return helper.success(res, "Profile updated successfully.", sanitizeUser(updateduser));
            }



        } catch (error) {
            console.log("error=------updateProfile----------------->>>>>", error);
            return helper.failure(res, error);
        }
    },
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return helper.failure(res, "Email and password are required.");
            }
            const user = await db.users.findOne({
                attributes: ['id', 'role',
                    'firstName', "password",
                    'lastName', 'isProfileComplete', 'email', 'countryCode', 'phoneNumber', 'image', 'survey', 'otp', 'otpVerify', 'status', 'loginTime', 'bio', 'location', 'latitude', 'longitude', 'isNotificationOn', 'deviceToken', 'deviceType', 'socketId', 'online', 'customerId', 'accountId', 'hashAccount', 'country', 'city', 'state', 'gender', 'documentVerify', 'adminCommission', 'profile_step', 'createdAt', 'updatedAt', 'deletedAt', 'streetAddress'],
                where: {
                    email: req.body.email,
                },
                // raw: true,
            });
            // console.log("user=----------------------->>>>>", user);

            if (!user) {
                return helper.failure(res, "User not found.");
            }

            if (user.status === "0") {
                return helper.failure(res, "Your account deactived by admin");
            }

            if (req.body.role && user.role !== req.body.role) {
                const roleName = req.body.role === "1" ? "User" : "Business";
                const userRoleName = user.role === "1" ? "User" : "Business";
                return helper.failure(res, `These credentials do not belong to a ${roleName} account. (Account type: ${userRoleName})`);
            }
            const loginTime = helper.unixTimestamp() + Math.floor(Math.random() * 10000000);
            user.loginTime = loginTime;
            await user.save();

            let authtoken = await jwt.sign({ id: user.id, loginTime: loginTime }, process.env.JWT_SECRET);
            // console.log("authtoken=----------------------->>>>>", process.env.JWT_SECRET);
            console.log("user=----------------------->>>>>", user);
            let userdata = {
                id: user.id,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                countryCode: user.countryCode,
                phoneNumber: user.phoneNumber,
                image: user.image,
                survey: user.survey,
                otpVerify: user.otpVerify,
                status: user.status,
                loginTime: user.loginTime,
                bio: user.bio,
                location: user.location,
                latitude: user.latitude,
                longitude: user.longitude,
                isNotificationOn: user.isNotificationOn,
                deviceToken: user.deviceToken,
                deviceType: user.deviceType,
                socketId: user.socketId,
                online: user.online,
                customerId: user.customerId,
                accountId: user.accountId,
                hashAccount: user.hashAccount,
                country: user.country,
                city: user.city,
                profile_step: user.profile_step,
                isProfileComplete: user.isProfileComplete,
                state: user.state,
                gender: user.gender,
                documentVerify: user.documentVerify,
                adminCommission: user.adminCommission,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                deletedAt: user.deletedAt,
                streetAddress: user.streetAddress
            }
            let hashedPassword = await bcrypt.compare(password, user.password);
            if (!hashedPassword) {
                return helper.failure(res, "Incorrect password.");
            }

            if (user.role === "2") {
                // providerDetails now exists from signup onward — only hold providers at the
                // admin-verification gate once they have actually submitted documents.
                const details = await db.providerDetails.findOne({ where: { providerId: user.id } });
                if (details && details.certificateOfIncorporation && details.documentVerify != 1) {
                    return helper.failure(res, "Your account is pending admin verification. Please try again later.");
                }
            }
            // console.log("authtoken=----------------------->>>>>", userdata, authtoken);
            let pendingRequestId = null;
            let isQuotesRedirect = false;
            let isBookingComplete = false;
            let isShipOwn = false;
            let isDropOff = false;

            if (user.role === "1") {
                const latestRequest = await db.booking_requests.findOne({
                    where: { userId: user.id },
                    include: [{ model: db.booking_requests_items, as: 'items' }],
                    order: [['id', 'DESC']]
                });

                if (latestRequest) {
                    if (latestRequest.payment_status == 1) {
                        isBookingComplete = true;
                    } else {
                        const items = latestRequest.items || [];
                        isShipOwn = items.some(item => (item.sub_type || "").includes("Ship Your Own Barrel"));
                        isDropOff = items.some(item => (item.sub_type || "").includes("Request Barrel Drop-Off"));
                        console.log("isShipOwn=----------------------->>>>>", isShipOwn, isDropOff);
                        if (isShipOwn) {
                            isQuotesRedirect = true;
                        } else if (isDropOff) {
                            if (!latestRequest.drop_off_address) {
                                pendingRequestId = latestRequest.id;
                                isQuotesRedirect = false;
                            } else {
                                isQuotesRedirect = true;
                            }
                        } else {
                            // Fallback if sub_type doesn't match but request exists and unpaid
                            if (!latestRequest.drop_off_address) {
                                isQuotesRedirect = true;
                            } else {
                                pendingRequestId = latestRequest.id;
                            }
                        }
                    }
                } else {
                    isBookingComplete = true;
                }
            }

            return helper.success(res, "Login successfully.", { user: userdata, authtoken, pendingRequestId, isQuotesRedirect, isBookingComplete, isShipOwn, isDropOff });
        } catch (error) {
            console.log("error=------login----------------->>>>>", error);
            return helper.failure(res, error);
        }
    },
    // Verify a 6-digit code. `purpose` selects the flow:
    //   - 'verify_email' (default, signup): on success activates the account AND issues a session
    //     token, since the user is legitimately logging in for the first time.
    //   - 'reset_password' (forgot flow): on success issues a single-use, short-lived RESET TICKET
    //     and does NOT log the user in. The reset ticket is the only thing that authorises the
    //     subsequent /reset-password call. This decouples "proved inbox control" from "has a
    //     session", so a guessed reset code can at most reset the password — not hijack the login.
    verify: async (req, res) => {
        try {
            const { otp, email } = req.body;
            const purpose = req.body.purpose === otpHelper.PURPOSE.RESET_PASSWORD
                ? otpHelper.PURPOSE.RESET_PASSWORD
                : otpHelper.PURPOSE.VERIFY_EMAIL;

            if (!otp) return helper.failure(res, "Verification code is required.");
            if (!email) return helper.failure(res, "Email is required.");

            const user = await db.users.findOne({
                where: { email },
                order: [['createdAt', 'DESC']],
            });

            // Generic failure — do not reveal whether the account exists.
            if (!user) return helper.failure(res, "Invalid or expired code.");

            const result = await otpHelper.verifyCode(user, String(otp).trim(), purpose);
            if (!result.ok) {
                if (result.reason === 'locked') {
                    return helper.failure(res, "Too many incorrect attempts. Please request a new code.");
                }
                return helper.failure(res, "Invalid or expired code.");
            }

            if (purpose === otpHelper.PURPOSE.RESET_PASSWORD) {
                // Password reset: hand back a reset ticket, no session.
                const resetToken = await otpHelper.issueResetTicket(user);
                return helper.success(res, "Code verified. You can now set a new password.", {
                    email: user.email,
                    resetToken,
                });
            }

            // Email verification (signup): activate + log in.
            if (user.role === "2") {
                // providerDetails now exists from signup onward — only hold providers at the
                // admin-verification gate once they have actually submitted documents.
                const details = await db.providerDetails.findOne({ where: { providerId: user.id } });
                if (details && details.certificateOfIncorporation && details.documentVerify != 1) {
                    return helper.failure(res, "Your account is pending admin verification. Please try again later.");
                }
            }
            user.otpVerify = "1";
            await user.save();

            const authtoken = await jwt.sign({ id: user.id }, process.env.JWT_SECRET);
            const redirect = await buildRedirectState(user);
            return helper.success(res, "OTP verified successfully.", { user: sanitizeUser(user), authtoken, ...redirect });
        } catch (error) {
            console.log("error=------verify----------------->>>>>", error);
            return helper.failure(res, "Something went wrong.");
        }
    },
    forgotPassword12: async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return helper.failure(res, "Email is required.");
            }
            const user = await db.users.findOne({
                where: {
                    email,
                    // otpVerify: "1",
                },
            });
            if (!user) {
                return helper.failure(res, "User not found.");
            }
            // Generate a secure random token
            const token = crypto.randomBytes(32).toString('hex');
            user.otp = token;
            user.otpVerify = "0"; // Reset verification status
            await user.save();

            // Mock link - in production this would be sent via email
            const resetLink = `https://web.vershipgo.com/reset?token=${token}&email=${encodeURIComponent(email)}`;

            console.log("-----------------------------------------");
            console.log(`[Email Log] Reset Link for ${email} is:`);
            console.log(resetLink);
            console.log("-----------------------------------------");

            // Send real email
            try {
                await sendResetEmail(email, resetLink);
            } catch (mailError) {
                console.error("Email sending failed:", mailError.message);
                // We still return success because the link is logged and token is generated
            }

            return helper.success(res, "Password reset link sent successfully to your email.", { email });
        } catch (error) {
            console.log("error=------forgotPassword----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    // Start a password reset. Always returns the SAME generic success whether or not the email
    // maps to an account, so this endpoint can't be used to enumerate registered users. A code is
    // only actually issued/sent when the account exists and isn't on send cooldown.
    forgotPassword: async (req, res) => {
        const genericMessage = "If an account exists for that email, a verification code has been sent.";
        try {
            const { email } = req.body;
            if (!email) {
                return helper.failure(res, "Email is required.");
            }

            const user = await db.users.findOne({ where: { email } });

            if (user && !otpHelper.isOnCooldown(user)) {
                const otp = await otpHelper.issueCode(user, otpHelper.PURPOSE.RESET_PASSWORD);
                try {
                    await sendOtpEmail12(email, otp);
                } catch (mailError) {
                    console.error("Reset OTP email failed:", mailError.message);
                    // Still return the generic message — don't leak send failures / existence.
                }
            }

            return helper.success(res, genericMessage, { email });
        } catch (error) {
            console.log("error=------forgotPassword----------------->>>>>", error);
            // Even on error, keep the response generic.
            return helper.success(res, genericMessage, { email: req.body.email });
        }
    },
    // Final step of the forgot-password flow. Requires the single-use reset ticket returned by
    // /verify (purpose=reset_password). The ticket — not a session token and not the raw code —
    // is what authorises the password change, and it is consumed here so it can't be replayed.
    resetPassword: async (req, res) => {
        try {
            const { email, resetToken, newPassword, confirmPassword } = req.body;
            // Accept `token` as an alias for backward compatibility with older clients.
            const ticket = resetToken || req.body.token;

            if (!email || !ticket || !newPassword || !confirmPassword) {
                return helper.failure(res, "All fields are required.");
            }
            if (newPassword !== confirmPassword) {
                return helper.failure(res, "Passwords do not match.");
            }
            if (String(newPassword).length < 8) {
                return helper.failure(res, "Password must be at least 8 characters.");
            }

            const user = await db.users.findOne({ where: { email } });
            if (!user) {
                return helper.failure(res, "Invalid or expired reset request. Please start over.");
            }

            const consumed = await otpHelper.consumeResetTicket(user, String(ticket));
            if (!consumed.ok) {
                return helper.failure(res, "Invalid or expired reset request. Please start over.");
            }

            user.password = await bcrypt.hash(newPassword, 10);
            user.otpVerify = "1";
            // Invalidate any active session so a stolen token can't outlive the reset.
            user.loginTime = helper.unixTimestamp() + Math.floor(Math.random() * 10000000);
            await user.save();

            return helper.success(res, "Password reset successfully. Please log in with your new password.");
        } catch (error) {
            console.log("error=------resetPassword----------------->>>>>", error);
            return helper.failure(res, "Something went wrong.");
        }
    },
    // Re-issue a code for whichever flow the account is currently in (defaults to email
    // verification). Enforces the per-account send cooldown, returns a generic message and never
    // echoes the user record or the code.
    resendOtp: async (req, res) => {
        const genericMessage = "If an account exists for that email, a new verification code has been sent.";
        try {
            const { email } = req.body;
            if (!email) {
                return helper.failure(res, "Email is required.");
            }

            const user = await db.users.findOne({ where: { email } });
            if (!user) {
                return helper.success(res, genericMessage, { email });
            }

            if (otpHelper.isOnCooldown(user)) {
                const wait = otpHelper.cooldownSecondsRemaining(user);
                return helper.failure(res, `Please wait ${wait}s before requesting another code.`);
            }

            // Resume the in-progress purpose; if none is pending, treat it as email verification.
            const purpose = user.otpPurpose === otpHelper.PURPOSE.RESET_PASSWORD
                ? otpHelper.PURPOSE.RESET_PASSWORD
                : otpHelper.PURPOSE.VERIFY_EMAIL;

            const otp = await otpHelper.issueCode(user, purpose);
            try {
                if (purpose === otpHelper.PURPOSE.RESET_PASSWORD) {
                    await sendOtpEmail12(email, otp);
                } else {
                    await sendVerificationOtpEmail(email, otp);
                }
            } catch (mailError) {
                console.error("Resend OTP email failed:", mailError.message);
            }

            return helper.success(res, genericMessage, { email });
        } catch (error) {
            console.log("error=------resendOtp----------------->>>>>", error);
            return helper.success(res, genericMessage, { email: req.body.email });
        }
    },
    register: async (req, res) => {
        try {
            const { name, email, password, role, number, countryCode, survey, streetAddress, city, state } = req.body;
            console.log("survey=----------------------->>>>>", survey);
            // return
            let createObj = ""
            if (!name || !email || !password || !number) {
                return helper.failure(res, "Name, email,password,number are required.");
            }
            const hashedNewPassword = await bcrypt.hash(password, 10);

            const existingUser = await db.users.findOne({
                where: {
                    email,
                    otpVerify: "1",
                },
            });
            const existingPhone = await db.users.findOne({
                where: {
                    phoneNumber: req.body.number,
                    otpVerify: "1",
                },
            });
            let imagePath = "";
            if (req.files && req.files.profileImage) {
                imagePath = await helper.fileUpload(req.files.profileImage);
            }

            if (existingUser) {
                return helper.failure(res, "Email already exists.");
            }
            if (existingPhone) {
                return helper.failure(res, "Phone number already exists.");
            }
            if (req.body.role == "2") {
                if (!req.body.main_address) {
                    return helper.failure(res, "Address is required.");
                }
                createObj = {
                    role: role,
                    firstName: name,
                    lastName: req.body.lastName || "",
                    location: req.body.main_address,
                    latitude: req.body.latitude || "",
                    longitude: req.body.longitude || "",
                    email,
                    countryCode: countryCode || "+1",
                    phoneNumber: req.body.number,
                    password: hashedNewPassword,
                    working_as: req.body.working_as,
                    survey: survey,
                    // Consolidated signup collects all business details up front, so the
                    // old detail/contact steps (1-3) are already satisfied at registration.
                    profile_step: 3,
                    streetAddress: streetAddress || "",
                    city: city || "",
                    state: state || "",
                    zip: req.body.zip || ""
                }

            } else {
                createObj = {
                    role: role,
                    firstName: name,
                    lastName: req.body.lastName || "",
                    email,
                    image: imagePath,
                    countryCode: countryCode || "+1",
                    phoneNumber: req.body.number,
                    password: hashedNewPassword,
                    survey: survey,
                    streetAddress: streetAddress || "",
                    city: city || "",
                    state: state || "",
                    zip: req.body.zip || "",
                    location: req.body.main_address,
                    latitude: req.body.latitude || "",
                    longitude: req.body.longitude || "",
                }
            }

            console.log("createObj=----------------------->>>>>", createObj);
            // return
            const user = await db.users.create(createObj);

            // Consolidated onboarding: the signup form now carries every business detail
            // the old step-2/3 pages collected, so seed providerDetails (plus the
            // defaults the deleted timeline/service-area steps used to pick) right away.
            if (req.body.role == "2") {
                const contactFirst = req.body.primaryContactPersonFirstName || "";
                const contactLast = req.body.primaryContactPersonLastName || "";
                await db.providerDetails.create({
                    providerId: user.id,
                    businessName: name,
                    registerationNumber: req.body.registerationNumber || "",
                    countryOfRegistration: "USA",
                    businessAddress: req.body.main_address,
                    businessLatitude: req.body.latitude || "",
                    businessLongitude: req.body.longitude || "",
                    streetAddress: streetAddress || "",
                    city: city || "",
                    state: state || "",
                    zip: req.body.zip || "",
                    email,
                    phone: req.body.number,
                    primaryContactPersonFirstName: contactFirst,
                    primaryContactPersonLastName: contactLast,
                    primaryContactPerson: `${contactFirst} ${contactLast}`.trim(),
                    primaryContactEmail: req.body.primaryContactEmail || "",
                    deliveryTimeline: "21 Days",
                });
                await db.serviceAreaRoutes.create({ providerId: user.id, country: "USA", freightType: 2 });
            }
            const loginTime = helper.unixTimestamp() + Math.floor(Math.random() * 10000000);
            user.loginTime = loginTime;

            // Issue a cryptographically-secure 6-digit verification code (hashed at rest, 10-min
            // expiry). This also persists the user (issueCode saves).
            const otp = await otpHelper.issueCode(user, otpHelper.PURPOSE.VERIFY_EMAIL);

            // Fire-and-forget: registration must not block on email, but attach a .catch so a mail
            // failure can't become an unhandled rejection.
            sendVerificationOtpEmail(email, otp).catch((mailError) => {
                console.error("Verification OTP email failed:", mailError.message);
            });

            let authtoken = await jwt.sign({ id: user.id, loginTime: loginTime }, process.env.JWT_SECRET);

            return helper.success(res, "Registered successfully.", { user: sanitizeUser(user), authtoken });
        } catch (error) {
            console.log("error=------regiter----------------->>>>>", error);
            return helper.failure(res, error);
        }
    },

    // ---------------- PRE-PACKED FOOD BARREL (owner-sold fixed product) ----------------
    // Public: return the active product + its contents for the landing page.
    // Public: the barrels shown on the landing page — all ACTIVE + FEATURED ones.
    // Falls back to the single newest active barrel when nothing is featured, so
    // the page is never empty for setups that haven't marked a barrel featured.
    // Returns an ARRAY in `body` (the page renders a selectable grid).
    getPrepackedBarrel: async (req, res) => {
        try {
            const include = [{ model: db.prepacked_barrel_items, as: 'contents' }];
            const order = [
                ['id', 'DESC'],
                [{ model: db.prepacked_barrel_items, as: 'contents' }, 'sort_order', 'ASC'],
            ];

            let products = await db.prepacked_barrel.findAll({
                where: { status: "1", featured: true },
                include,
                order,
            });

            if (!products.length) {
                products = await db.prepacked_barrel.findAll({
                    where: { status: "1" },
                    include,
                    order,
                    limit: 1,
                });
            }

            if (!products.length) {
                return helper.failure(res, "No pre-packed barrel is available right now.");
            }
            return helper.success(res, "Pre-packed barrels fetched successfully.", products);
        } catch (error) {
            console.log("error=------getPrepackedBarrel-------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    // Public: quick checkout. Auto-creates a profile (and logs the buyer in) when
    // the email is new; records the order with no online charge (v1). If the email
    // already belongs to a registered account, the order is still saved to it but
    // NO token is issued (guest-checkout account-takeover guard) — the buyer is
    // told to log in to track it. Price is snapshotted server-side.
    createPrepackedOrder: async (req, res) => {
        try {
            const {
                product_id, quantity,
                firstName, lastName, email, phone, countryCode,
                recipient_name, recipient_phone, recipient_email,
                delivery_street, delivery_town, delivery_parish, delivery_country,
                notes,
            } = req.body;

            if (!email) return helper.failure(res, "Email is required to place your order.");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return helper.failure(res, "Please enter a valid email.");
            if (!delivery_street || !delivery_town || !delivery_parish) {
                return helper.failure(res, "A full Jamaican delivery address (street, town/city, parish) is required.");
            }

            const product = product_id
                ? await db.prepacked_barrel.findOne({ where: { id: product_id } })
                : await db.prepacked_barrel.findOne({ where: { status: "1" }, order: [['id', 'DESC']] });
            if (!product) return helper.failure(res, "That product is no longer available.");

            const qty = Math.max(1, parseInt(quantity, 10) || 1);
            const unitPrice = parseFloat(product.price) || 0;
            const totalPrice = (unitPrice * qty).toFixed(2);

            let authtoken = null;
            let accountExists = false;
            let user = await db.users.findOne({ where: { email, otpVerify: "1" } });

            if (!user) {
                const tempPassword = await bcrypt.hash("Vership-" + Date.now() + "-" + Math.random(), 10);
                user = await db.users.create({
                    role: "1",
                    firstName: firstName || recipient_name || "VerShip",
                    lastName: lastName || "Customer",
                    email,
                    countryCode: countryCode || "+1",
                    phoneNumber: phone || recipient_phone || "",
                    password: tempPassword,
                    otpVerify: "1",   // guest checkout: skip OTP, account usable immediately
                    status: "1",
                    survey: "",
                });
                const loginTime = helper.unixTimestamp() + Math.floor(Math.random() * 10000000);
                user.loginTime = loginTime;
                await user.save();
                authtoken = await jwt.sign({ id: user.id, loginTime }, process.env.JWT_SECRET);
            } else {
                accountExists = true;
            }

            const orderId = "ORD-PP-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
            const order = await db.prepacked_orders.create({
                orderId,
                userId: user.id,
                prepacked_barrel_id: product.id,
                quantity: qty,
                unit_price: String(unitPrice),
                total_price: String(totalPrice),
                currency: product.currency || "USD",
                recipient_name: recipient_name || "",
                recipient_phone: recipient_phone || "",
                recipient_email: recipient_email || email,
                delivery_street: delivery_street || "",
                delivery_town: delivery_town || "",
                delivery_parish: delivery_parish || "",
                delivery_country: delivery_country || "Jamaica",
                notes: notes || "",
                status: "0",
                payment_status: 0,
            });

            // Collect payment via Stripe before the order is considered placed.
            // The order row exists (payment_status 0 = unpaid) so an abandoned
            // payment leaves an auditable pending order; the verified webhook
            // (payment_intent.succeeded → prepackedOrderId) flips it to paid.
            const stripe = require('stripe')(env('STRIPE_SECRET_KEY'));
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(parseFloat(totalPrice) * 100),
                currency: (product.currency || 'USD').toLowerCase(),
                metadata: {
                    prepackedOrderId: order.id.toString(),
                    orderId,
                },
            });

            // Acknowledge the placed order to the buyer (best-effort).
            try {
                await sendOrderConfirmationToCustomer(email, {
                    customerName: firstName || recipient_name || 'there',
                    orderId,
                    orderType: 'Pre-Packed Barrel order',
                    itemSummary: `${product.name} × ${qty}`,
                    amount: totalPrice,
                    currency: product.currency || 'USD',
                    deliveryTo: [recipient_name, delivery_parish].filter(Boolean).join(', '),
                    note: "We've received your order. Once payment is complete we'll begin preparing your barrel — track it any time under My History after signing in.",
                });
            } catch (mailErr) {
                console.error('Order confirmation email (prepacked) failed:', mailErr.message);
            }

            return helper.success(res, "Order created. Complete payment to confirm.", {
                order,
                accountExists,
                authtoken,
                user: accountExists ? null : user,
                clientSecret: paymentIntent.client_secret,
                publishkey: env('STRIPE_PUBLISHABLE_KEY'),
            });
        } catch (error) {
            console.log("error=------createPrepackedOrder-------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    // Forwarder requests an extra charge on a booking (storage, oversize, …).
    // Creates the charge record and emails the customer a payment request that
    // links back to their History page, where the in-app Stripe flow pays it.
    addBookingAdditionalCost: async (req, res) => {
        try {
            const { bookingId, amount, description } = req.body;
            if (req.user.role !== '2') return helper.forbidden(res, "Only providers can add costs.");
            if (!bookingId) return helper.failure(res, "bookingId is required.");
            const amt = parseFloat(amount);
            if (!Number.isFinite(amt) || amt <= 0) return helper.failure(res, "A valid amount is required.");
            if (!description || !String(description).trim()) return helper.failure(res, "A description is required.");

            const booking = await db.bookings.findOne({ where: { id: bookingId } });
            if (!booking) return helper.failure(res, "Booking not found.");
            if (String(booking.driverId) !== String(req.user.id)) {
                return helper.forbidden(res, "You can only add costs to your own bookings.");
            }

            const cost = await db.booking_additional_costs.create({
                booking_id: booking.id,
                provider_id: req.user.id,
                user_id: booking.userId,
                amount: amt.toFixed(2),
                description: String(description).trim(),
                status: '0',
            });

            // Email the customer (best-effort — the charge still shows in History).
            try {
                const customer = await db.users.findByPk(booking.userId, { attributes: ['email', 'firstName'] });
                const business = await db.providerDetails.findOne({ where: { providerId: req.user.id }, attributes: ['businessName'] });
                if (customer?.email) {
                    await sendAdditionalCostRequestEmail(customer.email, {
                        customerName: customer.firstName || 'there',
                        businessName: business?.businessName || 'Your freight forwarder',
                        orderId: booking.orderId || `#${booking.id}`,
                        amount: amt.toFixed(2),
                        description: String(description).trim(),
                    });
                }
            } catch (mailErr) {
                console.error('Additional-cost email failed:', mailErr.message);
            }

            return helper.success(res, "Additional cost requested. The customer has been emailed.", { cost });
        } catch (error) {
            console.log("error=------addBookingAdditionalCost-------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    // Customer pays a requested additional cost — same Connect split as bookings.
    payAdditionalCostIntent: async (req, res) => {
        try {
            const { additionalCostId } = req.body;
            const cost = await db.booking_additional_costs.findOne({ where: { id: additionalCostId } });
            if (!cost) return helper.failure(res, "Charge not found.");
            if (String(cost.user_id) !== String(req.user.id)) return helper.forbidden(res, "Not your charge.");
            if (cost.status !== '0') return helper.failure(res, "This charge is not payable.");

            const booking = await db.bookings.findOne({ where: { id: cost.booking_id } });
            const provider = await db.users.findByPk(cost.provider_id);
            if (!provider) return helper.failure(res, "Provider not found.");

            const stripe = require('stripe')(env('STRIPE_SECRET_KEY'));
            const amountInCents = Math.round(parseFloat(cost.amount) * 100);
            const payload = {
                amount: amountInCents,
                currency: 'usd',
                metadata: { additionalCostId: String(cost.id), bookingRef: String(cost.booking_id) },
                automatic_payment_methods: { enabled: true },
            };

            // Split to the forwarder's connected account, same commission as the booking.
            if (String(provider.hashAccount || '0') === '1' && provider.accountId) {
                const commissionPercent = Number(booking?.adminCommission || 0) + Number(booking?.serviceFee || 0);
                const pct = Number.isFinite(commissionPercent) && commissionPercent >= 0 && commissionPercent <= 100 ? commissionPercent : 0;
                payload.application_fee_amount = Math.round((amountInCents * pct) / 100);
                payload.transfer_data = { destination: provider.accountId };
            }

            const paymentIntent = await stripe.paymentIntents.create(payload);
            return helper.success(res, "Payment intent created.", {
                clientSecret: paymentIntent.client_secret,
                publishkey: env('STRIPE_PUBLISHABLE_KEY'),
                amount: cost.amount,
            });
        } catch (error) {
            console.log("error=------payAdditionalCostIntent-------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    // Server-side verify + mark paid (mirrors confirmPrepackedPayment).
    confirmAdditionalCostPayment: async (req, res) => {
        try {
            const { paymentId } = req.body;
            if (!paymentId) return helper.failure(res, "paymentId is required.");
            const stripe = require('stripe')(env('STRIPE_SECRET_KEY'));
            let paymentIntent;
            try {
                paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
            } catch (e) {
                return helper.failure(res, "Payment verification failed.");
            }
            if (!paymentIntent || paymentIntent.status !== "succeeded") {
                return helper.failure(res, "Payment has not been completed.");
            }
            const costId = paymentIntent.metadata?.additionalCostId;
            if (!costId) return helper.failure(res, "Payment does not match an additional cost.");
            const cost = await db.booking_additional_costs.findOne({ where: { id: costId } });
            if (!cost) return helper.failure(res, "Charge not found.");
            const paid = (paymentIntent.amount_received || paymentIntent.amount) / 100;
            if (paid + 0.005 < parseFloat(cost.amount)) {
                return helper.failure(res, "Payment amount does not match the charge.");
            }
            await cost.update({ status: '1', transaction_id: paymentIntent.id });
            return helper.success(res, "Payment confirmed.", { cost });
        } catch (error) {
            console.log("error=------confirmAdditionalCostPayment-------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    // Buyer-driven payment confirmation. The webhook is the safety net, but it
    // only reaches the deployed URL — a stage workspace (or a webhook outage)
    // would leave paid orders marked Unpaid. Stripe is the authority here: we
    // retrieve the intent server-side and only trust its status + metadata.
    confirmPrepackedPayment: async (req, res) => {
        try {
            const { paymentId } = req.body;
            if (!paymentId) return helper.failure(res, "paymentId is required.");

            const stripe = require('stripe')(env('STRIPE_SECRET_KEY'));
            let paymentIntent;
            try {
                paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
            } catch (e) {
                return helper.failure(res, "Payment verification failed.");
            }
            if (!paymentIntent || paymentIntent.status !== "succeeded") {
                return helper.failure(res, "Payment has not been completed.");
            }
            const orderId = paymentIntent.metadata?.prepackedOrderId;
            if (!orderId) return helper.failure(res, "Payment does not match a pre-packed order.");

            const order = await db.prepacked_orders.findOne({ where: { id: orderId } });
            if (!order) return helper.failure(res, "Order not found.");

            // Authoritative amount from Stripe must cover the order total.
            const paid = (paymentIntent.amount_received || paymentIntent.amount) / 100;
            if (paid + 0.005 < parseFloat(order.total_price)) {
                return helper.failure(res, "Payment amount does not match the order.");
            }

            await order.update({ payment_status: 1 });
            return helper.success(res, "Payment confirmed.", { order });
        } catch (error) {
            console.log("error=------confirmPrepackedPayment-------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    // Logged-in buyer's pre-packed barrel orders — surfaced on the History page
    // alongside bookings so guest-checkout buyers can track what they ordered.
    getMyPrepackedOrders: async (req, res) => {
        try {
            const orders = await db.prepacked_orders.findAll({
                where: { userId: req.user.id },
                include: [{ model: db.prepacked_barrel, as: 'barrel', attributes: ['id', 'name', 'image'] }],
                order: [['createdAt', 'DESC']],
            });
            return helper.success(res, "Pre-packed orders fetched successfully.", { orders });
        } catch (error) {
            console.log("error=------getMyPrepackedOrders-------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    getFaq: async (req, res) => {
        try {
            const faqs = await db.faqs.findAll({
                order: [
                    ['id', 'ASC']
                ]
            });
            // console.log("faqs=----------------------->>>>>", faqs);
            return helper.success(res, "FAQs retrieved successfully.", faqs);
        } catch (error) {
            console.log("error=----------------------->>>>>", error);
            return helper.failure(res, error);
        }
    },
    getCmsContent: async (req, res) => {
        try {
            const { type } = req.query;
            if (![1, 2, 3, 4, 5, 6].includes(Number(type))) {
                return helper.failure(
                    res,
                    "Invalid type. Use 1 for Privacy Policy, 3 for Terms and Conditions, 2 for About us, 4 for Cookie Policy, 5 for Freight Content, 6 for Refund Policy."
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
                case 4:
                    message = "Cookie policy retrieved successfully.";
                    break;
                case 5:
                    message = "Website freight content retrieved successfully.";
                    break;
                case 6:
                    message = "Refund policy retrieved successfully.";
                    break;
            }

            return helper.success(res, message, cmsContent);
        } catch (error) {
            return helper.failure(res, error);
        }
    },
    contactUs: async (req, res) => {
        try {
            const { first_name, last_name, email, number, message, countryCode } = req.body;

            // Simple validation

            if (!first_name || !last_name || !email || !number || !message) {
                return helper.failure(res, "All fields are required.");
            }

            // Optional: validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return helper.failure(res, "Invalid email address.");
            }

            // Optional: validate phone number
            // Removed length check as it's handled by country-specific validation on frontend

            // Save to DB
            const contact = await db.contactus.create({
                name: first_name,
                last_name,
                email,
                city: req.body?.city,
                phoneNumber: number,
                countryCode: countryCode || "+1",
                message,
            });

            return helper.success(res, "Contacted successfully.", contact);
        } catch (error) {
            console.log("error=----------------------->>>>>", error);
            return helper.failure(res, "Something went wrong!");
        }
    },
    getCookies: async (req, res) => {
        try {
            const cookies = await db.cookies.findAll({
                where: { status: 1 },
                order: [['id', 'ASC']]
            });
            return helper.success(res, "Cookies retrieved successfully.", cookies);
        } catch (error) {
            console.log("error=------getCookies----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    saveUserCookies: async (req, res) => {
        try {
            const { userId, cookieIds } = req.body;
            if (!userId) {
                return helper.failure(res, "User ID is required.");
            }
            if (!cookieIds || !Array.isArray(cookieIds)) {
                return helper.failure(res, "Cookie IDs are required as an array.");
            }

            // delete existing consents for this user to avoid duplicates
            await db.user_cookies.destroy({ where: { userid: userId } });

            const userCookies = [];
            for (const cookieId of cookieIds) {
                const cookie = await db.cookies.findByPk(cookieId);
                const userCookie = await db.user_cookies.create({
                    userid: userId,
                    cookieid: cookieId,
                    text: cookie ? cookie.name : `Cookie ${cookieId}`
                });
                userCookies.push(userCookie);
            }

            return helper.success(res, "User cookies saved successfully.", userCookies);
        } catch (error) {
            console.log("error=------saveUserCookies----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    completeProfile12: async (req, res) => {
        try {
            const { Validator } = require('node-input-validator');
            console.log("completeProfile req.body:", JSON.stringify(req.body, null, 2));
            const v = new Validator(req.body, {
                providerId: 'required',
                email: 'email',
                phone: 'numeric',
                validFrom: 'date',
                validTo: 'date',
                basePrice: 'numeric',
                // pricePerUnit: 'numeric',
                // pricePerPound: 'numeric',
                flightsPerWeekTo: 'numeric',
                flightsPerWeekFrom: 'numeric',
                businessName: 'string',
                registerationNumber: 'string',
                countryOfRegistration: 'string',
                businessAddress: 'string',
                serviceType: 'string',
                description: 'string',
                primaryContactPersonFirstName: 'string',
                primaryContactPersonLastName: 'string',
                deliveryTimeline: 'string',
                // deliveryPolicy: 'string',
                shipmentType: 'string',
                originCountry: 'string',
                destinationCountry: 'string',
                sub_shipment_type: 'array',
                barrelOptions: 'object',
                profile_step: 'numeric',
            });

            const errorResponse = await helper.checkValidation(v);
            if (errorResponse) {
                return helper.failure(res, errorResponse);
            }

            const {
                providerId,
                registerationNumber,
                email,
                phone,
                companyEmail,
                businessName,
                countryOfRegistration,
                businessAddress,
                businessLongitude,
                businessLatitude,
                serviceType,
                description,
                primaryContactPersonFirstName,
                primaryContactPersonLastName,
                deliveryTimeline,
                // deliveryPolicy,
                pricePerPound,
                serviceCountries,
                freightType,
                flightsPerWeekTo,
                flightsPerWeekFrom,
                streetAddress,
                city,
                state,
                shipmentType,
                originCountry,
                destinationCountry,
                basePrice,
                // pricePerUnit,
                pricePerMile,
                customsAndHandling,
                validFrom,
                validTo,
                transitTime,
                shipmentContents,
                sub_shipment_type,
                barrelOptions,
                isFinalStep,
                profile_step,
                originLat,
                originLong,
                destinationLat,
                destinationLong,
            } = req.body;
            console.log("completeProfile req.body:", {
                businessAddress,
                businessLatitude,
                businessLongitude,
                providerId
            });

            // Unique Checks for Registration Number, Email, and Phone
            if (registerationNumber) {
                const existingReg = await db.providerDetails.findOne({
                    where: {
                        registerationNumber,
                        providerId: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingReg) {
                    return helper.failure(res, "Registration number already exists for another provider.");
                }
            }

            const checkEmail = companyEmail || email;
            if (checkEmail) {
                const existingEmail = await db.providerDetails.findOne({
                    where: {
                        email: checkEmail,
                        providerId: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingEmail) {
                    return helper.failure(res, "Business email already exists for another provider.");
                }

                const existingUserEmail = await db.users.findOne({
                    where: {
                        email: checkEmail,
                        id: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingUserEmail) {
                    return helper.failure(res, "Email already exists in user accounts.");
                }
            }

            if (phone) {
                const existingPhone = await db.providerDetails.findOne({
                    where: {
                        phone: phone,
                        providerId: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingPhone) {
                    return helper.failure(res, "Phone number already exists for another provider.");
                }

                const existingUserPhone = await db.users.findOne({
                    where: {
                        phoneNumber: phone,
                        id: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingUserPhone) {
                    return helper.failure(res, "Phone number already exists in user accounts.");
                }
            }
            // Robustness: if top-level fields are missing but barrelOptions has them, pull from there
            let finalBasePrice = basePrice;
            let finalTransitTime = transitTime;
            let finalShipmentContents = shipmentContents;
            let finalOriginCountry = originCountry;
            let finalDestinationCountry = destinationCountry;
            let finalOriginLat = originLat;
            let finalOriginLong = originLong;
            let finalDestinationLat = destinationLat;
            let finalDestinationLong = destinationLong;

            if (barrelOptions && (shipmentType === 'barrel' || !finalBasePrice)) {
                const bDetails = barrelOptions.ownBarrel || barrelOptions.dropOffBarrel;
                if (bDetails) {
                    if (!finalBasePrice) finalBasePrice = bDetails.basePrice;
                    if (!finalTransitTime) finalTransitTime = bDetails.transitTime;
                    if (!finalShipmentContents) finalShipmentContents = bDetails.shipmentContents;
                    if (!finalOriginCountry) finalOriginCountry = bDetails.originCountry;
                    if (!finalDestinationCountry) finalDestinationCountry = bDetails.destinationCountry;
                    if (!finalOriginLat) finalOriginLat = bDetails.originLat;
                    if (!finalOriginLong) finalOriginLong = bDetails.originLong;
                    if (!finalDestinationLat) finalDestinationLat = bDetails.destinationLat;
                    if (!finalDestinationLong) finalDestinationLong = bDetails.destinationLong;
                }
            }

            if (!providerId) {
                return helper.failure(res, "Provider ID is required.");
            }

            let details = await db.providerDetails.findOne({ where: { providerId: Number(providerId) } });

            const detailsData = {
                providerId,
                businessName,
                registerationNumber,
                countryOfRegistration,
                businessAddress,
                businessLongitude,
                businessLatitude,
                serviceType,
                streetAddress,
                city,
                state,
                zip: req.body.zip,
                description,
                email: companyEmail,
                phone,
                // Only rebuild the combined name when the request actually carries the
                // parts — doc-only submits used to overwrite it with "undefined undefined".
                primaryContactPerson: (primaryContactPersonFirstName || primaryContactPersonLastName)
                    ? `${primaryContactPersonFirstName || ""} ${primaryContactPersonLastName || ""}`.trim()
                    : undefined,
                primaryContactPersonFirstName,
                primaryContactPersonLastName,
                primaryContactEmail: req.body.primaryContactEmail,
                deliveryTimeline,
                // deliveryPolicy,
                // pricePerPound,
                pricePerMile,
                customsAndHandling,
                serviceCountries,
                freightType,
                flightsPerWeekTo,
                flightsPerWeekFrom,
                shipmentType,
                originCountry: finalOriginCountry,
                destinationCountry: finalDestinationCountry,
                validFrom,
                validTo,
                transitTime: finalTransitTime,
                shipmentContents: finalShipmentContents,
                isFinalStep,
                basePrice: finalBasePrice || "0",
                originLat: finalOriginLat,
                originLong: finalOriginLong,
                destinationLat: finalDestinationLat,
                destinationLong: finalDestinationLong,
            };

            if (req.files) {
                console.log("req.files keys:", Object.keys(req.files));
                if (req.files.image) {
                    const userImage = await helper.fileUpload(req.files.image);
                    await db.users.update({ image: userImage }, { where: { id: providerId } });
                }

                if (req.files.certificateOfIncorporation) {
                    detailsData.certificateOfIncorporation = await helper.fileUpload(req.files.certificateOfIncorporation);
                }

                const businessIdFile = req.files.ValidBusinessId || req.files.validBusinessId;
                if (businessIdFile) {
                    console.log("Uploading ValidBusinessId...");
                    detailsData.ValidBusinessId = await helper.fileUpload(businessIdFile);
                    console.log("Uploaded ValidBusinessId path:", detailsData.ValidBusinessId);
                }

                if (req.files.AddressProof) {
                    detailsData.AddressProof = await helper.fileUpload(req.files.AddressProof);
                }
                if (req.files.pricingDocument) {
                    detailsData.pricingDocument = await helper.fileUpload(req.files.pricingDocument);
                }
            }

            Object.keys(detailsData).forEach(key => detailsData[key] === undefined && delete detailsData[key]);

            const updateData = {};

            const isValid = (val) =>
                val !== undefined &&
                val !== null &&
                val !== '';

            if (isValid(req.body.working_as)) updateData.working_as = req.body.working_as;
            if (isValid(req.body.firstName)) updateData.firstName = req.body.firstName;
            if (isValid(req.body.lastName)) updateData.lastName = req.body.lastName;
            if (isValid(req.body.email)) updateData.email = req.body.email;
            if (isValid(req.body.phone)) updateData.phoneNumber = req.body.phone;
            if (isValid(req.body.countryCode)) updateData.countryCode = req.body.countryCode;
            if (isValid(businessAddress)) updateData.location = businessAddress;
            if (isValid(businessLatitude)) updateData.latitude = businessLatitude;
            if (isValid(businessLongitude)) updateData.longitude = businessLongitude;
            if (isValid(req.body.zip)) updateData.zip = req.body.zip;
            if (isValid(profile_step)) updateData.profile_step = profile_step;

            if (Object.keys(updateData).length > 0) {
                await db.users.update(updateData, {
                    where: { id: providerId }
                });
            }

            if (details) {
                await details.update(detailsData);
            } else {
                // console.log("detailsData=----------------------->>>>>", detailsData);
                // return
                details = await db.providerDetails.create(detailsData);
            }

            if (sub_shipment_type && Array.isArray(sub_shipment_type)) {
                await db.provider_shipment_item_types.destroy({
                    where: { provider_detail_id: details.id }
                });

                const subTypesToInsert = sub_shipment_type.map(type => ({
                    provider_detail_id: details.id,
                    item_type: type,
                    sub_type: type
                }));
                await db.provider_shipment_item_types.bulkCreate(subTypesToInsert);
            }

            if (barrelOptions && shipmentType === 'barrel') {
                if (barrelOptions.ownBarrel && sub_shipment_type.includes("Ship Your Own Barrel")) {
                    await db.barrelsprices.destroy({
                        where: {
                            providerId: providerId,
                            type: 'own'
                        }
                    });

                    const ownConfigs = Array.isArray(barrelOptions.ownBarrel) ? barrelOptions.ownBarrel : [barrelOptions.ownBarrel];
                    const ownEntries = ownConfigs.map(config => ({
                        providerId: providerId,
                        type: 'own',
                        barrelPrice: config.basePrice || '0',
                        barrelNumber: '1',
                        freeMiles: config.freeMiles || '0',
                        pricePerMile: config.pricePerMile || '0',
                        customsAndHandling: config.customsAndHandling || '0',
                        basePrice: config.basePrice || '0',
                        originCountry: config.originCountry || '',
                        destinationCountry: config.destinationCountry || '',
                        originLat: config.originLat || '0',
                        originLong: config.originLong || '0',
                        destinationLat: config.destinationLat || '0',
                        destinationLong: config.destinationLong || '0',
                        transitTime: config.transitTime || null,
                        shipmentContents: config.shipmentContents || null,
                        discount: '0',
                        isVolumeDiscount: config.isVolumeDiscount ? 1 : 0,
                        discountAfter: config.discountAfter || 0,
                        discountPercent: config.discountPercent || 0,
                    }));
                    await db.barrelsprices.bulkCreate(ownEntries);
                } else if (shipmentType === 'barrel' && !sub_shipment_type.includes("Ship Your Own Barrel")) {
                    await db.barrelsprices.destroy({
                        where: {
                            providerId: providerId,
                            type: 'own'
                        }
                    });
                }

                if (barrelOptions.dropOffBarrel && sub_shipment_type.includes("Request Barrel Drop-Off")) {
                    await db.barrelsprices.destroy({
                        where: {
                            providerId: providerId,
                            type: 'dropoff'
                        }
                    });

                    const dropOffConfigs = Array.isArray(barrelOptions.dropOffBarrel) ? barrelOptions.dropOffBarrel : [barrelOptions.dropOffBarrel];
                    const dropOffEntries = dropOffConfigs.map(config => ({
                        providerId: providerId,
                        type: 'dropoff',
                        barrelPrice: config.basePrice || '0',
                        barrelNumber: '1',
                        freeMiles: config.freeMiles || '0',
                        pricePerMile: config.pricePerMile || '0',
                        customsAndHandling: config.customsAndHandling || '0',
                        basePrice: config.basePrice || '0',
                        originCountry: config.originCountry || '',
                        destinationCountry: config.destinationCountry || '',
                        originLat: config.originLat || '0',
                        originLong: config.originLong || '0',
                        destinationLat: config.destinationLat || '0',
                        destinationLong: config.destinationLong || '0',
                        transitTime: config.transitTime || null,
                        shipmentContents: config.shipmentContents || null,
                        discount: '0',
                        isVolumeDiscount: config.isVolumeDiscount ? 1 : 0,
                        discountAfter: config.discountAfter || 0,
                        discountPercent: config.discountPercent || 0,
                    }));
                    await db.barrelsprices.bulkCreate(dropOffEntries);
                } else if (shipmentType === 'barrel' && !sub_shipment_type.includes("Request Barrel Drop-Off")) {
                    await db.barrelsprices.destroy({
                        where: {
                            providerId: providerId,
                            type: 'dropoff'
                        }
                    });
                }
            }

            if (serviceCountries && Array.isArray(serviceCountries) && serviceCountries.length) {
                const existingRoutes = await db.serviceAreaRoutes.findAll({
                    where: { providerId },
                    attributes: ['country']
                });

                const existingCountries = existingRoutes.map(route => route.country);
                const newCountries = serviceCountries.filter(country => country && country.trim());

                const countriesChanged =
                    existingCountries.length !== newCountries.length ||
                    !newCountries.every(country => existingCountries.includes(country));

                if (countriesChanged) {
                    await db.serviceAreaRoutes.destroy({ where: { providerId } });

                    const routeEntries = newCountries.map(country => ({
                        providerId,
                        country,
                        freightType: freightType === 'Sea' ? 2 : (freightType === 'Air' ? 1 : freightType),
                        flightsPerWeekTo,
                        flightsPerWeekFrom
                    }));

                    await db.serviceAreaRoutes.bulkCreate(routeEntries);
                } else if (freightType || flightsPerWeekTo || flightsPerWeekFrom) {
                    const updateData = {};
                    if (freightType) updateData.freightType = freightType === 'Sea' ? 2 : (freightType === 'Air' ? 1 : freightType);
                    if (flightsPerWeekTo) updateData.flightsPerWeekTo = flightsPerWeekTo;
                    if (flightsPerWeekFrom) updateData.flightsPerWeekFrom = flightsPerWeekFrom;

                    if (Object.keys(updateData).length > 0) {
                        await db.serviceAreaRoutes.update(updateData, { where: { providerId } });
                    }
                }
            } else if (serviceCountries) {
                await db.serviceAreaRoutes.destroy({ where: { providerId } });
                await db.serviceAreaRoutes.create({
                    providerId,
                    country: serviceCountries,
                    freightType: freightType === 'Sea' ? 2 : (freightType === 'Air' ? 1 : freightType),
                    flightsPerWeekTo,
                    flightsPerWeekFrom
                });
            }

            if (isFinalStep == true || isFinalStep == "true") {
                await db.users.update({ isProfileComplete: '1' }, { where: { id: providerId } });
            }

            const updatedUser = await db.users.findOne({
                where: { id: providerId },
                attributes: ['id', 'role', 'firstName', 'lastName', 'working_as', 'isProfileComplete', 'email', 'countryCode', 'phoneNumber', 'image', 'otp', 'otpVerify', 'status', 'loginTime', 'bio', 'location', 'latitude', 'longitude', 'isNotificationOn', 'deviceToken', 'deviceType', 'socketId', 'online', 'customerId', 'accountId', 'hashAccount', 'country', 'city', 'state', 'streetAddress', 'gender', 'documentVerify', 'adminCommission', 'profile_step', 'createdAt', 'updatedAt', 'deletedAt']
            });

            // Any submit carrying KYC files is "the document step" — the consolidated
            // flow posts them with profile_step 6, the legacy flow used 4.
            const isDocumentStep =
                req.files &&
                (req.files.certificateOfIncorporation ||
                    req.files.ValidBusinessId ||
                    req.files.validBusinessId ||
                    req.files.AddressProof);

            if (isDocumentStep && updatedUser && String(updatedUser.role) === "2") {
                try {
                    const phoneDisplay = [updatedUser.countryCode, updatedUser.phoneNumber]
                        .filter(Boolean)
                        .join(" ");
                    const providerInfo = details || (await db.providerDetails.findOne({
                        where: { providerId: Number(providerId) },
                    }));

                    await sendFreightForwarderRegistrationEmail({
                        legalName: providerInfo?.businessName || updatedUser.firstName,
                        doingBusinessAs: updatedUser.working_as,
                        email: updatedUser.email,
                        phone: phoneDisplay,
                        mainAddress: updatedUser.location,
                        streetAddress: updatedUser.streetAddress,
                        city: updatedUser.city,
                        state: updatedUser.state,
                        userId: updatedUser.id,
                        documentsSubmitted: true,
                        registrationNumber: providerInfo?.registerationNumber,
                        countryOfRegistration: providerInfo?.countryOfRegistration,
                    });
                } catch (mailError) {
                    console.error("Freight forwarder notification email failed:", mailError.message);
                }
            }

            return helper.success(res, "Profile updated successfully.", { user: updatedUser, details: details });

        } catch (error) {
            console.log("error=------completeProfile----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    completeProfile: async (req, res) => {
        try {
            const { Validator } = require('node-input-validator');
            console.log("completeProfile req.body:", JSON.stringify(req.body, null, 2));
            const v = new Validator(req.body, {
                providerId: 'required',
                email: 'email',
                phone: 'numeric',
                validFrom: 'date',
                validTo: 'date',
                basePrice: 'numeric',
                // pricePerUnit: 'numeric',
                // pricePerPound: 'numeric',
                flightsPerWeekTo: 'numeric',
                flightsPerWeekFrom: 'numeric',
                businessName: 'string',
                registerationNumber: 'string',
                countryOfRegistration: 'string',
                businessAddress: 'string',
                serviceType: 'string',
                description: 'string',
                primaryContactPersonFirstName: 'string',
                primaryContactPersonLastName: 'string',
                deliveryTimeline: 'string',
                // deliveryPolicy: 'string',
                shipmentType: 'string',
                originCountry: 'string',
                destinationCountry: 'string',
                sub_shipment_type: 'array',
                barrelOptions: 'object',
                profile_step: 'numeric',
            });

            const errorResponse = await helper.checkValidation(v);
            if (errorResponse) {
                return helper.failure(res, errorResponse);
            }

            const {
                providerId,
                registerationNumber,
                email,
                phone,
                companyEmail,
                businessName,
                countryOfRegistration,
                businessAddress,
                businessLongitude,
                businessLatitude,
                serviceType,
                description,
                primaryContactPersonFirstName,
                primaryContactPersonLastName,
                deliveryTimeline,
                // deliveryPolicy,
                pricePerPound,
                serviceCountries,
                freightType,
                flightsPerWeekTo,
                flightsPerWeekFrom,
                streetAddress,
                city,
                state,
                shipmentType,
                originCountry,
                destinationCountry,
                basePrice,
                // pricePerUnit,
                pricePerMile,
                customsAndHandling,
                validFrom,
                validTo,
                transitTime,
                shipmentContents,
                sub_shipment_type,
                barrelOptions,
                isFinalStep,
                profile_step,
                originLat,
                originLong,
                destinationLat,
                destinationLong,
                // New fields at top level
                flatPickupCharge,
                pickupFreeMiles,
                pickupPerMileCharge,
                flatDeliveryCharge,
                deliveryFreeMiles,
                deliveryPerMileCharge
            } = req.body;
            console.log("completeProfile req.body:", {
                businessAddress,
                businessLatitude,
                businessLongitude,
                providerId
            });

            // Unique Checks for Registration Number, Email, and Phone
            if (registerationNumber) {
                const existingReg = await db.providerDetails.findOne({
                    where: {
                        registerationNumber,
                        providerId: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingReg) {
                    return helper.failure(res, "Registration number already exists for another provider.");
                }
            }

            const checkEmail = companyEmail || email;
            if (checkEmail) {
                const existingEmail = await db.providerDetails.findOne({
                    where: {
                        email: checkEmail,
                        providerId: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingEmail) {
                    return helper.failure(res, "Business email already exists for another provider.");
                }

                const existingUserEmail = await db.users.findOne({
                    where: {
                        email: checkEmail,
                        id: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingUserEmail) {
                    return helper.failure(res, "Email already exists in user accounts.");
                }
            }

            if (phone) {
                const existingPhone = await db.providerDetails.findOne({
                    where: {
                        phone: phone,
                        providerId: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingPhone) {
                    return helper.failure(res, "Phone number already exists for another provider.");
                }

                const existingUserPhone = await db.users.findOne({
                    where: {
                        phoneNumber: phone,
                        id: { [db.Sequelize.Op.ne]: providerId }
                    }
                });
                if (existingUserPhone) {
                    return helper.failure(res, "Phone number already exists in user accounts.");
                }
            }
            // Robustness: if top-level fields are missing but barrelOptions has them, pull from there
            let finalBasePrice = basePrice;
            let finalTransitTime = transitTime;
            let finalShipmentContents = shipmentContents;
            let finalOriginCountry = originCountry;
            let finalDestinationCountry = destinationCountry;
            let finalOriginLat = originLat;
            let finalOriginLong = originLong;
            let finalDestinationLat = destinationLat;
            let finalDestinationLong = destinationLong;
            let finalFlatPickupCharge = flatPickupCharge;
            let finalPickupFreeMiles = pickupFreeMiles;
            let finalPickupPerMileCharge = pickupPerMileCharge;
            let finalFlatDeliveryCharge = flatDeliveryCharge;
            let finalDeliveryFreeMiles = deliveryFreeMiles;
            let finalDeliveryPerMileCharge = deliveryPerMileCharge;

            if (barrelOptions && (shipmentType === 'barrel' || !finalBasePrice)) {
                const bDetails = barrelOptions.ownBarrel || barrelOptions.dropOffBarrel;
                if (bDetails) {
                    // Handle single object or array
                    const getDetails = (item) => {
                        if (!finalBasePrice) finalBasePrice = item.basePrice;
                        if (!finalTransitTime) finalTransitTime = item.transitTime;
                        if (!finalShipmentContents) finalShipmentContents = item.shipmentContents;
                        if (!finalOriginCountry) finalOriginCountry = item.originCountry;
                        if (!finalDestinationCountry) finalDestinationCountry = item.destinationCountry;
                        if (!finalOriginLat) finalOriginLat = item.originLat;
                        if (!finalOriginLong) finalOriginLong = item.originLong;
                        if (!finalDestinationLat) finalDestinationLat = item.destinationLat;
                        if (!finalDestinationLong) finalDestinationLong = item.destinationLong;
                        if (!finalFlatPickupCharge) finalFlatPickupCharge = item.flatPickupCharge;
                        if (!finalPickupFreeMiles) finalPickupFreeMiles = item.pickupFreeMiles;
                        if (!finalPickupPerMileCharge) finalPickupPerMileCharge = item.pickupPerMileCharge;
                        if (!finalFlatDeliveryCharge) finalFlatDeliveryCharge = item.flatDeliveryCharge;
                        if (!finalDeliveryFreeMiles) finalDeliveryFreeMiles = item.deliveryFreeMiles;
                        if (!finalDeliveryPerMileCharge) finalDeliveryPerMileCharge = item.deliveryPerMileCharge;
                    };

                    if (Array.isArray(bDetails)) {
                        bDetails.forEach(getDetails);
                    } else {
                        getDetails(bDetails);
                    }
                }
            }

            if (!providerId) {
                return helper.failure(res, "Provider ID is required.");
            }

            let details = await db.providerDetails.findOne({ where: { providerId: Number(providerId) } });

            const detailsData = {
                providerId,
                businessName,
                registerationNumber,
                countryOfRegistration,
                businessAddress,
                businessLongitude,
                businessLatitude,
                serviceType,
                streetAddress,
                city,
                state,
                zip: req.body.zip,
                description,
                email: companyEmail,
                phone,
                // Only rebuild the combined name when the request actually carries the
                // parts — doc-only submits used to overwrite it with "undefined undefined".
                primaryContactPerson: (primaryContactPersonFirstName || primaryContactPersonLastName)
                    ? `${primaryContactPersonFirstName || ""} ${primaryContactPersonLastName || ""}`.trim()
                    : undefined,
                primaryContactPersonFirstName,
                primaryContactPersonLastName,
                primaryContactEmail: req.body.primaryContactEmail,
                deliveryTimeline,
                // deliveryPolicy,
                // pricePerPound,
                pricePerMile,
                customsAndHandling,
                serviceCountries,
                freightType,
                flightsPerWeekTo,
                flightsPerWeekFrom,
                shipmentType,
                originCountry: finalOriginCountry,
                destinationCountry: finalDestinationCountry,
                validFrom,
                validTo,
                transitTime: finalTransitTime,
                shipmentContents: finalShipmentContents,
                isFinalStep,
                basePrice: finalBasePrice || "0",
                originLat: finalOriginLat,
                originLong: finalOriginLong,
                destinationLat: finalDestinationLat,
                destinationLong: finalDestinationLong,
                // New fields at provider details level
                flatPickupCharge: finalFlatPickupCharge || "0",
                pickupFreeMiles: finalPickupFreeMiles || "0",
                pickupPerMileCharge: finalPickupPerMileCharge || "0",
                flatDeliveryCharge: finalFlatDeliveryCharge || "0",
                deliveryFreeMiles: finalDeliveryFreeMiles || "0",
                deliveryPerMileCharge: finalDeliveryPerMileCharge || "0"
            };

            if (req.files) {
                console.log("req.files keys:", Object.keys(req.files));
                if (req.files.image) {
                    const userImage = await helper.fileUpload(req.files.image);
                    await db.users.update({ image: userImage }, { where: { id: providerId } });
                }

                if (req.files.certificateOfIncorporation) {
                    detailsData.certificateOfIncorporation = await helper.fileUpload(req.files.certificateOfIncorporation);
                }

                const businessIdFile = req.files.ValidBusinessId || req.files.validBusinessId;
                if (businessIdFile) {
                    console.log("Uploading ValidBusinessId...");
                    detailsData.ValidBusinessId = await helper.fileUpload(businessIdFile);
                    console.log("Uploaded ValidBusinessId path:", detailsData.ValidBusinessId);
                }

                if (req.files.AddressProof) {
                    detailsData.AddressProof = await helper.fileUpload(req.files.AddressProof);
                }
                if (req.files.pricingDocument) {
                    detailsData.pricingDocument = await helper.fileUpload(req.files.pricingDocument);
                }
            }

            Object.keys(detailsData).forEach(key => detailsData[key] === undefined && delete detailsData[key]);

            const updateData = {};

            const isValid = (val) =>
                val !== undefined &&
                val !== null &&
                val !== '';

            if (isValid(req.body.working_as)) updateData.working_as = req.body.working_as;
            if (isValid(req.body.firstName)) updateData.firstName = req.body.firstName;
            if (isValid(req.body.lastName)) updateData.lastName = req.body.lastName;
            if (isValid(req.body.email)) updateData.email = req.body.email;
            if (isValid(req.body.phone)) updateData.phoneNumber = req.body.phone;
            if (isValid(req.body.countryCode)) updateData.countryCode = req.body.countryCode;
            if (isValid(businessAddress)) updateData.location = businessAddress;
            if (isValid(businessLatitude)) updateData.latitude = businessLatitude;
            if (isValid(businessLongitude)) updateData.longitude = businessLongitude;
            if (isValid(req.body.zip)) updateData.zip = req.body.zip;
            if (isValid(profile_step)) updateData.profile_step = profile_step;

            if (Object.keys(updateData).length > 0) {
                await db.users.update(updateData, {
                    where: { id: providerId }
                });
            }

            if (details) {
                await details.update(detailsData);
            } else {
                details = await db.providerDetails.create(detailsData);
            }

            if (sub_shipment_type && Array.isArray(sub_shipment_type)) {
                await db.provider_shipment_item_types.destroy({
                    where: { provider_detail_id: details.id }
                });

                const subTypesToInsert = sub_shipment_type.map(type => ({
                    provider_detail_id: details.id,
                    item_type: type,
                    sub_type: type
                }));
                await db.provider_shipment_item_types.bulkCreate(subTypesToInsert);
            }

            if (barrelOptions && shipmentType === 'barrel') {
                if (barrelOptions.ownBarrel && sub_shipment_type.includes("Ship Your Own Barrel")) {
                    await db.barrelsprices.destroy({
                        where: {
                            providerId: providerId,
                            type: 'own'
                        }
                    });

                    const ownConfigs = Array.isArray(barrelOptions.ownBarrel) ? barrelOptions.ownBarrel : [barrelOptions.ownBarrel];
                    const ownEntries = ownConfigs.map(config => ({
                        providerId: providerId,
                        type: 'own',
                        barrelPrice: config.basePrice || '0',
                        barrelNumber: '1',
                        freeMiles: config.freeMiles || '0',
                        pricePerMile: config.pricePerMile || '0',
                        customsAndHandling: config.customsAndHandling || '0',
                        basePrice: config.basePrice || '0',
                        originCountry: config.originCountry || '',
                        destinationCountry: config.destinationCountry || '',
                        originLat: config.originLat || '0',
                        originLong: config.originLong || '0',
                        destinationLat: config.destinationLat || '0',
                        destinationLong: config.destinationLong || '0',
                        transitTime: config.transitTime || null,
                        shipmentContents: config.shipmentContents || null,
                        discount: '0',
                        isVolumeDiscount: config.isVolumeDiscount ? 1 : 0,
                        discountAfter: config.discountAfter || 0,
                        discountPercent: config.discountPercent || 0,
                        // New fields for barrelsprices
                        flatPickupCharge: config.flatPickupCharge || '0',
                        pickupFreeMiles: config.pickupFreeMiles || '0',
                        pickupPerMileCharge: config.pickupPerMileCharge || '0',
                        flatDeliveryCharge: config.flatDeliveryCharge || '0',
                        deliveryFreeMiles: config.deliveryFreeMiles || '0',
                        deliveryPerMileCharge: config.deliveryPerMileCharge || '0',
                        // Simplified pricing model (v2)
                        pickupCharge: config.pickupCharge || '',
                        pickupRadius: config.pickupRadius || '',
                        extraMileageCost: config.extraMileageCost || '',
                        seaFreightPrice: config.seaFreightPrice || '',
                        discount5to9: config.discount5to9 || '',
                        discount10plus: config.discount10plus || '',
                        parishFees: typeof config.parishFees === 'object' && config.parishFees !== null
                            ? JSON.stringify(config.parishFees)
                            : (config.parishFees || null)
                    }));
                    await db.barrelsprices.bulkCreate(ownEntries);
                } else if (shipmentType === 'barrel' && !sub_shipment_type.includes("Ship Your Own Barrel")) {
                    await db.barrelsprices.destroy({
                        where: {
                            providerId: providerId,
                            type: 'own'
                        }
                    });
                }

                if (barrelOptions.dropOffBarrel && sub_shipment_type.includes("Request Barrel Drop-Off")) {
                    await db.barrelsprices.destroy({
                        where: {
                            providerId: providerId,
                            type: 'dropoff'
                        }
                    });

                    const dropOffConfigs = Array.isArray(barrelOptions.dropOffBarrel) ? barrelOptions.dropOffBarrel : [barrelOptions.dropOffBarrel];
                    const dropOffEntries = dropOffConfigs.map(config => ({
                        providerId: providerId,
                        type: 'dropoff',
                        barrelPrice: config.basePrice || '0',
                        barrelNumber: '1',
                        freeMiles: config.freeMiles || '0',
                        pricePerMile: config.pricePerMile || '0',
                        customsAndHandling: config.customsAndHandling || '0',
                        basePrice: config.basePrice || '0',
                        originCountry: config.originCountry || '',
                        destinationCountry: config.destinationCountry || '',
                        originLat: config.originLat || '0',
                        originLong: config.originLong || '0',
                        destinationLat: config.destinationLat || '0',
                        destinationLong: config.destinationLong || '0',
                        transitTime: config.transitTime || null,
                        shipmentContents: config.shipmentContents || null,
                        discount: '0',
                        isVolumeDiscount: config.isVolumeDiscount ? 1 : 0,
                        discountAfter: config.discountAfter || 0,
                        discountPercent: config.discountPercent || 0,
                        // New fields for barrelsprices
                        flatPickupCharge: config.flatPickupCharge || '0',
                        pickupFreeMiles: config.pickupFreeMiles || '0',
                        pickupPerMileCharge: config.pickupPerMileCharge || '0',
                        flatDeliveryCharge: config.flatDeliveryCharge || '0',
                        deliveryFreeMiles: config.deliveryFreeMiles || '0',
                        deliveryPerMileCharge: config.deliveryPerMileCharge || '0',
                        // Simplified pricing model (v2)
                        pickupCharge: config.pickupCharge || '',
                        pickupRadius: config.pickupRadius || '',
                        extraMileageCost: config.extraMileageCost || '',
                        seaFreightPrice: config.seaFreightPrice || '',
                        discount5to9: config.discount5to9 || '',
                        discount10plus: config.discount10plus || '',
                        parishFees: typeof config.parishFees === 'object' && config.parishFees !== null
                            ? JSON.stringify(config.parishFees)
                            : (config.parishFees || null)
                    }));
                    await db.barrelsprices.bulkCreate(dropOffEntries);
                } else if (shipmentType === 'barrel' && !sub_shipment_type.includes("Request Barrel Drop-Off")) {
                    await db.barrelsprices.destroy({
                        where: {
                            providerId: providerId,
                            type: 'dropoff'
                        }
                    });
                }
            }

            if (serviceCountries && Array.isArray(serviceCountries) && serviceCountries.length) {
                const existingRoutes = await db.serviceAreaRoutes.findAll({
                    where: { providerId },
                    attributes: ['country']
                });

                const existingCountries = existingRoutes.map(route => route.country);
                const newCountries = serviceCountries.filter(country => country && country.trim());

                const countriesChanged =
                    existingCountries.length !== newCountries.length ||
                    !newCountries.every(country => existingCountries.includes(country));

                if (countriesChanged) {
                    await db.serviceAreaRoutes.destroy({ where: { providerId } });

                    const routeEntries = newCountries.map(country => ({
                        providerId,
                        country,
                        freightType: freightType === 'Sea' ? 2 : (freightType === 'Air' ? 1 : freightType),
                        flightsPerWeekTo,
                        flightsPerWeekFrom
                    }));

                    await db.serviceAreaRoutes.bulkCreate(routeEntries);
                } else if (freightType || flightsPerWeekTo || flightsPerWeekFrom) {
                    const updateData = {};
                    if (freightType) updateData.freightType = freightType === 'Sea' ? 2 : (freightType === 'Air' ? 1 : freightType);
                    if (flightsPerWeekTo) updateData.flightsPerWeekTo = flightsPerWeekTo;
                    if (flightsPerWeekFrom) updateData.flightsPerWeekFrom = flightsPerWeekFrom;

                    if (Object.keys(updateData).length > 0) {
                        await db.serviceAreaRoutes.update(updateData, { where: { providerId } });
                    }
                }
            } else if (serviceCountries) {
                await db.serviceAreaRoutes.destroy({ where: { providerId } });
                await db.serviceAreaRoutes.create({
                    providerId,
                    country: serviceCountries,
                    freightType: freightType === 'Sea' ? 2 : (freightType === 'Air' ? 1 : freightType),
                    flightsPerWeekTo,
                    flightsPerWeekFrom
                });
            }

            if (isFinalStep == true || isFinalStep == "true") {
                await db.users.update({ isProfileComplete: '1' }, { where: { id: providerId } });
            }

            const updatedUser = await db.users.findOne({
                where: { id: providerId },
                attributes: ['id', 'role', 'firstName', 'lastName', 'working_as', 'isProfileComplete', 'email', 'countryCode', 'phoneNumber', 'image', 'otp', 'otpVerify', 'status', 'loginTime', 'bio', 'location', 'latitude', 'longitude', 'isNotificationOn', 'deviceToken', 'deviceType', 'socketId', 'online', 'customerId', 'accountId', 'hashAccount', 'country', 'city', 'state', 'streetAddress', 'gender', 'documentVerify', 'adminCommission', 'profile_step', 'createdAt', 'updatedAt', 'deletedAt']
            });

            // Any submit carrying KYC files is "the document step" — the consolidated
            // flow posts them with profile_step 6, the legacy flow used 4.
            const isDocumentStep =
                req.files &&
                (req.files.certificateOfIncorporation ||
                    req.files.ValidBusinessId ||
                    req.files.validBusinessId ||
                    req.files.AddressProof);

            if (isDocumentStep && updatedUser && String(updatedUser.role) === "2") {
                try {
                    const phoneDisplay = [updatedUser.countryCode, updatedUser.phoneNumber]
                        .filter(Boolean)
                        .join(" ");
                    const providerInfo = details || (await db.providerDetails.findOne({
                        where: { providerId: Number(providerId) },
                    }));

                    await sendFreightForwarderRegistrationEmail({
                        legalName: providerInfo?.businessName || updatedUser.firstName,
                        doingBusinessAs: updatedUser.working_as,
                        email: updatedUser.email,
                        phone: phoneDisplay,
                        mainAddress: updatedUser.location,
                        streetAddress: updatedUser.streetAddress,
                        city: updatedUser.city,
                        state: updatedUser.state,
                        userId: updatedUser.id,
                        documentsSubmitted: true,
                        registrationNumber: providerInfo?.registerationNumber,
                        countryOfRegistration: providerInfo?.countryOfRegistration,
                    });
                } catch (mailError) {
                    console.error("Freight forwarder notification email failed:", mailError.message);
                }
            }

            return helper.success(res, "Profile updated successfully.", { user: updatedUser, details: details });

        } catch (error) {
            console.log("error=------completeProfile----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    getProviderProfile12: async (req, res) => {
        try {
            const { id, providerId } = req.query;
            const targetId = id || providerId;

            if (!targetId) {
                return helper.failure(res, "Provider ID is required.");
            }

            const profile = await db.users.findOne({
                where: { id: targetId },
                attributes: ['id', 'role', 'firstName', 'working_as', 'lastName', 'email', 'countryCode', 'phoneNumber', 'image', 'location', 'latitude', 'longitude', 'bio', 'adminCommission'],
                include: [
                    {
                        model: db.providerDetails,
                        as: 'businessInfo',
                        include: [
                            {
                                model: db.provider_shipment_item_types,
                                as: 'shipmentItemTypes'
                            },
                            {
                                model: db.barrelsprices,
                                as: 'barrelPrices'
                            }
                        ]
                    },
                    {
                        model: db.serviceAreaRoutes,
                        as: 'serviceArea'
                    }
                ]
            });
            // console.log("profile", profile);
            // return
            if (!profile) {
                return helper.failure(res, "Profile not found.");
            }

            // Restructure barrelOptions if they exist
            if (profile.businessInfo && profile.businessInfo.barrelPrices) {
                const info = profile.businessInfo;
                const barrelOptions = {
                    ownBarrel: null,
                    dropOffBarrel: null
                };

                const ownPrices = info.barrelPrices.filter(p => p.type === 'own');
                const dropOffPrices = info.barrelPrices.filter(p => p.type === 'dropoff');

                const groupBarrelPrices = (prices, type) => {
                    const groups = {};
                    prices.forEach(p => {
                        const key = `${p.originCountry}-${p.destinationCountry}`;
                        if (!groups[key]) {
                            groups[key] = {
                                originCountry: p.originCountry || info.originCountry,
                                destinationCountry: p.destinationCountry || info.destinationCountry,
                                basePrice: p.basePrice || info.basePrice,
                                pricePerPound: info.pricePerPound,
                                pricePerMile: p.pricePerMile || info.pricePerMile,
                                customsAndHandling: p.customsAndHandling || info.customsAndHandling,
                                transitTime: p.transitTime || info.transitTime,
                                shipmentContents: p.shipmentContents || info.shipmentContents,
                                freeMiles: p.freeMiles,
                                originLat: p.originLat || info.originLat,
                                originLong: p.originLong || info.originLong,
                                destinationLat: p.destinationLat || info.destinationLat,
                                destinationLong: p.destinationLong || info.destinationLong,
                                isVolumeDiscount: p.isVolumeDiscount == 1,
                                discountAfter: parseInt(p.discountAfter) || 0,
                                discountPercent: parseInt(p.discountPercent) || 0,
                                barrelPrices: []
                            };
                        }
                        groups[key].barrelPrices.push({
                            quantity: parseInt(p.barrelNumber),
                            price: p.barrelPrice,
                            discount: p.discount
                        });
                    });
                    return Object.values(groups);
                };

                barrelOptions.ownBarrel = groupBarrelPrices(ownPrices, 'own');
                barrelOptions.dropOffBarrel = groupBarrelPrices(dropOffPrices, 'dropoff');

                profile.businessInfo.setDataValue('barrelOptions', barrelOptions);
            }

            return helper.success(res, "Profile fetched successfully.", profile);
        } catch (error) {
            console.log("error=------getProviderProfile----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    getProviderProfile: async (req, res) => {
        try {
            const { id, providerId } = req.query;
            const targetId = id || providerId;

            if (!targetId) {
                return helper.failure(res, "Provider ID is required.");
            }

            const profile = await db.users.findOne({
                where: { id: targetId },
                attributes: ['id', 'role', 'firstName', 'working_as', 'lastName', 'email', 'countryCode', 'phoneNumber', 'image', 'location', 'latitude', 'longitude', 'bio', 'adminCommission', 'streetAddress', 'city', 'state', 'hashAccount'],
                include: [
                    {
                        model: db.providerDetails,
                        as: 'businessInfo',
                        include: [
                            {
                                model: db.provider_shipment_item_types,
                                as: 'shipmentItemTypes'
                            },
                            {
                                model: db.barrelsprices,
                                as: 'barrelPrices'
                            }
                        ]
                    },
                    {
                        model: db.serviceAreaRoutes,
                        as: 'serviceArea'
                    }
                ]
            });

            if (!profile) {
                return helper.failure(res, "Profile not found.");
            }

            // Restructure barrelOptions if they exist
            if (profile.businessInfo && profile.businessInfo.barrelPrices) {
                const info = profile.businessInfo;
                const barrelOptions = {
                    ownBarrel: null,
                    dropOffBarrel: null
                };

                const ownPrices = info.barrelPrices.filter(p => p.type === 'own');
                const dropOffPrices = info.barrelPrices.filter(p => p.type === 'dropoff');

                const groupBarrelPrices = (prices, type) => {
                    const groups = {};
                    prices.forEach(p => {
                        const key = `${p.originCountry}-${p.destinationCountry}`;
                        if (!groups[key]) {
                            groups[key] = {
                                originCountry: p.originCountry || info.originCountry,
                                destinationCountry: p.destinationCountry || info.destinationCountry,
                                basePrice: p.basePrice || info.basePrice,
                                pricePerPound: info.pricePerPound,
                                pricePerMile: p.pricePerMile || info.pricePerMile,
                                customsAndHandling: p.customsAndHandling || info.customsAndHandling,
                                transitTime: p.transitTime || info.transitTime,
                                shipmentContents: p.shipmentContents || info.shipmentContents,
                                freeMiles: p.freeMiles,
                                originLat: p.originLat || info.originLat,
                                originLong: p.originLong || info.originLong,
                                destinationLat: p.destinationLat || info.destinationLat,
                                destinationLong: p.destinationLong || info.destinationLong,
                                isVolumeDiscount: p.isVolumeDiscount == 1,
                                discountAfter: parseInt(p.discountAfter) || 0,
                                discountPercent: parseInt(p.discountPercent) || 0,
                                // New pickup fields
                                flatPickupCharge: p.flatPickupCharge || info.flatPickupCharge || '0',
                                pickupFreeMiles: p.pickupFreeMiles || info.pickupFreeMiles || '0',
                                pickupPerMileCharge: p.pickupPerMileCharge || info.pickupPerMileCharge || '0',
                                // New delivery fields
                                flatDeliveryCharge: p.flatDeliveryCharge || info.flatDeliveryCharge || '0',
                                deliveryFreeMiles: p.deliveryFreeMiles || info.deliveryFreeMiles || '0',
                                deliveryPerMileCharge: p.deliveryPerMileCharge || info.deliveryPerMileCharge || '0',
                                // Simplified pricing model (v2)
                                pickupCharge: p.pickupCharge || '',
                                pickupRadius: p.pickupRadius || '',
                                extraMileageCost: p.extraMileageCost || '',
                                seaFreightPrice: p.seaFreightPrice || '',
                                discount5to9: p.discount5to9 || '',
                                discount10plus: p.discount10plus || '',
                                parishFees: (() => { try { return p.parishFees ? JSON.parse(p.parishFees) : null; } catch { return null; } })(),
                                barrelPrices: []
                            };
                        }
                        groups[key].barrelPrices.push({
                            quantity: parseInt(p.barrelNumber),
                            price: p.barrelPrice,
                            discount: p.discount
                        });
                    });
                    return Object.values(groups);
                };

                barrelOptions.ownBarrel = groupBarrelPrices(ownPrices, 'own');
                barrelOptions.dropOffBarrel = groupBarrelPrices(dropOffPrices, 'dropoff');

                profile.businessInfo.setDataValue('barrelOptions', barrelOptions);

                // Also add streetAddress, city, state from providerDetails to businessInfo
                if (info.streetAddress) profile.businessInfo.dataValues.streetAddress = info.streetAddress;
                if (info.city) profile.businessInfo.dataValues.city = info.city;
                if (info.state) profile.businessInfo.dataValues.state = info.state;
            }

            // If businessInfo exists but no barrelPrices, still add streetAddress, city, state
            if (profile.businessInfo) {
                if (!profile.businessInfo.dataValues.streetAddress) {
                    profile.businessInfo.dataValues.streetAddress = profile.businessInfo.streetAddress || '';
                }
                if (!profile.businessInfo.dataValues.city) {
                    profile.businessInfo.dataValues.city = profile.businessInfo.city || '';
                }
                if (!profile.businessInfo.dataValues.state) {
                    profile.businessInfo.dataValues.state = profile.businessInfo.state || '';
                }

                // Also add the new fields to businessInfo dataValues if they exist at provider level
                const info = profile.businessInfo;
                if (info.flatPickupCharge && !profile.businessInfo.dataValues.flatPickupCharge) {
                    profile.businessInfo.dataValues.flatPickupCharge = info.flatPickupCharge;
                }
                if (info.pickupFreeMiles && !profile.businessInfo.dataValues.pickupFreeMiles) {
                    profile.businessInfo.dataValues.pickupFreeMiles = info.pickupFreeMiles;
                }
                if (info.pickupPerMileCharge && !profile.businessInfo.dataValues.pickupPerMileCharge) {
                    profile.businessInfo.dataValues.pickupPerMileCharge = info.pickupPerMileCharge;
                }
                if (info.flatDeliveryCharge && !profile.businessInfo.dataValues.flatDeliveryCharge) {
                    profile.businessInfo.dataValues.flatDeliveryCharge = info.flatDeliveryCharge;
                }
                if (info.deliveryFreeMiles && !profile.businessInfo.dataValues.deliveryFreeMiles) {
                    profile.businessInfo.dataValues.deliveryFreeMiles = info.deliveryFreeMiles;
                }
                if (info.deliveryPerMileCharge && !profile.businessInfo.dataValues.deliveryPerMileCharge) {
                    profile.businessInfo.dataValues.deliveryPerMileCharge = info.deliveryPerMileCharge;
                }
            }

            return helper.success(res, "Profile fetched successfully.", profile);
        } catch (error) {
            console.log("error=------getProviderProfile----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    saveBookingRequest: async (req, res) => {
        try {
            console.log("req.body=----------------->>>>>", req.body);
            const userId = req.user.id;
            const {
                origin,
                origin_city,
                destination,
                pickup_date,
                delivery_date,
                items = [],
                origin_lat,
                origin_long,
                destination_lat,
                destination_long,
                drop_off_lat,
                drop_off_long,
                drop_off_address,
                parish
            } = req.body;

            /* ---------------- CHECK PROVIDER AVAILABILITY ---------------- */
            const cleanOrigin = origin || "";
            const cleanDestination = destination || "";

            let finalItems = items;
            if (!finalItems || finalItems.length === 0) {
                if (req.body.item_type) {
                    finalItems = [{
                        item_type: req.body.item_type,
                        sub_type: req.body.sub_type,
                        description: req.body.description,
                        quantity: req.body.quantity,
                        weight: req.body.weight,
                        dimensions: req.body.dimensions
                    }];
                }
            }

            if (!finalItems || finalItems.length === 0) {
                return helper.failure(res, "No items provided for booking");
            }

            const getCountry = (str) => {
                if (!str) return "";
                const parts = str.split(',');
                return parts[parts.length - 1].trim().toLowerCase();
            };

            const reqOriginCountry = getCountry(cleanOrigin);
            const reqDestCountry = getCountry(cleanDestination);
            const reqItemTypes = finalItems.map(i => (i.sub_type || i.item_type || "").toLowerCase());

            const providers = await db.providerDetails.findAll({
                // providerDetails is not paranoid and has no deletedAt column in Postgres,
                // so there is no soft-delete to filter on — query all providers.
                include: [
                    { model: db.provider_shipment_item_types, as: 'shipmentItemTypes' },
                    { model: db.barrelsprices, as: 'barrelPrices' }
                ]
            });

            const hasMatch = providers.some(p => {
                const isBarrelRequest = reqItemTypes.some(t => t.includes('barrel'));

                if (isBarrelRequest) {
                    return p.barrelPrices && p.barrelPrices.some(bp => {
                        const bpTypeNormalized = (bp.type || "").toLowerCase().trim();
                        const matchesType = reqItemTypes.some(t => {
                            if (t.includes('ship your own')) return bpTypeNormalized === 'own';
                            if (t.includes('drop-off') || t.includes('dropoff')) return bpTypeNormalized === 'dropoff';
                            return false;
                        });
                        const bpOrigin = (bp.originCountry || "").toLowerCase().trim();
                        const bpDest = (bp.destinationCountry || "").toLowerCase().trim();

                        return matchesType &&
                            (bpOrigin === reqOriginCountry || cleanOrigin.toLowerCase().includes(bpOrigin)) &&
                            (bpDest === reqDestCountry || cleanDestination.toLowerCase().includes(bpDest));
                    });
                } else {
                    return p.shipmentItemTypes && p.shipmentItemTypes.some(it =>
                        reqItemTypes.includes((it.item_type || "").toLowerCase())
                    );
                }
            });
            console.log("hasMatch=----------------->>>>>", hasMatch);
            // if (!hasMatch) {
            //     console.log("No providers found for your location or shipment type.");
            //     return helper.failure(res, "No providers found for your location or shipment type.", 404);
            // }
            /* ---------------- END CHECK ---------------- */

            const firstItem = finalItems[0];

            const bookingRequest = await db.booking_requests.create({
                userId,
                origin: cleanOrigin,
                origin_city: origin_city || "",
                destination: cleanDestination,
                quantity: firstItem.quantity || 0,
                weight: firstItem.weight || 0,
                description: firstItem.description || "",
                pickup_date: pickup_date || new Date(),
                delivery_date: delivery_date || new Date(),
                dimensions: firstItem.dimensions || "",
                origin_lat,
                origin_long,
                destination_lat,
                destination_long,
                drop_off_lat,
                drop_off_long,
                drop_off_address,
                parish: parish || '',
                dropoff_addon: req.body.dropoff_addon ? 1 : 0
            });

            if (bookingRequest) {
                const savedItems = [];
                for (const item of finalItems) {
                    const newItem = await db.booking_requests_items.create({
                        booking_request_id: bookingRequest.id,
                        item_type: item.item_type,
                        sub_type: item.sub_type,
                    });
                    savedItems.push(newItem);
                }
                bookingRequest.setDataValue('items', savedItems);
            }

            return helper.success(res, `Booking request saved successfully with ${finalItems.length} items.`, bookingRequest);

        } catch (error) {
            console.log("error=------saveBookingRequest----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    // saveBookingRequest: async (req, res) => {
    //     try {
    //         console.log("req.body=------saveBookingRequest----------------->>>>>", req.body);
    //         const userId = req.user.id;
    //         const {
    //             origin,
    //             origin_city,
    //             destination,
    //             pickup_date,
    //             delivery_date,
    //             items = [],
    //             origin_lat,
    //             origin_long,
    //             destination_lat,
    //             destination_long,
    //             drop_off_lat,
    //             drop_off_long,
    //             drop_off_address
    //         } = req.body;

    //         /* ---------------- CHECK PROVIDER AVAILABILITY ---------------- */
    //         const cleanOrigin = origin || "";
    //         const cleanDestination = destination || "";

    //         let finalItems = items;
    //         if (!finalItems || finalItems.length === 0) {
    //             if (req.body.item_type) {
    //                 finalItems = [{
    //                     item_type: req.body.item_type,
    //                     sub_type: req.body.sub_type,
    //                     description: req.body.description,
    //                     quantity: req.body.quantity,
    //                     weight: req.body.weight,
    //                     dimensions: req.body.dimensions
    //                 }];
    //             }
    //         }

    //         if (!finalItems || finalItems.length === 0) {
    //             return helper.failure(res, "No items provided for booking");
    //         }

    //         const getCountry = (str) => {
    //             if (!str) return "";
    //             const parts = str.split(',');
    //             return parts[parts.length - 1].trim().toLowerCase();
    //         };

    //         const reqOriginCountry = getCountry(cleanOrigin);
    //         const reqDestCountry = getCountry(cleanDestination);
    //         const reqItemTypes = finalItems.map(i => (i.sub_type || i.item_type || "").toLowerCase());

    //         const providers = await db.providerDetails.findAll({
    //             where: { deletedAt: null, documentVerify: 1 },
    //             include: [
    //                 { model: db.provider_shipment_item_types, as: 'shipmentItemTypes' },
    //                 { model: db.barrelsprices, as: 'barrelPrices' }
    //             ]
    //         });

    //         const hasMatch = providers.some(p => {
    //             const isBarrelRequest = reqItemTypes.some(t => t.includes('barrel'));

    //             if (isBarrelRequest) {
    //                 return p.barrelPrices && p.barrelPrices.some(bp => {
    //                     const bpTypeNormalized = (bp.type || "").toLowerCase().trim();
    //                     const matchesType = reqItemTypes.some(t => {
    //                         if (t.includes('ship your own')) return bpTypeNormalized === 'own';
    //                         if (t.includes('drop-off') || t.includes('dropoff')) return bpTypeNormalized === 'dropoff';
    //                         return false;
    //                     });
    //                     const bpOrigin = (bp.originCountry || "").toLowerCase().trim();
    //                     const bpDest = (bp.destinationCountry || "").toLowerCase().trim();

    //                     return matchesType &&
    //                         (bpOrigin === reqOriginCountry || cleanOrigin.toLowerCase().includes(bpOrigin)) &&
    //                         (bpDest === reqDestCountry || cleanDestination.toLowerCase().includes(bpDest));
    //                 });
    //             } else {
    //                 return p.shipmentItemTypes && p.shipmentItemTypes.some(it =>
    //                     reqItemTypes.includes((it.item_type || "").toLowerCase())
    //                 );
    //             }
    //         });
    //         console.log("hasMatch", hasMatch);
    //         if (!hasMatch) {
    //             return helper.failure(res, "No providers found for your location or shipment type.", 404);
    //         }
    //         /* ---------------- END CHECK ---------------- */

    //         const firstItem = finalItems[0];

    //         const bookingRequest = await db.booking_requests.create({
    //             userId,
    //             origin: cleanOrigin,
    //             origin_city: origin_city || "",
    //             destination: cleanDestination,
    //             quantity: firstItem.quantity || 0,
    //             weight: firstItem.weight || 0,
    //             description: firstItem.description || "",
    //             pickup_date: pickup_date || new Date(),
    //             delivery_date: delivery_date || new Date(),
    //             dimensions: firstItem.dimensions || "",
    //             origin_lat,
    //             origin_long,
    //             destination_lat,
    //             destination_long,
    //             drop_off_lat,
    //             drop_off_long,
    //             drop_off_address
    //         });

    //         if (bookingRequest) {
    //             const savedItems = [];
    //             for (const item of finalItems) {
    //                 const newItem = await db.booking_requests_items.create({
    //                     booking_request_id: bookingRequest.id,
    //                     item_type: item.item_type,
    //                     sub_type: item.sub_type,
    //                 });
    //                 savedItems.push(newItem);
    //             }
    //             bookingRequest.setDataValue('items', savedItems);
    //         }

    //         return helper.success(res, `Booking request saved successfully with ${finalItems.length} items.`, bookingRequest);

    //     } catch (error) {
    //         console.log("error=------saveBookingRequest----------------->>>>>", error);
    //         return helper.failure(res, error.message);
    //     }
    // },


    updateBookingRequest: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                account_type,
                name,
                email,
                phone,
                whatsapp,
                drop_off_address,
                drop_off_lat,
                drop_off_long,
                firstName,
                lastName,
                phone_country_code,
                whatsapp_country_code,
                suite_apt_building,
                streetAddress,  // Added
                city,           // Added
                state,          // Added
                parish,         // pricing v2: consignee destination parish
            } = req.body;

            const bookingRequest = await db.booking_requests.findOne({
                where: { id: id, userId: req.user.id },
                include: [{ model: db.booking_requests_items, as: 'items' }]
            });

            if (!bookingRequest) {
                return helper.failure(res, "Booking request not found.");
            }

            await bookingRequest.update({
                account_type,
                name,
                email,
                phone,
                whatsapp,
                drop_off_address,
                drop_off_lat,
                drop_off_long,
                firstName,
                lastName,
                phone_country_code,
                whatsapp_country_code,
                suite_apt_building,
                streetAddress,  // Added
                city,           // Added
                state,          // Added
                ...(parish !== undefined ? { parish } : {}),
            });

            /* ---------------- AUTO-MATCH PROVIDERS (20 MILES & CRITERIA) ---------------- */

            const getCountry = (str) => {
                if (!str) return "";
                const parts = str.split(',');
                return parts[parts.length - 1].trim().toLowerCase();
            };

            const reqOriginCountry = getCountry(bookingRequest.origin);
            const reqDestCountry = getCountry(bookingRequest.destination);
            const reqItemTypes = bookingRequest.items ? bookingRequest.items.map(i => (i.sub_type || i.item_type || "").toLowerCase()) : [];
            console.log("reqItemTypes", reqItemTypes);

            // Haversine Distance helper (miles)
            const calculateDistance = (lat1, lon1, lat2, lon2) => {
                if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
                const R = 3958.8;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            };

            const providers = await db.providerDetails.findAll({
                // providerDetails is not paranoid and has no deletedAt column in Postgres,
                // so there is no soft-delete to filter on — query all providers.
                include: [
                    { model: db.provider_shipment_item_types, as: 'shipmentItemTypes' },
                    { model: db.barrelsprices, as: 'barrelPrices' }
                ]
            });

            const matchedProviders = providers.filter(p => {
                // Determine if this is a barrel request
                const isBarrelRequest = reqItemTypes.some(t => t.toLowerCase().includes('barrel'));
                console.log("isBarrelRequest", isBarrelRequest);

                if (isBarrelRequest) {
                    console.log(`Checking barrel match for provider ${p.id}...`);
                    const hasBarrelMatch = p.barrelPrices && p.barrelPrices.some(bp => {
                        const bpTypeNormalized = (bp.type || "").toLowerCase().trim();
                        const matchesType = reqItemTypes.some(t => {
                            const sub = t.toLowerCase();
                            console.log(`Checking match for sub: "${sub}" against bpType: "${bpTypeNormalized}"`);
                            if (sub.includes('ship your own barrel') || sub.includes('own barrel'))
                                return bpTypeNormalized === 'own';
                            if (sub.includes('request barrel drop-off') || sub.includes('drop-off barrel') || sub.includes('dropoff'))
                                return bpTypeNormalized === 'dropoff';
                            return false;
                        });

                        const bpOrigin = (bp.originCountry || "").toLowerCase().trim();
                        const bpDest = (bp.destinationCountry || "").toLowerCase().trim();
                        const reqOriginAddress = (bookingRequest.origin || "").toLowerCase().trim();
                        const reqDestAddress = (bookingRequest.destination || "").toLowerCase().trim();

                        const originMatch = (bpOrigin == reqOriginAddress);
                        const destMatch = (bpDest == reqDestAddress);
                        console.log("bpOrigin", bpOrigin);
                        console.log("bpDest", bpDest);
                        console.log("reqOriginAddress", reqOriginAddress);
                        console.log("reqDestAddress", reqDestAddress);
                        console.log(`Provider ${p.id} Match Debug: bpType=${bp.type}, bpOrigin=${bpOrigin}, bpDest=${bpDest}, matchesType=${matchesType}, originMatch=${originMatch}, destMatch=${destMatch}`);
                        return matchesType && originMatch && destMatch;
                    });

                    console.log(`Provider ${p.id} final hasBarrelMatch:`, !!hasBarrelMatch);
                    if (!hasBarrelMatch) return false;
                } else {
                    // Fallback for non-barrel shipments
                    const pOriginStr = (p.originCountry || p.countryOfRegistration || "").toLowerCase();
                    const pDestStr = (p.destinationCountry || "").toLowerCase();
                    const countryMatch = pOriginStr.includes(reqOriginCountry.toLowerCase()) && pDestStr.includes(reqDestCountry.toLowerCase());
                    if (!countryMatch) return false;

                    const typeMatch = p.shipmentItemTypes && p.shipmentItemTypes.some(pst =>
                        reqItemTypes.some(t => {
                            const sub = (pst.sub_type || pst.item_type || "").toLowerCase();
                            const target = (t || "").toLowerCase();
                            return sub.includes(target) || target.includes(sub);
                        })
                    );
                    if (!typeMatch) return false;
                }

                // 3. Distance is intentionally NOT used for provider matching.
                // Pickup/delivery mileage pricing is computed client-side in
                // ShipmentDetailsSection using the Google Distance Matrix (real
                // driving miles) against each forwarder's per-mile config. This
                // server path filters by country/type only; `distance` stays 0
                // as a stable sort key. See calculateDistance() above if server
                // authoritative distance is ever needed.
                let distance = 0;
                p.setDataValue('distance', distance);

                return true;
            });

            return helper.success(res, "Booking request updated successfully.", {
                bookingRequest,
                matchedProviders
            });
        } catch (error) {
            console.log("error=------updateBookingRequest----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    getAvailableQuotes: async (req, res) => {
        try {
            const userId = req.user.id;
            console.log("Fetching quotes for User ID:", userId, "Query ID:", req.query.id);

            let latestRequest;

            if (req.query.id) {
                // If ID is provided, create a NEW booking request based on the existing one
                const originalRequest = await db.booking_requests.findOne({
                    where: { id: req.query.id },
                    include: [{ model: db.booking_requests_items, as: 'items' }]
                });

                if (!originalRequest) {
                    return helper.failure(res, "Original booking request not found.");
                }

                // Create new booking request
                const requestData = originalRequest.get({ plain: true });
                delete requestData.id;
                delete requestData.drop_off_address;
                delete requestData.name;
                delete requestData.email;
                delete requestData.phone;


                delete requestData.createdAt;
                delete requestData.updatedAt;

                // You might want to assign it to the current user if needed, 
                // but let's keep the original userId as per the "copy" logic unless specified.

                latestRequest = await db.booking_requests.create(requestData);
                console.log("New booking request created:", latestRequest.id);
                // Copy items

                if (originalRequest.items && originalRequest.items.length > 0) {
                    for (const item of originalRequest.items) {
                        const itemData = item.get({ plain: true });
                        delete itemData.id;
                        delete itemData.createdAt;
                        delete itemData.updatedAt;
                        itemData.booking_request_id = latestRequest.id;
                        itemData.sub_type = "Ship Your Own Barrel";

                        await db.booking_requests_items.create(itemData);
                        console.log("New booking item created:", itemData);

                    }
                }

                // Refetch to include items in the latestRequest object for the matching logic
                latestRequest = await db.booking_requests.findOne({
                    where: { id: latestRequest.id },
                    include: [{ model: db.booking_requests_items, as: 'items' }]
                });

            } else {
                // Fetch the latest booking request for the user
                latestRequest = await db.booking_requests.findOne({
                    where: { userId: userId },
                    include: [
                        {
                            model: db.booking_requests_items,
                            as: 'items'
                        }
                    ],
                    order: [['createdAt', 'DESC']]
                });
            }

            if (latestRequest) {
                console.log("Latest Request ID:", latestRequest.id);
                console.log("Items count:", latestRequest.items ? latestRequest.items.length : 0);
            } else {
                console.log("Latest Request is NULL despite simpleCheck result.");
            }

            if (!latestRequest) {
                console.log("No booking request found for user:", userId);
                return helper.failure(res, "No booking request found. Please create one first.");
            }

            // Extract matching criteria
            // Handle origin/destination - could be "Country" or "City, Country"
            const getCountry = (str) => {
                if (!str) return "";
                const parts = str.split(',');
                // If parts > 1, assume "City, Country" format, get last part
                // If parts == 1, assume "Country"
                return parts[parts.length - 1].trim().toLowerCase();
            };

            const requestedOriginCountry = getCountry(latestRequest.origin);
            const requestedDestinationCountry = getCountry(latestRequest.destination);

            // Map requested items to types (lowercase)
            const requestedItemTypes = latestRequest.items
                ? latestRequest.items.map(item => (item.sub_type || item.item_type || "").toLowerCase())
                : [];
            console.log("requestedItemTypes", requestedItemTypes);
            // Should also check latestRequest.quantity/item_type if items array is empty
            // (backward compatibility if data saved in main table only)?
            // But verifyBookingRequest saves to items table now.

            console.log("Criteria -> Origin:", requestedOriginCountry, "Dest:", requestedDestinationCountry, "Items:", requestedItemTypes);

            // Fetch all verified providers with their details and service areas
            // Accessing serviceAreaRoutes via the User model association
            const providers = await db.providerDetails.findAll({
                include: [
                    {
                        model: db.users,
                        as: 'provider',
                        where: { hashAccount: '1' },
                        attributes: ['id', 'firstName', 'image', 'email'],
                        include: [
                            {
                                model: db.serviceAreaRoutes,
                                as: 'serviceArea'
                            }
                        ]
                    },
                    {
                        model: db.barrelsprices,
                        as: 'barrelPrices',
                    },
                    {
                        model: db.provider_shipment_item_types,
                        as: 'shipmentItemTypes'
                    }
                ],
                where: {
                    documentVerify: 1
                }
            });
            console.log(`Found`, providers.length);
            if (providers.length > 0) {
                console.log("First provider sample barrelPrices:", providers[0].barrelPrices ? providers[0].barrelPrices.length : 0);
            }
            for (let provider of providers) {
                const providerUserId = provider.provider?.id;
                let averageRating = 0;
                let totalCompletedBookings = 0;

                if (providerUserId) {
                    const reviews = await db.reviewrating.findAll({
                        where: { ratedTo: providerUserId },
                    });

                    const totalReviews = reviews.length;
                    if (totalReviews > 0) {
                        const totalRating = reviews.reduce((sum, review) => {
                            return sum + (parseFloat(review.rating) || 0);
                        }, 0);
                        averageRating = totalRating / totalReviews;
                    }


                    const completedBookings = await db.bookings.count({
                        where: {
                            driverId: providerUserId,
                            status: '2'
                        }
                    });

                    totalCompletedBookings = completedBookings;

                    provider.setDataValue('averageRating', parseFloat(averageRating.toFixed(1)));
                    provider.setDataValue('totalCompletedBookings', totalCompletedBookings);
                } else {
                    provider.setDataValue('averageRating', 0);
                    provider.setDataValue('totalCompletedBookings', 0);
                }
            }

            const matchedProviders = providers.filter(providerDetail => {
                const providerUser = providerDetail.provider;
                if (!providerUser) return false;

                const isBarrelRequest = requestedItemTypes.some(t => t.toLowerCase().includes('barrel'));
                console.log("isBarrelRequest", isBarrelRequest);
                if (isBarrelRequest) {
                    console.log(`Checking barrel match for provider ${providerDetail.id} in Quotes...`, providerDetail);
                    const hasBarrelMatch = providerDetail.barrelPrices && providerDetail.barrelPrices.some(bp => {
                        console.log("bp", bp);
                        const bpTypeNormalized = (bp.type || "").toLowerCase().trim();
                        // Match sub_type strings like "Request Barrel Drop-Off" with internal codes like "dropoff"
                        console.log(requestedItemTypes, "===>", bpTypeNormalized);

                        const matchesType = requestedItemTypes.some(t => {
                            const sub = t.toLowerCase();
                            if (sub.includes('request barrel drop-off') || sub.includes('drop-off barrel') || sub.includes('dropoff'))
                                return bpTypeNormalized === 'dropoff';
                            console.log(sub, "========>");

                            if (sub.includes('ship your own barrel') || sub.includes('own barrel'))
                                return bpTypeNormalized === 'own';
                            return false;
                        });

                        console.log(matchesType, "====>hasBarrelMatch");


                        const bpOrigin = (bp.originCountry || "").toLowerCase().trim();
                        const bpDest = (bp.destinationCountry || "").toLowerCase().trim();
                        const reqOriginAddress = (latestRequest.origin || "").toLowerCase().trim();
                        const reqDestAddress = (latestRequest.destination || "").toLowerCase().trim();
                        console.log("bpOrigin", bpOrigin);
                        console.log("bpDest", bpDest);
                        console.log("reqOriginAddress", reqOriginAddress);
                        console.log("reqDestAddress", reqDestAddress);
                        console.log("requestedOriginCountry", requestedOriginCountry);
                        console.log("requestedDestinationCountry", requestedDestinationCountry);
                        // Case-insensitive exact string match for specific origin/destination
                        const originMatch = (bpOrigin === reqOriginAddress);
                        const destMatch = (bpDest === reqDestAddress);

                        console.log(`Provider ${providerDetail.id} Quotes Match Debug: type=${bp.type}, matchesType=${matchesType}, originMatch=${originMatch}, destMatch=${destMatch}`);
                        return matchesType && originMatch && destMatch;
                    });

                    console.log(`Mai Provider ${providerDetail.id} Quotes final hasBarrelMatch:`, !!hasBarrelMatch);
                    if (!hasBarrelMatch) return false;

                    // Override basePrice/pricePerMile for display if barrel match found
                    const matchingBarrel = providerDetail.barrelPrices?.find(bp => {
                        const bpTypeNormalized = (bp.type || "").toLowerCase().trim();
                        const isTypeMatch = requestedItemTypes.some(type => {
                            const sub = type.toLowerCase();
                            if (sub.includes('ship your own barrel') || sub.includes('own barrel')) return bpTypeNormalized === 'own';
                            if (sub.includes('request barrel drop-off') || sub.includes('drop-off barrel') || sub.includes('dropoff')) return bpTypeNormalized === 'dropoff';
                            return true;
                        });
                        const bpOrigin = (bp.originCountry || "").toLowerCase().trim();
                        const bpDest = (bp.destinationCountry || "").toLowerCase().trim();
                        const reqOrigin = (latestRequest.origin || "").toLowerCase().trim();
                        const reqDest = (latestRequest.destination || "").toLowerCase().trim();

                        const isOriginMatch = (bpOrigin === reqOrigin);
                        const isDestinationMatch = (bpDest === reqDest);
                        return isTypeMatch && isOriginMatch && isDestinationMatch;
                    });

                    if (matchingBarrel) {
                        providerDetail.setDataValue('basePrice', matchingBarrel.barrelPrice);
                        providerDetail.setDataValue('pricePerMile', matchingBarrel.pricePerMile);
                    }
                } else {
                    // General criteria for non-barrel
                    const providerOrigin = providerDetail.countryOfRegistration
                        ? providerDetail.countryOfRegistration.toLowerCase()
                        : "";

                    const providerOriginField = providerDetail.originCountry
                        ? providerDetail.originCountry.toLowerCase()
                        : "";

                    const originMatch =
                        (providerOrigin && providerOrigin.includes(requestedOriginCountry)) ||
                        (providerOriginField && providerOriginField.includes(requestedOriginCountry));

                    if (!originMatch) return false;

                    const legacyOrigin = providerDetail.originCountry
                        ? providerDetail.originCountry.toLowerCase()
                        : "";

                    const legacyDest = providerDetail.destinationCountry
                        ? providerDetail.destinationCountry.toLowerCase()
                        : "";

                    const legacyOriginMatch = legacyOrigin.includes(requestedOriginCountry);
                    const legacyDestMatch = legacyDest.includes(requestedDestinationCountry);

                    if (!legacyOriginMatch || !legacyDestMatch) return false;

                    if (providerDetail.shipmentType && requestedItemTypes.length > 0) {
                        const supportedTypes = providerDetail.shipmentType.toLowerCase();
                        const hasMainTypeMatch = requestedItemTypes.some(type =>
                            supportedTypes.includes(type)
                        );

                        if (!hasMainTypeMatch) return false;
                    }
                }

                /* ---------------- DATE RANGE MATCH (NEW) ---------------- */
                let pickupDate = latestRequest.pickup_date;
                let deliveryDate = latestRequest.delivery_date;
                console.log("Provider Validity:", {
                    pickupDate,
                    deliveryDate
                });

                if (pickupDate && deliveryDate) {
                    const validFrom = providerDetail.validFrom
                        ? new Date(providerDetail.validFrom)
                        : null;

                    const validTo = providerDetail.validTo
                        ? new Date(providerDetail.validTo)
                        : null;


                    // provider must be valid for FULL request duration (if dates are set)
                    const isBeforeEnd = !validTo || deliveryDate <= validTo;
                    const isAfterStart = !validFrom || pickupDate >= validFrom;

                    if (!isBeforeEnd || !isAfterStart) {
                        console.log(
                            `Provider ${providerDetail.id} failed date match`,
                            { pickupDate, deliveryDate, validFrom, validTo }
                        );
                        return false;
                    }
                }

                return true;
            });
            console.log("matchedProviders count:", matchedProviders.length);
            if (matchedProviders.length > 0) {
                console.log("First provider barrelPrices:", JSON.stringify(matchedProviders[0].barrelPrices, null, 2));
            }
            let adminUser = await db.users.findOne({
                where: {
                    role: "0"
                }
            });
            console.log("matchedProviders", matchedProviders);
            let adminCommission = adminUser ? adminUser.adminCommission : "0";

            // ── Survey-based sorting & Best Quote Matching ──────────────────
            const currentUser = await db.users.findOne({ where: { id: userId }, attributes: ['survey'] });
            const userSurveyStr = (currentUser?.survey || "").trim();
            const surveyIds = userSurveyStr.split(',').map(s => s.trim()).filter(Boolean);

            console.log("surveyIds selected:", surveyIds);

            // 1. Calculate metrics for all matched providers
            const providersWithMetrics = await Promise.all(matchedProviders.map(async (pd) => {
                const providerId = pd.provider?.id;
                const metrics = {
                    id: pd.id,
                    avgTime: 9999,
                    avgRating: parseFloat(pd.provider?.avg_rating) || 0,
                    price: parseFloat(pd.getDataValue('basePrice')) || 0
                };

                if (providerId && surveyIds.includes('1')) {
                    const result = await db.bookings.findOne({
                        where: { driverId: providerId, status: '2', avg_time: { [db.Sequelize.Op.ne]: null } },
                        attributes: [[db.Sequelize.fn('AVG', db.Sequelize.col('avg_time')), 'avgTime']],
                        raw: true
                    });
                    metrics.avgTime = parseFloat(result?.avgTime) || 9999;
                }

                return { pd, metrics };
            }));

            // 2. Identify "Best" in each selected category
            const bestInCategories = new Set();

            if (surveyIds.includes('1')) {
                // Fastest Delivery
                const fastest = [...providersWithMetrics].sort((a, b) => a.metrics.avgTime - b.metrics.avgTime)[0];
                if (fastest && fastest.metrics.avgTime < 9999) bestInCategories.add(fastest.pd.id);
            }
            if (surveyIds.includes('2')) {
                // Safest (Highest Rating)
                const safest = [...providersWithMetrics].sort((a, b) => b.metrics.avgRating - a.metrics.avgRating)[0];
                if (safest && safest.metrics.avgRating > 0) bestInCategories.add(safest.pd.id);
            }
            if (surveyIds.includes('3') || surveyIds.length === 0) {
                // Lowest Price (Default if none selected)
                const cheapest = [...providersWithMetrics].sort((a, b) => a.metrics.price - b.metrics.price)[0];
                if (cheapest) bestInCategories.add(cheapest.pd.id);
            }

            // 3. Mark providers and sort
            const finalProviders = providersWithMetrics.map(({ pd }) => {
                pd.setDataValue('isBestQuote', bestInCategories.has(pd.id));
                return pd;
            });

            // Primary sort: isBestQuote first. Secondary sort: by price.
            finalProviders.sort((a, b) => {
                if (a.getDataValue('isBestQuote') && !b.getDataValue('isBestQuote')) return -1;
                if (!a.getDataValue('isBestQuote') && b.getDataValue('isBestQuote')) return 1;
                return (parseFloat(a.getDataValue('basePrice')) || 0) - (parseFloat(b.getDataValue('basePrice')) || 0);
            });

            console.log("finalProviders count:", finalProviders.length);

            return helper.success(res, "Quotes fetched successfully.", {
                bookingRequest: latestRequest,
                providers: finalProviders,
                adminCommission,
                userSurvey: userSurveyStr
            });

        } catch (error) {
            console.log("error=------getAvailableQuotes----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    getAvailableQuotes12: async (req, res) => {
        try {
            const userId = req.user.id;
            console.log("Fetching quotes for User ID:", userId, "Query ID:", req.query.id);

            let latestRequest;

            if (req.query.id) {
                // If ID is provided, create a NEW booking request based on the existing one
                const originalRequest = await db.booking_requests.findOne({
                    where: { id: req.query.id },
                    include: [{ model: db.booking_requests_items, as: 'items' }]
                });

                if (!originalRequest) {
                    return helper.failure(res, "Original booking request not found.");
                }

                // Create new booking request
                const requestData = originalRequest.get({ plain: true });
                delete requestData.id;
                delete requestData.drop_off_address;
                delete requestData.name;
                delete requestData.email;
                delete requestData.phone;


                delete requestData.createdAt;
                delete requestData.updatedAt;

                // You might want to assign it to the current user if needed, 
                // but let's keep the original userId as per the "copy" logic unless specified.

                latestRequest = await db.booking_requests.create(requestData);
                console.log("New booking request created:", latestRequest.id);
                // Copy items

                if (originalRequest.items && originalRequest.items.length > 0) {
                    for (const item of originalRequest.items) {
                        const itemData = item.get({ plain: true });
                        delete itemData.id;
                        delete itemData.createdAt;
                        delete itemData.updatedAt;
                        itemData.booking_request_id = latestRequest.id;
                        itemData.sub_type = "Ship Your Own Barrel";

                        await db.booking_requests_items.create(itemData);
                        console.log("New booking item created:", itemData);

                    }
                }

                // Refetch to include items in the latestRequest object for the matching logic
                latestRequest = await db.booking_requests.findOne({
                    where: { id: latestRequest.id },
                    include: [{ model: db.booking_requests_items, as: 'items' }]
                });

            } else {
                // Fetch the latest booking request for the user
                latestRequest = await db.booking_requests.findOne({
                    where: { userId: userId },
                    include: [
                        {
                            model: db.booking_requests_items,
                            as: 'items'
                        }
                    ],
                    order: [['createdAt', 'DESC']]
                });
            }

            if (latestRequest) {
                console.log("Latest Request ID:", latestRequest.id);
                console.log("Items count:", latestRequest.items ? latestRequest.items.length : 0);
            } else {
                console.log("Latest Request is NULL despite simpleCheck result.");
            }

            if (!latestRequest) {
                console.log("No booking request found for user:", userId);
                return helper.failure(res, "No booking request found. Please create one first.");
            }

            // Extract matching criteria
            // Handle origin/destination - could be "Country" or "City, Country"
            const getCountry = (str) => {
                if (!str) return "";
                const parts = str.split(',');
                // If parts > 1, assume "City, Country" format, get last part
                // If parts == 1, assume "Country"
                return parts[parts.length - 1].trim().toLowerCase();
            };

            const requestedOriginCountry = getCountry(latestRequest.origin);
            const requestedDestinationCountry = getCountry(latestRequest.destination);

            // Map requested items to types (lowercase)
            const requestedItemTypes = latestRequest.items
                ? latestRequest.items.map(item => (item.sub_type || item.item_type || "").toLowerCase())
                : [];
            console.log("requestedItemTypes", requestedItemTypes);
            // Should also check latestRequest.quantity/item_type if items array is empty
            // (backward compatibility if data saved in main table only)?
            // But verifyBookingRequest saves to items table now.

            console.log("Criteria -> Origin:", requestedOriginCountry, "Dest:", requestedDestinationCountry, "Items:", requestedItemTypes);

            // ---------- HELPER: GET CITY NAME ----------
            const getCity = (str) => {
                if (!str) return "";
                const parts = str.split(',');
                return parts[0].trim().toLowerCase();
            };

            // ---------- HELPER: CHECK IF LOCATIONS ARE NEARBY ----------
            const isNearbyLocation = (userLocation, providerLocation) => {
                if (!userLocation || !providerLocation) return false;

                const userLower = userLocation.toLowerCase().trim();
                const providerLower = providerLocation.toLowerCase().trim();

                // 1. Exact match
                if (userLower === providerLower) return true;

                // 2. One contains the other
                if (userLower.includes(providerLower) || providerLower.includes(userLower)) return true;

                // 3. City match (ignore state/country)
                const userCity = getCity(userLocation);
                const providerCity = getCity(providerLocation);

                if (userCity === providerCity) return true;

                // 4. Nearby cities mapping
                const NEARBY_CITIES = {
                    "miami": ["fort lauderdale", "hollywood", "hialeah", "miami beach", "coral gables"],
                    "fort lauderdale": ["miami", "hollywood", "pompano beach", "davie", "plantation"],
                    "orlando": ["kissimmee", "sanford", "winter park", "altamonte springs", "oviedo"],
                    "pittsburgh": ["monroeville", "bethel park", "ross township", "mt lebanon", "cranberry"],
                    "jacksonville": ["st augustine", "orange park", "fernandina beach"],
                    "tampa": ["st petersburg", "clearwater", "brandon", "largo"]
                };

                if (NEARBY_CITIES[userCity] && NEARBY_CITIES[userCity].some(near => near === providerCity)) return true;
                if (NEARBY_CITIES[providerCity] && NEARBY_CITIES[providerCity].some(near => near === userCity)) return true;

                // 5. Same state/country
                const userState = userLower.split(',').slice(1).join(',').trim();
                const providerState = providerLower.split(',').slice(1).join(',').trim();

                if (userState && providerState && userState === providerState) return true;

                return false;
            };

            // Fetch all verified providers with their details and service areas
            // Accessing serviceAreaRoutes via the User model association
            const providers = await db.providerDetails.findAll({
                include: [
                    {
                        model: db.users,
                        as: 'provider',
                        where: { hashAccount: '1' },
                        attributes: ['id', 'firstName', 'image', 'email'],
                        include: [
                            {
                                model: db.serviceAreaRoutes,
                                as: 'serviceArea'
                            }
                        ]
                    },
                    {
                        model: db.barrelsprices,
                        as: 'barrelPrices',
                    },
                    {
                        model: db.provider_shipment_item_types,
                        as: 'shipmentItemTypes'
                    }
                ],
                where: {
                    documentVerify: 1
                }
            });
            console.log(`Found`, providers.length);
            if (providers.length > 0) {
                console.log("First provider sample barrelPrices:", providers[0].barrelPrices ? providers[0].barrelPrices.length : 0);
            }
            for (let provider of providers) {
                const providerUserId = provider.provider?.id;
                let averageRating = 0;
                let totalCompletedBookings = 0;

                if (providerUserId) {
                    const reviews = await db.reviewrating.findAll({
                        where: { ratedTo: providerUserId },
                    });

                    const totalReviews = reviews.length;
                    if (totalReviews > 0) {
                        const totalRating = reviews.reduce((sum, review) => {
                            return sum + (parseFloat(review.rating) || 0);
                        }, 0);
                        averageRating = totalRating / totalReviews;
                    }


                    const completedBookings = await db.bookings.count({
                        where: {
                            driverId: providerUserId,
                            status: '2'
                        }
                    });

                    totalCompletedBookings = completedBookings;

                    provider.setDataValue('averageRating', parseFloat(averageRating.toFixed(1)));
                    provider.setDataValue('totalCompletedBookings', totalCompletedBookings);
                } else {
                    provider.setDataValue('averageRating', 0);
                    provider.setDataValue('totalCompletedBookings', 0);
                }
            }

            // ---------- STEP 1: MATCH EXACT/Nearby LOCATION FIRST ----------
            const locationMatchedProviders = providers.filter(providerDetail => {
                const providerUser = providerDetail.provider;
                if (!providerUser) return false;

                const isBarrelRequest = requestedItemTypes.some(t => t.toLowerCase().includes('barrel'));
                console.log("isBarrelRequest", isBarrelRequest);

                if (isBarrelRequest) {
                    console.log(`Checking barrel match for provider ${providerDetail.id} in Quotes...`);

                    // Check if ANY barrel price matches location (nearby or exact)
                    const hasLocationMatch = providerDetail.barrelPrices && providerDetail.barrelPrices.some(bp => {
                        const originMatch = isNearbyLocation(latestRequest.origin, bp.originCountry);
                        const destMatch = isNearbyLocation(latestRequest.destination, bp.destinationCountry);

                        console.log(`Provider ${providerDetail.id} Location Check: originMatch=${originMatch}, destMatch=${destMatch}`);
                        return originMatch && destMatch;
                    });

                    console.log(`Provider ${providerDetail.id} hasLocationMatch:`, !!hasLocationMatch);
                    return hasLocationMatch;
                } else {
                    // Non-barrel logic - keep as is
                    const providerOrigin = providerDetail.countryOfRegistration
                        ? providerDetail.countryOfRegistration.toLowerCase()
                        : "";

                    const providerOriginField = providerDetail.originCountry
                        ? providerDetail.originCountry.toLowerCase()
                        : "";

                    const originMatch =
                        (providerOrigin && providerOrigin.includes(requestedOriginCountry)) ||
                        (providerOriginField && providerOriginField.includes(requestedOriginCountry));

                    if (!originMatch) return false;

                    const legacyOrigin = providerDetail.originCountry
                        ? providerDetail.originCountry.toLowerCase()
                        : "";

                    const legacyDest = providerDetail.destinationCountry
                        ? providerDetail.destinationCountry.toLowerCase()
                        : "";

                    const legacyOriginMatch = legacyOrigin.includes(requestedOriginCountry);
                    const legacyDestMatch = legacyDest.includes(requestedDestinationCountry);

                    if (!legacyOriginMatch || !legacyDestMatch) return false;

                    if (providerDetail.shipmentType && requestedItemTypes.length > 0) {
                        const supportedTypes = providerDetail.shipmentType.toLowerCase();
                        const hasMainTypeMatch = requestedItemTypes.some(type =>
                            supportedTypes.includes(type)
                        );

                        if (!hasMainTypeMatch) return false;
                    }
                    return true;
                }
            });

            console.log("locationMatchedProviders count:", locationMatchedProviders.length);

            // ---------- STEP 2: IF NO LOCATION MATCH, USE ALL PROVIDERS (FALLBACK) ----------
            let matchedProviders = locationMatchedProviders;

            if (locationMatchedProviders.length === 0) {
                console.log("No location match found. Falling back to all providers...");

                // Fallback: Match only by type (ignore location)
                matchedProviders = providers.filter(providerDetail => {
                    const providerUser = providerDetail.provider;
                    if (!providerUser) return false;

                    const isBarrelRequest = requestedItemTypes.some(t => t.toLowerCase().includes('barrel'));

                    if (isBarrelRequest) {
                        const hasTypeMatch = providerDetail.barrelPrices && providerDetail.barrelPrices.some(bp => {
                            const bpTypeNormalized = (bp.type || "").toLowerCase().trim();

                            const matchesType = requestedItemTypes.some(t => {
                                const sub = t.toLowerCase();
                                if (sub.includes('request barrel drop-off') || sub.includes('drop-off barrel') || sub.includes('dropoff'))
                                    return bpTypeNormalized === 'dropoff';
                                if (sub.includes('ship your own barrel') || sub.includes('own barrel'))
                                    return bpTypeNormalized === 'own';
                                return false;
                            });

                            return matchesType;
                        });

                        return hasTypeMatch;
                    } else {
                        // Non-barrel fallback
                        return true;
                    }
                });
            }

            console.log("final matchedProviders count:", matchedProviders.length);

            // ---------- STEP 3: GET BARREL PRICE FOR MATCHED PROVIDERS ----------
            const finalMatchedProviders = matchedProviders.filter(providerDetail => {
                const providerUser = providerDetail.provider;
                if (!providerUser) return false;

                const isBarrelRequest = requestedItemTypes.some(t => t.toLowerCase().includes('barrel'));

                if (isBarrelRequest) {
                    // Find matching barrel price (type match)
                    const matchingBarrel = providerDetail.barrelPrices?.find(bp => {
                        const bpTypeNormalized = (bp.type || "").toLowerCase().trim();
                        const isTypeMatch = requestedItemTypes.some(type => {
                            const sub = type.toLowerCase();
                            if (sub.includes('ship your own barrel') || sub.includes('own barrel')) return bpTypeNormalized === 'own';
                            if (sub.includes('request barrel drop-off') || sub.includes('drop-off barrel') || sub.includes('dropoff')) return bpTypeNormalized === 'dropoff';
                            return true;
                        });
                        return isTypeMatch;
                    });

                    if (matchingBarrel) {
                        providerDetail.setDataValue('basePrice', matchingBarrel.barrelPrice);
                        providerDetail.setDataValue('pricePerMile', matchingBarrel.pricePerMile);
                        console.log(`Set basePrice for provider ${providerDetail.id}: ${matchingBarrel.barrelPrice}`);
                        return true;
                    }
                    return false;
                } else {
                    return true;
                }
            });

            console.log("finalMatchedProviders count:", finalMatchedProviders.length);

            /* ---------------- DATE RANGE MATCH (NEW) ---------------- */
            const dateMatchedProviders = finalMatchedProviders.filter(providerDetail => {
                let pickupDate = latestRequest.pickup_date;
                let deliveryDate = latestRequest.delivery_date;
                console.log("Provider Validity:", {
                    pickupDate,
                    deliveryDate
                });

                if (pickupDate && deliveryDate) {
                    const validFrom = providerDetail.validFrom
                        ? new Date(providerDetail.validFrom)
                        : null;

                    const validTo = providerDetail.validTo
                        ? new Date(providerDetail.validTo)
                        : null;

                    const isBeforeEnd = !validTo || deliveryDate <= validTo;
                    const isAfterStart = !validFrom || pickupDate >= validFrom;

                    if (!isBeforeEnd || !isAfterStart) {
                        console.log(
                            `Provider ${providerDetail.id} failed date match`,
                            { pickupDate, deliveryDate, validFrom, validTo }
                        );
                        return false;
                    }
                }
                return true;
            });

            console.log("dateMatchedProviders count:", dateMatchedProviders.length);

            let adminUser = await db.users.findOne({
                where: {
                    role: "0"
                }
            });
            let adminCommission = adminUser ? adminUser.adminCommission : "0";

            // ── Survey-based sorting & Best Quote Matching ──────────────────
            const currentUser = await db.users.findOne({ where: { id: userId }, attributes: ['survey'] });
            const userSurveyStr = (currentUser?.survey || "").trim();
            const surveyIds = userSurveyStr.split(',').map(s => s.trim()).filter(Boolean);

            console.log("surveyIds selected:", surveyIds);

            // 1. Calculate metrics for all matched providers
            const providersWithMetrics = await Promise.all(dateMatchedProviders.map(async (pd) => {
                const providerId = pd.provider?.id;
                const metrics = {
                    id: pd.id,
                    avgTime: 9999,
                    avgRating: parseFloat(pd.provider?.avg_rating) || 0,
                    price: parseFloat(pd.getDataValue('basePrice')) || 0
                };

                if (providerId && surveyIds.includes('1')) {
                    const result = await db.bookings.findOne({
                        where: { driverId: providerId, status: '2', avg_time: { [db.Sequelize.Op.ne]: null } },
                        attributes: [[db.Sequelize.fn('AVG', db.Sequelize.col('avg_time')), 'avgTime']],
                        raw: true
                    });
                    metrics.avgTime = parseFloat(result?.avgTime) || 9999;
                }

                return { pd, metrics };
            }));

            // 2. Identify "Best" in each selected category
            const bestInCategories = new Set();

            if (surveyIds.includes('1')) {
                // Fastest Delivery
                const fastest = [...providersWithMetrics].sort((a, b) => a.metrics.avgTime - b.metrics.avgTime)[0];
                if (fastest && fastest.metrics.avgTime < 9999) bestInCategories.add(fastest.pd.id);
            }
            if (surveyIds.includes('2')) {
                // Safest (Highest Rating)
                const safest = [...providersWithMetrics].sort((a, b) => b.metrics.avgRating - a.metrics.avgRating)[0];
                if (safest && safest.metrics.avgRating > 0) bestInCategories.add(safest.pd.id);
            }
            if (surveyIds.includes('3') || surveyIds.length === 0) {
                // Lowest Price (Default if none selected)
                const cheapest = [...providersWithMetrics].sort((a, b) => a.metrics.price - b.metrics.price)[0];
                if (cheapest) bestInCategories.add(cheapest.pd.id);
            }

            // 3. Mark providers and sort
            const finalProviders = providersWithMetrics.map(({ pd }) => {
                pd.setDataValue('isBestQuote', bestInCategories.has(pd.id));
                return pd;
            });

            // Primary sort: isBestQuote first. Secondary sort: by price.
            finalProviders.sort((a, b) => {
                if (a.getDataValue('isBestQuote') && !b.getDataValue('isBestQuote')) return -1;
                if (!a.getDataValue('isBestQuote') && b.getDataValue('isBestQuote')) return 1;
                return (parseFloat(a.getDataValue('basePrice')) || 0) - (parseFloat(b.getDataValue('basePrice')) || 0);
            });

            console.log("finalProviders count:", finalProviders.length);

            if (finalProviders.length === 0) {
                return helper.failure(res, "No providers found for your location or shipment type. Please try again later.");
            }

            return helper.success(res, "Quotes fetched successfully.", {
                bookingRequest: latestRequest,
                providers: finalProviders,
                adminCommission,
                userSurvey: userSurveyStr
            });

        } catch (error) {
            console.log("error=------getAvailableQuotes----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    createBooking: async (req, res) => {
        try {
            const userId = req.user.id;

            const {
                booking_request_id,
                providerIds,
                pickupName,
                pickupContact,
                pickupEmail,
                pickupLocation,
                primary_email,
                dropName,
                dropContact,
                dropEmail,
                dropLocation,
                primary_name,
                primary_firstName,
                primary_lastName,
                primary_phone_number,
                primary_country_code,
                secondary_name,
                secondary_firstName,
                secondary_lastName,
                secondary_phone_number,
                secondary_country_code,
                secondary_email,
                secondary_streetAddress,
                secondary_city,
                secondary_state,
                addOns,
                primary_address,
                primary_streetAddress,
                primary_city,
                primary_state,
                primary_suite_apt_building,
                primary_full_address,
                secondary_address,
                secondary_suite_apt_building,
                secondary_full_address,
                shiper_name,
                shiper_firstName,
                shiper_lastName,
                shiper_phone_number,
                shiper_country_code,
                shiper_email,
                shiper_address,
                shiper_city,
                shiper_streetAddress,
                shiper_state,
                shiper_suite_apt_building,
                shiper_full_address,
                consignee_name,
                consignee_firstName,
                consignee_lastName,
                consignee_phone_number,
                consignee_country_code,
                consignee_email,
                consignee_address,
                consignee_suite_apt_building,
                consignee_full_address,
                consignee_lat,
                consignee_city,
                consignee_streetAddress,
                consignee_state,
                consignee_lng,
                shiper_lat,
                shiper_lng,
                primary_lat,
                primary_lng,
                secondary_lat,
                secondary_lng,
                barrel_type,
                pickup_date,
                delivery_date
            } = req.body;

            console.log("createBooking Payload:", req.body);

            /* ---------------- BASIC VALIDATION ---------------- */

            const { Validator } = require('node-input-validator');
            // const v = new Validator(req.body, {
            //     booking_request_id: 'required|integer',
            //     providerIds: 'required|array',
            //     primary_name: 'required|string',
            //     primary_phone_number: 'required|string',
            //     primary_email: 'required|email',
            //     secondary_email: 'email',
            //     primary_address: 'required|string',
            //     secondary_address: 'required|string',
            //     shiper_name: 'required|string',
            //     shiper_phone_number: 'required|string',
            //     shiper_email: 'required|email',
            //     shiper_address: 'required|string',
            //     consignee_name: 'required|string',
            //     consignee_phone_number: 'required|string',
            //     consignee_email: 'required|email',
            //     consignee_address: 'required|string'
            // });

            // const errorResponse = await helper.checkValidation(v);
            // if (errorResponse) {
            //     return helper.failure(res, errorResponse);
            // }

            /* ---------------- SANITIZER ---------------- */

            const clean = (val) => {
                if (typeof val !== 'string') return '';
                const v = val.trim().toLowerCase();
                if (!v || v === 'undefined' || v === 'null') return '';
                return v;
            };

            // Coerce values destined for numeric/DECIMAL columns. Barrel prices are
            // stored as strings and can be empty (""), which Postgres rejects with
            // "invalid input syntax for type numeric". Empty/non-numeric => fallback.
            const toDecimal = (val, fallback = null) => {
                if (val === null || val === undefined) return fallback;
                const s = String(val).trim();
                if (s === '' || isNaN(Number(s))) return fallback;
                return s;
            };

            /* ---------------- EMAIL VALIDATION ---------------- */

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            const emailFields = {
                primary_email,
                secondary_email,
                shiper_email,
                consignee_email
            };

            const seenEmails = {};

            for (const field in emailFields) {
                const email = clean(emailFields[field]);
                if (!email) continue;

                if (!emailRegex.test(email)) {
                    return helper.failure(res, `Invalid email format in ${field}`);
                }

                // if (seenEmails[email]) {
                //     return helper.failure(
                //         res,
                //         `Email in "${field}" matches with "${seenEmails[email]}"`
                //     );
                // }

                seenEmails[email] = field;
            }

            /* ---------------- PHONE VALIDATION ---------------- */

            const phoneRegex = /^[6-9]\d{9}$/;

            const phoneFields = {
                primary_phone_number,
                secondary_phone_number,
                shiper_phone_number,
                consignee_phone_number
            };

            const seenPhones = {};

            for (const field in phoneFields) {
                const raw = phoneFields[field];
                const phone = typeof raw === 'string' ? raw.trim() : '';

                if (!phone || phone === 'undefined' || phone === 'null') continue;

                // if (!phoneRegex.test(phone)) {
                //     return helper.failure(res, `Invalid phone number in ${field}`);
                // }

                // if (seenPhones[phone]) {
                //     return helper.failure(
                //         res,
                //         `Phone number in "${field}" matches with "${seenPhones[phone]}"`
                //     );
                // }

                seenPhones[phone] = field;
            }

            /* ---------------- CREATE BOOKINGS ---------------- */

            const createdBookings = [];

            // Fetch booking request to get origin/destination for barrel matching
            const bookingReq = await db.booking_requests.findOne({
                where: { id: booking_request_id },
                include: [{ model: db.booking_requests_items, as: 'items' }]
            });

            for (const providerId of providerIds) {
                const providerDetail = await db.providerDetails.findOne({
                    where: { providerId },
                });

                const adminUser = await db.users.findOne({
                    where: { role: '0' }
                });

                const adminCommission = adminUser ? adminUser.adminCommission : "0";

                /* ── Determine barrel type from frontend or from booking request items ── */
                let resolvedBarrelType = barrel_type || '';
                if (!resolvedBarrelType && bookingReq && bookingReq.items) {
                    const hasOwn = bookingReq.items.some(i => {
                        const sub = (i.sub_type || '').toLowerCase();
                        return sub.includes('ship your own barrel') || sub.includes('own barrel');
                    });
                    const hasDropoff = bookingReq.items.some(i => {
                        const sub = (i.sub_type || '').toLowerCase();
                        return sub.includes('request barrel drop-off') || sub.includes('drop-off barrel') || sub.includes('dropoff');
                    });
                    if (hasOwn) resolvedBarrelType = 'own';
                    else if (hasDropoff) resolvedBarrelType = 'dropoff';
                }

                /* ── Find matching barrel price from barrelsprices ── */
                const reqOrigin = (bookingReq?.origin || '').toLowerCase().trim();
                const reqDest = (bookingReq?.destination || '').toLowerCase().trim();

                const matchingBarrel = await db.barrelsprices.findOne({
                    where: {
                        providerId: providerId,
                        type: resolvedBarrelType || 'dropoff'
                    }
                });

                // Try to find a barrel that also matches origin/destination
                let bestBarrel = null;
                if (providerDetail) {
                    const allBarrels = await db.barrelsprices.findAll({
                        where: { providerId: providerId }
                    });

                    bestBarrel = allBarrels.find(bp => {
                        const bpType = (bp.type || '').toLowerCase().trim();
                        const bpOrigin = (bp.originCountry || '').toLowerCase().trim();
                        const bpDest = (bp.destinationCountry || '').toLowerCase().trim();
                        return bpType === (resolvedBarrelType || 'dropoff')
                            && bpOrigin === reqOrigin
                            && bpDest === reqDest;
                    });

                    // Fallback: match by type only
                    if (!bestBarrel) {
                        bestBarrel = allBarrels.find(bp => {
                            return (bp.type || '').toLowerCase().trim() === (resolvedBarrelType || 'dropoff');
                        });
                    }

                    // Fallback: first barrel
                    if (!bestBarrel && allBarrels.length > 0) {
                        bestBarrel = allBarrels[0];
                    }
                }

                const barrelBasePrice = bestBarrel ? bestBarrel.basePrice : (providerDetail ? providerDetail.basePrice : "0");
                const barrelIsVolumeDiscount = bestBarrel ? (bestBarrel.isVolumeDiscount || 0) : 0;
                const barrelDiscountAfter = bestBarrel ? (bestBarrel.discountAfter || 0) : 0;
                const barrelDiscountPercent = bestBarrel ? (bestBarrel.discountPercent || 0) : 0;
                const barrelFreeMiles = bestBarrel ? (bestBarrel.freeMiles || "0") : "0";
                const bookingPrice = bestBarrel ? bestBarrel.barrelPrice : (providerDetail ? providerDetail.basePrice : "0");

                // Check for existing booking for this request, provider and user
                let booking = await db.bookings.findOne({
                    where: {
                        booking_request_id: booking_request_id,
                        driverId: providerId,
                        userId: userId
                    }
                });

                const bookingData = {
                    booking_request_id,
                    userId,
                    driverId: providerId,
                    status: '0',
                    primary_name: primary_name || `${primary_firstName || ''} ${primary_lastName || ''}`.trim(),
                    primary_firstName,
                    primary_lastName,
                    primary_phone_number,
                    primary_country_code,
                    primary_email,
                    primary_address,
                    primary_streetAddress,
                    primary_city,
                    primary_state,
                    primary_suite_apt_building,
                    primary_full_address: primary_full_address || `${primary_address || ''} ${primary_suite_apt_building || ''}`.trim(),
                    primary_lat,
                    primary_lng,
                    secondary_name: secondary_name || `${secondary_firstName || ''} ${secondary_lastName || ''}`.trim(),
                    secondary_firstName,
                    secondary_lastName,
                    secondary_phone_number,
                    secondary_country_code,
                    secondary_email,
                    secondary_address,
                    secondary_streetAddress,
                    secondary_city,
                    secondary_state,
                    secondary_suite_apt_building,
                    secondary_full_address: secondary_full_address || `${secondary_address || ''} ${secondary_suite_apt_building || ''}`.trim(),
                    secondary_lat,
                    secondary_lng,
                    shiper_name: shiper_name || `${shiper_firstName || ''} ${shiper_lastName || ''}`.trim(),
                    shiper_firstName,
                    shiper_lastName,
                    shiper_phone_number,
                    shiper_country_code,
                    shiper_streetAddress,
                    shiper_email,
                    shiper_address,
                    shiper_city,
                    shiper_state,
                    shiper_suite_apt_building,
                    shiper_full_address: shiper_full_address || `${shiper_address || ''} ${shiper_suite_apt_building || ''}`.trim(),
                    shiper_lat,
                    shiper_lng,
                    consignee_name: consignee_name || `${consignee_firstName || ''} ${consignee_lastName || ''}`.trim(),
                    consignee_firstName,
                    consignee_lastName,
                    consignee_phone_number,
                    consignee_country_code,
                    consignee_email,
                    consignee_streetAddress,
                    consignee_address,
                    consignee_city,
                    consignee_state,
                    consignee_suite_apt_building,
                    consignee_full_address: consignee_full_address || `${consignee_address || ''} ${consignee_suite_apt_building || ''}`.trim(),
                    consignee_lat,
                    consignee_lng,
                    bookingPrice: toDecimal(bookingPrice, "0"),
                    base_price: toDecimal(barrelBasePrice, null),
                    isVolumeDiscount: barrelIsVolumeDiscount,
                    discountAfter: barrelDiscountAfter,
                    discountPercent: barrelDiscountPercent,
                    freeMiles: barrelFreeMiles,
                    adminCommission: toDecimal(adminCommission, "0"),
                    addOns: JSON.stringify(Array.isArray(addOns) ? addOns : []),
                    paymentMethod: '0',
                    bookingDate: new Date(),
                    pickup_date,
                    delivery_date
                };
                console.log("bookingData=----------------------->>>>>", bookingData);
                // return
                if (booking) {
                    await booking.update(bookingData);
                } else {
                    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    booking = await db.bookings.create({
                        ...bookingData,
                        orderId
                    });
                }

                createdBookings.push(booking);
            }

            // Acknowledge the placed order to the customer (best-effort — the
            // booking is saved regardless of email delivery). No dollar total is
            // shown here: at creation the authoritative amount isn't settled yet
            // (total_amount/pay_now_price are written at payment), so the email
            // confirms receipt and points to My History for the final figure.
            try {
                const buyer = await db.users.findByPk(userId, { attributes: ['email', 'firstName'] });
                const buyerEmail = buyer?.email || primary_email;
                if (buyerEmail && createdBookings.length) {
                    const orderNumbers = createdBookings.map((b) => b.orderId).filter(Boolean).join(', ');
                    await sendOrderConfirmationToCustomer(buyerEmail, {
                        customerName: buyer?.firstName || primary_firstName || 'there',
                        orderId: orderNumbers,
                        orderType: 'Shipment',
                        note: "We've received your shipment request. Complete payment (if you haven't yet) and see the full total and track everything under My History after signing in.",
                    });
                }
            } catch (mailErr) {
                console.error('Order confirmation email (booking) failed:', mailErr.message);
            }

            return helper.success(res, "Bookings created successfully.", createdBookings);

        } catch (error) {
            console.log("error=------createBooking----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    getNotifications: async (req, res) => {
        try {
            const userId = req.user.id;
            console.log("Fetching notifications for User:", userId);
            const notifications = await db.notifications.findAll({
                where: { reciever_id: userId },
                include: [
                    {
                        model: db.users,
                        as: 'sender',
                        attributes: ['id', 'firstName', 'lastName', 'image']
                    }
                ],
                order: [['createdAt', 'DESC']]
            });
            return helper.success(res, "Notifications fetched successfully.", notifications);
        } catch (error) {
            console.log("error=------getNotifications----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    clearNotifications: async (req, res) => {
        try {
            const userId = req.user.id;
            await db.notifications.destroy({
                where: { reciever_id: userId }
            });
            return helper.success(res, "Notifications cleared successfully.");
        } catch (error) {
            console.log("error=------clearNotifications----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    getBookings: async (req, res) => {
        try {
            const userId = req.user.id;
            const role = req.user.role; // "1" => User, "2" => Provider
            console.log("Fetching bookings for User:", userId, "Role:", role);

            let whereClause = {};
            if (role === "1") {
                whereClause.userId = userId;
                whereClause.payment_status = "1";
            } else if (role === "2") {
                whereClause.driverId = userId;
                whereClause.payment_status = "1";
            } else {
                return helper.failure(res, "Invalid role for fetching bookings.");
            }

            const bookings = await db.bookings.findAll({
                where: whereClause,
                include: [
                    {
                        model: db.booking_requests,
                        as: 'bookingRequest',
                        include: [{ model: db.booking_requests_items, as: 'items' }]
                    },
                    {
                        model: db.users,
                        as: 'userbook',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'image']
                    },
                    {
                        model: db.users,
                        as: 'driverbook',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'image'],
                        include: [
                            {
                                model: db.providerDetails,
                                as: 'businessInfo',
                                include: [{ model: db.barrelsprices, as: 'barrelPrices' }]
                            }
                        ]
                    },
                    {
                        model: db.booking_additional_costs,
                        as: 'additionalCosts',
                        required: false
                    }
                ],
                order: [['createdAt', 'DESC']]
            });

            let adminCommission = await db.users.findOne({
                where: { role: "0" },
                attributes: ['adminCommission']
            });
            const adminCommissionValue = adminCommission ? adminCommission.adminCommission : "0";

            return helper.success(res, "Bookings fetched successfully.", {
                bookings,
                adminCommission: adminCommissionValue
            });
        } catch (error) {
            console.log("error=------getBookings----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    getEarnings: async (req, res) => {
        try {
            const userId = req.user.id;
            const role = req.user.role;

            let whereClause = {};
            if (role == "1") {
                whereClause.user_id = userId;
            } else if (role == "2") {
                whereClause.reciever_id = userId;
            } else {
                return helper.failure(res, "Invalid role for fetching earnings.");
            }
            const transactions = await db.transactions.findAll({
                where: whereClause,
                include: [
                    {
                        model: db.bookings,
                        as: 'booking',
                        attributes: ['id', 'orderId', 'status', 'createdAt'],
                        include: [
                            {
                                model: db.booking_requests,
                                as: 'bookingRequest',
                                include: [{ model: db.booking_requests_items, as: 'items' }]
                            }
                        ]
                    },
                    {
                        model: db.users,
                        as: 'user',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'image']
                    }
                ],
                order: [['createdAt', 'DESC']]
            });

            return helper.success(res, "Earnings fetched successfully.", transactions);
        } catch (error) {
            console.log("error=------getEarnings----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    getBookingDetail: async (req, res) => {
        try {
            const { bookingId } = req.query;
            const userId = req.user.id;
            const role = req.user.role;

            if (!bookingId) {
                return helper.failure(res, "Booking ID is required.");
            }

            let whereClause = { id: bookingId };
            if (role === "1") {
                whereClause.userId = userId;
            } else if (role === "2") {
                whereClause.driverId = userId;
            }

            const booking = await db.bookings.findOne({
                where: whereClause,
                include: [
                    {
                        model: db.booking_requests,
                        as: 'bookingRequest',
                        include: [
                            {
                                model: db.booking_requests_items,
                                as: 'items',
                            }
                        ]
                    },
                    {
                        model: db.users,
                        as: 'userbook',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'image']
                    },
                    {
                        model: db.users,
                        as: 'driverbook',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'image'],
                        include: [
                            {
                                model: db.providerDetails,
                                as: 'businessInfo',
                                include: [
                                    {
                                        model: db.barrelsprices,
                                        as: 'barrelPrices',
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            if (!booking) {
                return helper.failure(res, "Booking not found.");
            }

            let adminCommission = await db.users.findOne({
                where: { role: "0" },
                attributes: ['adminCommission']
            });
            const adminCommissionValue = adminCommission ? adminCommission.adminCommission : "0";

            return helper.success(res, "Booking detail fetched successfully.", {
                booking,
                adminCommission: adminCommissionValue
            });

        } catch (error) {
            console.log("error=------getBookingDetail----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },


    updateBookingStatus12: async (req, res) => {
        try {
            const userId = req.user.id;
            const role = String(req.user.role); // Robust role check
            const { bookingId, status } = req.body;
            const statusStr = String(status);

            if (role !== "2") {
                return helper.failure(res, "Only providers can update booking status.");
            }

            if (!bookingId || !status) {
                return helper.failure(res, "Booking ID and status are required.");
            }

            const booking = await db.bookings.findOne({
                where: {
                    id: bookingId,
                    driverId: userId // Ensure provider owns this booking
                }
            });

            if (!booking) {
                return helper.failure(res, "Booking not found or access denied.");
            }

            booking.status = statusStr;
            console.log(`[updateBookingStatus] Booking ID: ${bookingId}, New Status: ${statusStr}, current start_time: ${booking.start_time}`);

            // ── Timing logic ──────────────────────────────────────────────
            if (statusStr === "3" || ((statusStr === "1" || statusStr === "2") && !booking.start_time)) {
                // If status is Dispatched (3), OR if start_time is missing when moving to Shipped (1) or Delivered (2)
                booking.start_time = new Date();
                console.log(`[updateBookingStatus] Recording start_time: ${booking.start_time}`);
            }

            if (statusStr === "2") {
                // Delivered: record end time and compute avg_time in hours
                booking.end_time = new Date();
                console.log(`[updateBookingStatus] Recording end_time: ${booking.end_time}`);

                if (booking.start_time) {
                    const startTimeDate = new Date(booking.start_time);
                    const diffMs = booking.end_time - startTimeDate;
                    // Ensure non-negative difference
                    const validDiffMs = Math.max(0, diffMs);
                    booking.avg_time = parseFloat((validDiffMs / (1000 * 60 * 60)).toFixed(2));
                    console.log(`[updateBookingStatus] Calculated avg_time: ${booking.avg_time} hrs`);
                } else {
                    console.log(`[updateBookingStatus] Warning: No start_time found for booking ${bookingId}`);
                }
            }
            // ──────────────────────────────────────────────────────────────

            await booking.save();

            // Notify Customer
            try {
                const customer = await db.users.findOne({ where: { id: booking.userId } });
                if (customer && customer.deviceToken) {
                    const notificationHelper = require("../../helper/notificationHelper");
                    const statusLabels = {
                        "0": "Pending",
                        "1": "Shipped",
                        "2": "Delivered",
                        "3": "Dispatched"
                    };
                    const statusLabel = statusLabels[status] || "Updated";
                    await notificationHelper.sendNotification(
                        customer.deviceToken,
                        "Booking Status Updated",
                        `Your booking #${booking.orderId} status has been updated to ${statusLabel}.`,
                        { bookingId: String(booking.id), type: "status_update" }
                    );
                }
            } catch (notiError) {
                console.error("Notification Error:", notiError);
            }

            return helper.success(res, "Booking status updated successfully.", booking);

        } catch (error) {
            console.log("error=------updateBookingStatus----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    updateBookingStatus: async (req, res) => {
        try {
            const userId = req.user.id;
            const role = String(req.user.role);
            const { bookingId, status } = req.body;
            const statusStr = String(status);

            if (role !== "2") {
                return helper.failure(res, "Only providers can update booking status.");
            }

            if (!bookingId || !status) {
                return helper.failure(res, "Booking ID and status are required.");
            }

            const booking = await db.bookings.findOne({
                where: {
                    id: bookingId,
                    driverId: userId
                }
            });

            if (!booking) {
                return helper.failure(res, "Booking not found or access denied.");
            }

            const provider = await db.users.findOne({
                where: { id: userId },
            });

            const providerName = provider?.businessName || `${provider?.firstName || ''} ${provider?.lastName || ''}`.trim() || 'Provider';

            const statusLabels = {
                "0": "Pending",
                "1": "Shipped",
                "2": "Delivered",
                "3": "Dispatched"
            };
            const statusLabel = statusLabels[statusStr] || "Updated";

            booking.status = statusStr;
            console.log(`[updateBookingStatus] Booking ID: ${bookingId}, New Status: ${statusStr}`);

            if (statusStr === "3" || ((statusStr === "1" || statusStr === "2") && !booking.start_time)) {
                booking.start_time = new Date();
                console.log(`[updateBookingStatus] Recording start_time: ${booking.start_time}`);
            }

            if (statusStr === "2") {
                booking.end_time = new Date();
                console.log(`[updateBookingStatus] Recording end_time: ${booking.end_time}`);

                if (booking.start_time) {
                    const startTimeDate = new Date(booking.start_time);
                    const diffMs = booking.end_time - startTimeDate;
                    const validDiffMs = Math.max(0, diffMs);
                    booking.avg_time = parseFloat((validDiffMs / (1000 * 60 * 60)).toFixed(2));
                    console.log(`[updateBookingStatus] Calculated avg_time: ${booking.avg_time} hrs`);
                }
            }

            await booking.save();

            (async () => {
                try {
                    const customer = await db.users.findOne({
                        where: { id: booking.userId },
                    });

                    if (customer && customer.email) {
                        const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer';

                        await sendBookingStatusUpdateEmailToUser(customer.email, {
                            customerName: customerName,
                            orderId: booking.orderId,
                            bookingId: booking.id,
                            status: statusStr,
                            statusLabel: statusLabel,
                            providerName: providerName,
                        });
                        console.log('✅ Status update email sent to customer in background');
                    }
                } catch (emailError) {
                    console.error('Background email error:', emailError);
                }
            })();

            (async () => {
                try {
                    const customer = await db.users.findOne({ where: { id: booking.userId } });
                    if (customer && customer.deviceToken) {
                        const notificationHelper = require("../../helper/notificationHelper");
                        await notificationHelper.sendNotification(
                            customer.deviceToken,
                            "Booking Status Updated",
                            `Your booking #${booking.orderId} status has been updated to ${statusLabel}.`,
                            { bookingId: String(booking.id), type: "status_update" }
                        );
                        console.log('✅ Push notification sent to customer in background');
                    }
                } catch (notiError) {
                    console.error("Background notification error:", notiError);
                }
            })();

            return helper.success(res, "Booking status updated successfully.", booking);

        } catch (error) {
            console.log("error=------updateBookingStatus----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    updateBookingPayment12: async (req, res) => {
        try {
            const { bookingId, serviceFee, subtotal, pay_now, pay_later, total, total_distance, delivery_fee } = req.body;

            if (!bookingId) {
                return helper.failure(res, "Booking ID is required.");
            }

            const booking = await db.bookings.findOne({ where: { id: bookingId } });

            if (!booking) {
                return helper.failure(res, "Booking not found.");
            }

            const paidTotal = total ?? pay_now;

            await booking.update({
                pay_now_price: paidTotal,
                pay_later_price: 0,
                total_amount: paidTotal,
                total_distance: total_distance,
                delivery_fee: delivery_fee,
                subtotal: subtotal,
                serviceFee: serviceFee,
                payment_status: "1",
                is_pay_later: 1,
                orderId: booking.orderId,
                trasaction_id: req.body.paymentId,
                barrel_discount: req.body.barrelDiscount,
            });

            // Create Transaction Record
            await db.transactions.create({
                booking_id: booking.id,
                transaction_id: req.body.paymentId,
                amount: paidTotal,
                user_id: booking.userId,
                reciever_id: booking.driverId,
                status: 1
            });

            // Sync payment_status to booking_requests table
            if (booking.booking_request_id) {
                await db.booking_requests.update(
                    { payment_status: 1 },
                    { where: { id: booking.booking_request_id } }
                );
            }

            if (booking.driverId) {
                const provider = await db.users.findByPk(booking.driverId, {
                    attributes: ['id', 'email', 'firstName', 'lastName'],
                });

                if (provider?.email) {
                    const bookingWithCustomer = await db.bookings.findOne({
                        where: { id: booking.id },
                        attributes: ['id', 'orderId', 'primary_name', 'primary_firstName', 'primary_lastName'],
                        include: [
                            {
                                model: db.users,
                                as: 'userbook',
                                attributes: ['firstName', 'lastName'],
                            },
                        ],
                    });

                    const customerName =
                        bookingWithCustomer?.primary_name?.trim() ||
                        `${bookingWithCustomer?.primary_firstName || bookingWithCustomer?.userbook?.firstName || ''} ${bookingWithCustomer?.primary_lastName || bookingWithCustomer?.userbook?.lastName || ''}`.trim() ||
                        'Customer';

                    sendNewOrderPlacedEmailToProvider(provider.email, {
                        providerName: `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
                        orderId: booking.orderId,
                        bookingId: booking.id,
                        customerName,
                        totalAmount: paidTotal,
                        payNow: paidTotal,
                    }).catch((err) =>
                        console.error('New order email to provider failed:', err)
                    );
                }
            }

            return helper.success(res, "Booking payment details updated successfully.", booking);

        } catch (error) {
            console.log("error=------updateBookingPayment----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    updateBookingPayment: async (req, res) => {
        try {
            const { bookingId, serviceFee, flat_pickup_charge, flat_delivery_charge, subtotal, pay_now, pay_later, total, total_distance, delivery_fee } = req.body;

            if (!bookingId) {
                return helper.failure(res, "Booking ID is required.");
            }

            const booking = await db.bookings.findOne({ where: { id: bookingId } });

            if (!booking) {
                return helper.failure(res, "Booking not found.");
            }

            // Ownership: only the booking's own user may confirm its payment (IDOR guard).
            if (booking.userId != null && String(booking.userId) !== String(req.user.id)) {
                return helper.forbidden(res, "You are not allowed to update this booking.");
            }

            // Verify the payment actually happened via Stripe rather than trusting the
            // client. Prevents marking a booking paid without paying, and amount tampering.
            const paymentId = req.body.paymentId;
            if (!paymentId) {
                return helper.failure(res, "paymentId is required.");
            }
            const stripe = require('stripe')(env('STRIPE_SECRET_KEY'));
            let paymentIntent;
            try {
                paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
            } catch (e) {
                return helper.failure(res, "Payment verification failed.");
            }
            if (!paymentIntent || paymentIntent.status !== "succeeded") {
                return helper.failure(res, "Payment has not been completed.");
            }
            if (String(paymentIntent.metadata?.bookingId || "") !== String(booking.id)) {
                return helper.failure(res, "Payment does not match this booking.");
            }

            // Authoritative amount comes from Stripe (in cents), not the request body.
            const paidTotal = Number(((paymentIntent.amount_received || paymentIntent.amount) / 100).toFixed(2));

            await booking.update({
                pay_now_price: paidTotal,
                pay_later_price: 0,
                total_amount: paidTotal,
                total_distance: total_distance,
                delivery_fee: delivery_fee,
                subtotal: subtotal,
                serviceFee: serviceFee,
                payment_status: "1",
                is_pay_later: 1,
                orderId: booking.orderId,
                trasaction_id: req.body.paymentId,
                barrel_discount: req.body.barrelDiscount,
                flat_pickup_charge: flat_pickup_charge,
                flat_delivery_charge: flat_delivery_charge

            });

            await db.transactions.create({
                booking_id: booking.id,
                transaction_id: req.body.paymentId,
                amount: paidTotal,
                user_id: booking.userId,
                reciever_id: booking.driverId,
                status: 1
            });

            if (booking.booking_request_id) {
                await db.booking_requests.update(
                    { payment_status: 1 },
                    { where: { id: booking.booking_request_id } }
                );
            }

            if (booking.driverId) {
                const provider = await db.users.findByPk(booking.driverId, {
                    attributes: ['id', 'email', 'firstName', 'lastName',],
                });

                if (provider?.email) {
                    const customerName = booking.primary_name ||
                        `${booking.primary_firstName || ''} ${booking.primary_lastName || ''}`.trim() ||
                        'Customer';

                    const providerName = provider.businessName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Provider';

                    await sendNewOrderPlacedEmailToProvider12(provider.email, {
                        providerName: providerName,
                        orderId: booking.orderId,
                        bookingId: booking.id,
                        customerName: customerName,
                        totalAmount: paidTotal,
                    }).catch((err) =>
                        console.error('New order email to provider failed:', err)
                    );
                }
            }

            return helper.success(res, "Booking payment details updated successfully.", booking);

        } catch (error) {
            console.log("error=------updateBookingPayment----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    updatePayLaterStatus: async (req, res) => {
        try {
            const { bookingId, paymentId } = req.body;

            if (!bookingId) {
                return helper.failure(res, "Booking ID is required.");
            }

            const booking = await db.bookings.findOne({ where: { id: bookingId } });

            if (!booking) {
                return helper.failure(res, "Booking not found.");
            }

            await booking.update({
                is_pay_later: 1,
                trasaction_id_later: paymentId // Optionally store the 2nd payment ID
            });

            // Create Transaction Record for Pay Later
            await db.transactions.create({
                booking_id: booking.id,
                transaction_id: paymentId,
                amount: booking.pay_later_price,
                user_id: booking.userId,
                reciever_id: booking.driverId,
                status: 1
            });

            return helper.success(res, "Pay Later status updated successfully.", booking);

        } catch (error) {
            console.log("error=------updatePayLaterStatus----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    subscribeNewsletter: async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return helper.failure(res, "Email is required.");
            }

            const existingSubscriber = await db.subscribers.findOne({ where: { email } });

            if (existingSubscriber) {
                return helper.failure(res, "This email is already subscribed.");
            }

            const subscriber = await db.subscribers.create({ email });

            // Send confirmation email (non-blocking)
            sendSubscriptionEmail(email).catch(err => console.error("Subscription email failed:", err));

            return helper.success(res, "Subscribed successfully!", subscriber);

        } catch (error) {
            console.log("error=------subscribeNewsletter----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    uploadBookingDocument: async (req, res) => {
        try {
            const userId = req.user.id;
            const role = req.user.role;
            const { bookingId } = req.body;

            if (role !== "1") {
                return helper.failure(res, "Only users can upload documents.");
            }

            if (!req.files || !req.files.document) {
                return helper.failure(res, "Document file is required.");
            }

            const booking = await db.bookings.findOne({
                where: {
                    id: bookingId,
                    userId: userId // Ensure user owns this booking
                }
            });

            if (!booking) {
                return helper.failure(res, "Booking not found or access denied.");
            }

            const documentPath = await helper.fileUpload(req.files.document);
            booking.document = documentPath;
            await booking.save();

            return helper.success(res, "Document uploaded successfully.", { document: documentPath });

        } catch (error) {
            console.log("error=------uploadBookingDocument----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },

    socialLogin: async (req, res) => {
        try {
            const { social_id, social_type, email, firstName, lastName, image, deviceToken, deviceType, role } = req.body;

            if (!social_id || !social_type) {
                return helper.failure(res, "Social ID and Social Type are required.");
            }

            // 1. Check if user with this social ID and type exists
            let user = await db.users.findOne({
                where: {
                    social_id: social_id,
                    social_type: social_type,
                    deletedAt: null
                }
            });

            if (user) {
                // Check if user is deactivated
                if (user.status === "0") {
                    return helper.failure(res, "your account deactived by admin");
                }
                // User exists, login them in
                const loginTime = helper.unixTimestamp() + Math.floor(Math.random() * 10000000);
                const authtoken = await jwt.sign({ id: user.id, loginTime: loginTime }, process.env.JWT_SECRET);

                // Update device token and login time if provided
                const updateData = { loginTime };
                if (deviceToken) {
                    updateData.deviceToken = deviceToken;
                    updateData.deviceType = deviceType || "";
                }
                await user.update(updateData);

                const userData = user.toJSON();
                delete userData.password;

                let pendingRequestId = null;
                let isQuotesRedirect = false;
                let isBookingComplete = false;
                if (user.role === "1") {
                    const latestRequest = await db.booking_requests.findOne({
                        where: { userId: user.id },
                        include: [{ model: db.booking_requests_items, as: 'items' }],
                        order: [['id', 'DESC']]
                    });

                    if (latestRequest) {
                        if (latestRequest.payment_status == 1) {
                            isBookingComplete = true;
                        } else {
                            const items = latestRequest.items || [];
                            const isShipOwn = items.some(item => (item.sub_type || "").includes("Ship Your Own Barrel"));
                            const isDropOff = items.some(item => (item.sub_type || "").includes("Request Barrel Drop-Off"));

                            if (isShipOwn) {
                                isQuotesRedirect = true;
                            } else if (isDropOff) {
                                pendingRequestId = latestRequest.id;
                            } else {
                                if (!latestRequest.drop_off_address) {
                                    isQuotesRedirect = true;
                                } else {
                                    pendingRequestId = latestRequest.id;
                                }
                            }
                        }
                    } else {
                        isBookingComplete = true;
                    }
                }

                return helper.success(res, "Login successful.", { user: userData, authtoken, pendingRequestId, isQuotesRedirect, isBookingComplete });
            }

            // 2. Check if user with this email exists but not linked to social
            if (email) {
                user = await db.users.findOne({
                    where: {
                        email: email,
                        deletedAt: null
                    }
                });

                if (user) {
                    // Check if user is deactivated
                    if (user.status === "0") {
                        return helper.failure(res, "your account deactived by admin");
                    }
                    // Link social account to existing user
                    user.social_id = social_id;
                    user.social_type = social_type;
                    if (image && !user.image) user.image = image;

                    const loginTime = helper.unixTimestamp() + Math.floor(Math.random() * 10000000);
                    user.loginTime = loginTime;
                    if (deviceToken) {
                        user.deviceToken = deviceToken;
                        user.deviceType = deviceType || "";
                    }

                    await user.save();

                    const authtoken = await jwt.sign({ id: user.id, loginTime: loginTime }, process.env.JWT_SECRET);
                    const userData = user.toJSON();
                    delete userData.password;

                    let pendingRequestId = null;
                    let isQuotesRedirect = false;
                    let isBookingComplete = false;
                    if (user.role === "1") {
                        const latestRequest = await db.booking_requests.findOne({
                            where: { userId: user.id },
                            include: [{ model: db.booking_requests_items, as: 'items' }],
                            order: [['id', 'DESC']]
                        });

                        if (latestRequest) {
                            if (latestRequest.payment_status == 1) {
                                isBookingComplete = true;
                            } else {
                                const items = latestRequest.items || [];
                                const isShipOwn = items.some(item => (item.sub_type || "").includes("Ship Your Own Barrel"));
                                const isDropOff = items.some(item => (item.sub_type || "").includes("Request Barrel Drop-Off"));

                                if (isShipOwn) {
                                    isQuotesRedirect = true;
                                } else if (isDropOff) {
                                    pendingRequestId = latestRequest.id;
                                } else {
                                    if (!latestRequest.drop_off_address) {
                                        isQuotesRedirect = true;
                                    } else {
                                        pendingRequestId = latestRequest.id;
                                    }
                                }
                            }
                        } else {
                            isBookingComplete = true;
                        }
                    }

                    return helper.success(res, "Social account linked and login successful.", { user: userData, authtoken, pendingRequestId, isQuotesRedirect, isBookingComplete });
                }
            }

            // 3. Create new user if not found
            const newUser = await db.users.create({
                role: role || "1", // Default to User role if not provided
                firstName: firstName || "Social",
                lastName: lastName || "User",
                email: email || "",
                image: image || "",
                social_id: social_id,
                social_type: social_type,
                otpVerify: "1", // Automatically verify social accounts
                status: "1",
                deviceToken: deviceToken || "",
                deviceType: deviceType || ""
            });

            const loginTime = helper.unixTimestamp() + Math.floor(Math.random() * 10000000);
            newUser.loginTime = loginTime;
            await newUser.save();

            const authtoken = await jwt.sign({ id: newUser.id, loginTime: loginTime }, process.env.JWT_SECRET);
            const userData = newUser.toJSON();
            delete userData.password;

            return helper.success(res, "Social account created and login successful.", { user: userData, authtoken });

        } catch (error) {
            console.log("error=------socialLogin----------------->>>>>", error);
            return helper.failure(res, error.message);
        }
    },
    updateDeviceToken: async (req, res) => {
        try {
            const { deviceToken, deviceType } = req.body;
            const userId = req.user.id;

            if (!deviceToken) {
                return helper.failure(res, "Device token is required.");
            }

            await db.users.update(
                { deviceToken, deviceType },
                { where: { id: userId } }
            );

            return helper.success(res, "Device token updated successfully.");
        } catch (error) {
            console.error("updateDeviceToken error:", error);
            return helper.failure(res, error.message);
        }
    },
    submitRating: async (req, res) => {
        try {
            const userId = req.user.id;
            const { bookingId, rating, review } = req.body;

            if (!bookingId || !rating) {
                return helper.failure(res, "Booking ID and rating are required.");
            }

            const ratingNum = parseFloat(rating);
            if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
                return helper.failure(res, "Rating must be between 1 and 5.");
            }

            // Verify booking belongs to user and is delivered (status=2)
            const booking = await db.bookings.findOne({
                where: { id: bookingId, userId, status: "2" }
            });
            if (!booking) {
                return helper.failure(res, "Booking not found or not eligible for rating.");
            }

            if (!booking.driverId) {
                return helper.failure(res, "No provider assigned to this booking.");
            }

            // Check for duplicate rating
            const existingRating = await db.reviewrating.findOne({
                where: { bookingId, ratedBy: userId }
            });
            if (existingRating) {
                return helper.failure(res, "You have already rated this booking.");
            }

            // Create rating
            await db.reviewrating.create({
                ratedBy: userId,
                ratedTo: booking.driverId,
                bookingId,
                rating: ratingNum.toString(),
                review: review || ""
            });

            // Recalculate provider avg_rating
            const allRatings = await db.reviewrating.findAll({
                where: { ratedTo: booking.driverId },
                attributes: ['rating']
            });
            const totalRating = allRatings.reduce((sum, r) => sum + parseFloat(r.rating || 0), 0);
            const avgRating = allRatings.length > 0 ? (totalRating / allRatings.length).toFixed(2) : 0;

            await db.users.update(
                { avg_rating: avgRating },
                { where: { id: booking.driverId } }
            );

            return helper.success(res, "Rating submitted successfully.", { avg_rating: avgRating });
        } catch (error) {
            console.error("submitRating error:", error);
            return helper.failure(res, error.message);
        }
    },
    checkRatingStatus: async (req, res) => {
        try {
            const userId = req.user.id;
            const { bookingId } = req.query;

            if (!bookingId) {
                return helper.failure(res, "Booking ID is required.");
            }

            const existing = await db.reviewrating.findOne({
                where: { bookingId, ratedBy: userId }
            });

            return helper.success(res, "Rating status fetched.", { hasRated: !!existing });
        } catch (error) {
            console.error("checkRatingStatus error:", error);
            return helper.failure(res, error.message);
        }
    },

    getUserCookies: async (req, res) => {
        try {
            const userId = req.user.id;
            const cookies = await db.user_cookies.findAll({
                where: { userid: userId },
                include: [{
                    model: db.users,
                    as: 'cookieDetail'
                }]
            });
            return helper.success(res, "User cookies fetched", cookies);
        } catch (error) {
            return helper.failure(res, error.message);
        }
    },

    getAddons: async (req, res) => {
        try {
            const addons = await db.addons.findAll({
                where: { status: 1 }
            });
            return helper.success(res, "Add-ons fetched successfully.", addons);
        } catch (error) {
            console.error("getAddons error:", error);
            return helper.failure(res, error.message);
        }
    },

    getForwarders: async (req, res) => {
        try {
            const forwarders = await db.users.findAll({
                where: { role: '2', status: '1' },
                attributes: [
                    'id', 'firstName', 'lastName', 'image', 'avg_rating',
                    [
                        db.Sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM reviewrating AS reviews
                            WHERE
                                reviews."ratedTo" = users.id
                                AND reviews."deletedAt" IS NULL
                        )`),
                        'review_count'
                    ]
                ],
                include: [
                    {
                        model: db.providerDetails,
                        as: 'businessInfo',
                        attributes: ['businessName', 'basePrice', 'originCountry', 'destinationCountry', 'transitTime', 'shipmentType'],
                        where: { documentVerify: 1 },
                        required: true,
                        include: [
                            {
                                model: db.barrelsprices,
                                as: 'barrelPrices',
                                required: true,

                            }
                        ]
                    },

                ],
                order: [['avg_rating', 'DESC']]
            });
            return helper.success(res, "Forwarders fetched successfully.", forwarders);
        } catch (error) {
            console.error("getForwarders error:", error);
            return helper.failure(res, error.message);
        }
    },
    ratinglist: async (req, res) => {
        try {
            const ratings = await db.reviewrating.findAll({
                include: [
                    {
                        model: db.users,
                        as: 'ratedby',
                        required: true,
                    },
                    {
                        model: db.users,
                        as: 'ratedto',
                        required: true,
                        include: [
                            {
                                model: db.providerDetails,
                                as: "businessInfo",
                                required: false,
                            },
                        ],
                    },
                ],
                where: {
                    deletedAt: null
                },
                order: [['id', 'DESC']]
            });

            const validRatings = ratings.filter(rating => {
                return (
                    rating?.rating !== null &&
                    rating?.rating !== undefined &&
                    rating?.review &&
                    rating.review.trim() !== '' &&
                    rating?.ratedto !== null &&
                    rating?.ratedto !== undefined &&
                    rating?.ratedby !== null &&
                    rating?.ratedby !== undefined
                );
            });

            let totalRating = 0;

            validRatings.forEach(rating => {
                totalRating += Number(rating.rating) || 0;
            });

            const reviewCount = validRatings.length;
            const averageRating =
                reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : "0.0";

            return helper.success(res, "Ratings fetched successfully.", {
                ratings: validRatings,
                stats: {
                    averageRating: parseFloat(averageRating),
                    totalReviews: reviewCount
                }
            });

        } catch (error) {
            console.error("ratinglist error:", error);
            return helper.failure(res, error.message);
        }
    },
    providerList: async (req, res) => {
        try {
            const data = await db.users.findAll({
                where: {
                    role: "2"
                },
                include: [
                    {
                        model: db.providerDetails,
                        as: 'businessInfo',
                        where: {
                            documentVerify: 1
                        },
                        required: true,
                        include: [
                            {
                                model: db.barrelsprices,
                                as: 'barrelPrices'
                            }
                        ]
                    },
                ],
            });

            return helper.success(res, "Profile fetched successfully.", data);

        } catch (error) {
            console.error("providerList error:", error);
            return helper.failure(res, error.message);
        }
    }
};

