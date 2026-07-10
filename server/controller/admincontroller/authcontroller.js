const db = require('../../models');
const bcrypt = require('bcryptjs');
const helper = require('../../helper/helper');
const { Validator } = require('node-input-validator');
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");


module.exports = {
    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return helper.error(res, "Email and Password are required", 400);
            }

            const userData = await db.users.findOne({ where: { email } });

            if (!userData) {
                return helper.error(res, "Invalid Email", 401);
            }

            // role: 0=>admin, 1=>user, 2=>provider
            if (userData.role !== '0') {
                return helper.error(res, "Access denied. Only admins can login here.", 401);
            }

            const isPasswordValid = await bcrypt.compare(password, userData.password);

            if (!isPasswordValid) {
                return helper.error(res, "Invalid Email and Password", 401);
            }

            const secret = process.env.JWT_SECRET;
            const token = jwt.sign(
                {
                    id: userData.id,
                    name: userData.name,
                    email: userData.email,
                    role: userData.role
                },
                secret,
            );

            const userResponse = { ...userData.toJSON() };
            delete userResponse.password;

            return helper.success(res, "Login successful", {
                token: token,
                id: userResponse.id,
                name: userResponse.name,
                email: userResponse.email,
                role: userResponse.role
            });

        } catch (error) {
            console.log(error);
            return helper.error(res, error.message, 500);
        }
    },
    profile: async (req, res) => {
        try {
            const userId = req.admin.id;
            const find_user = await db.users.findByPk(userId, {});
            const addons = await db.addons.findAll();
            return helper.success(res, "Profile fetched successfully", { ...find_user.toJSON(), addons });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    editProfile: async (req, res) => {
        try {
            const userId = req.admin.id;
            const find_user = await db.users.findByPk(userId);
            if (!find_user) {
                return helper.error(res, "User not found", 403);
            }

            let imagePath = find_user.image;
            if (req.files && req.files.image) {
                imagePath = await helper.fileUpload(req.files.image);
            }

            const normalizedEmail = (req.body.email || "").trim().toLowerCase();
            const currentEmail = (find_user.email || "").trim().toLowerCase();
            let emailChanged = false;

            if (normalizedEmail && normalizedEmail !== currentEmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(normalizedEmail)) {
                    return helper.error(res, "Please enter a valid email address", 400);
                }

                const existingEmail = await db.users.findOne({
                    where: {
                        email: normalizedEmail,
                        id: { [Op.ne]: userId },
                    },
                });

                if (existingEmail) {
                    return helper.error(res, "Email already exists", 400);
                }

                emailChanged = true;
            }

            await db.users.update(
                {
                    firstName: req.body.firstName || find_user.firstName,
                    lastName: req.body.lastName || "",
                    email: normalizedEmail || find_user.email,
                    location: req.body.location || find_user.location,
                    phoneNumber: req.body.phoneNumber || find_user.phoneNumber,
                    countryCode: req.body.countryCode || find_user.countryCode,
                    image: imagePath,
                    adminCommission: req.body.adminCommission || find_user.adminCommission,
                    overallCommission: req.body.overallCommission ?? find_user.overallCommission
                },
                { where: { id: userId } }
            );

            const updatedProfile = await db.users.findByPk(userId, {});

            if (req.body.addOns) {
                const addOns = JSON.parse(req.body.addOns);
                for (let addon of addOns) {
                    await db.addons.update(
                        { price_in_percent: addon.price_in_percent },
                        { where: { id: addon.id } }
                    );
                }
            }

            const final_addons = await db.addons.findAll();
            return helper.success(res, "Profile updated successfully", {
                ...updatedProfile.toJSON(),
                addons: final_addons,
                emailChanged,
            });

        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    resetPassword: async (req, res) => {
        try {
            const { password, newPassword } = req.body;
            const token = req.headers.authorization?.split(' ')[1];

            if (!token) {
                return helper.error(res, "No token provided");
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;

            const find_data = await db.users.findByPk(userId);
            if (!find_data) {
                return helper.error(res, "User not found");
            }

            const isPasswordMatch = await bcrypt.compare(password, find_data.password);
            if (!isPasswordMatch) {
                return helper.error(res, "Old password is incorrect");
            }
            const isNewSameAsOld = await bcrypt.compare(newPassword, find_data.password);
            if (isNewSameAsOld) {
                return helper.error(res, "New password cannot be the same as the old password");
            }

            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            await db.users.update(
                { password: hashedNewPassword },
                { where: { id: userId } }
            );

            return helper.success(res, "Password changed successfully");
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    logout: async (req, res) => {
        try {
            return helper.success(res, "Logged out successfully. Please clear the token on the client side.");
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    dashboard: async (req, res) => {
        try {
            const { period } = req.query; // week, month, year, lifetime

            let startDate = null;
            const now = new Date();
            if (period === 'week') {
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
            } else if (period === 'month') {
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 1);
            } else if (period === 'year') {
                startDate = new Date(now);
                startDate.setFullYear(now.getFullYear() - 1);
            }

            const whereClause = {};
            if (startDate) {
                whereClause.createdAt = { [Op.gte]: startDate };
            }

            let player = await db.users.count({ where: { ...whereClause, role: "1" } });
            let coach = await db.users.count({ where: { ...whereClause, role: "2" } }); // Providers

            let booking = await db.bookings.count({ where: whereClause });
            let paidBookings = await db.bookings.count({ where: { ...whereClause, payment_status: 1 } });
            let rating = await db.reviewrating.count({ where: whereClause });
            let contact = await db.contactus.count({ where: whereClause });
            let faq = await db.faqs.count({ where: whereClause });

            return helper.success(res, "Dashboard data fetched successfully", {
                player,
                coach,
                booking,
                paidBookings,
                rating,
                contact,
                faq
            });
        } catch (error) {
            return helper.error(res, "Error fetching dashboard data", 500);
        }
    },
    chartData: async (req, res) => {
        try {
            const currentYear = new Date().getFullYear();
            const categories = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            const data = await Promise.all(
                categories.map(async (_, index) => {
                    const startOfMonth = new Date(currentYear, index, 1);
                    const endOfMonth = new Date(currentYear, index + 1, 0, 23, 59, 59);

                    const playerCount = await db.users.count({
                        where: {
                            role: "1",
                            createdAt: {
                                [Op.between]: [startOfMonth, endOfMonth],
                            },
                        },
                    });
                    const coachCount = await db.users.count({
                        where: {
                            role: "2",
                            createdAt: {
                                [Op.between]: [startOfMonth, endOfMonth],
                            },
                        },
                    });

                    return { playerCount, coachCount };
                })
            );

            const playersData = data.map(item => item.playerCount);
            const coachesData = data.map(item => item.coachCount);

            res.json({
                data: { players: playersData, coaches: coachesData },
                categories,
            });
        } catch (error) {
            return helper.error(res, "Error fetching chart data", 500);
        }
    },
    AdminBank: async (req, res) => {
        try {
            const userId = req.admin.id;

            const find_user = await db.users.findOne({
                where: { id: userId },
                include: [
                    {
                        model: db.userBanks,
                        as: 'banks',
                        required: false,
                    },
                ],
            });

            if (!find_user) {
                return helper.error(res, "User not found");
            }

            const bankData = find_user.banks && find_user.banks.length > 0 ? find_user.banks[0] : {};

            return helper.success(res, "Bank Detail fetched successfully", { bankuser: bankData });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    updateBankDetails: async (req, res) => {
        try {
            const userId = req.admin.id;
            const {
                accountType, bankName, accountCountry, currency, currencyCountry, sortCode,
                accountName, accountNumber, accountOwnerInfo, holderName, city, address, postalCode, isDefault
            } = req.body;

            if (!bankName || !accountNumber || !holderName) {
                return helper.error(res, "Bank name, account number, and holder name are required");
            }

            let bankDetails = await db.userBanks.findOne({ where: { userId } });

            if (bankDetails) {
                await db.userBanks.update(
                    {
                        accountType, bankName, accountCountry, currency, currencyCountry, sortCode,
                        accountName, accountNumber, accountOwnerInfo, holderName, city, address, postalCode, isDefault
                    },
                    { where: { userId } }
                );
            } else {
                await db.userBanks.create({
                    userId, accountType, bankName, accountCountry, currency, currencyCountry, sortCode,
                    accountName, accountNumber, accountOwnerInfo, holderName, city, address, postalCode, isDefault
                });
            }

            const updatedBankDetails = await db.userBanks.findOne({ where: { userId } });
            return helper.success(res, "Bank details updated successfully", updatedBankDetails);
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

    getDashboardMetrics: async (req, res) => {
        try {
            const { period, page = 1, limit = 10 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let startDate = null;
            const now = new Date();
            if (period === 'week') {
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
            } else if (period === 'month') {
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 1);
            } else if (period === 'year') {
                startDate = new Date(now);
                startDate.setFullYear(now.getFullYear() - 1);
            }

            // --- 1. Metrics Logic (Filtered by period) ---
            const metricsWhere = { payment_status: 1 };
            if (startDate) {
                metricsWhere.createdAt = { [Op.gte]: startDate };
            }

            const metricsBookings = await db.bookings.findAll({
                where: metricsWhere,
                include: [
                    {
                        model: db.booking_requests,
                        as: 'bookingRequest',
                        required: false,
                        attributes: ['quantity']
                    }
                ]
            });

            let totalOrders = metricsBookings.length;
            let totalBarrels = 0;
            let totalPrice = 0;
            let totalDeliveryDays = 0;
            let deliveryTimeCount = 0;
            totalBarrels = await db.barrelsprices.count('barrelNumber');

            metricsBookings.forEach(b => {
                const bData = b.toJSON();
                const qty = parseInt(bData.bookingRequest?.quantity) || 0;
                const price = parseFloat(bData.bookingPrice) || 0;
                const recordedAvgTime = bData.avg_time;

                // totalBarrels += qty;
                totalPrice += price;

                if (recordedAvgTime !== null && recordedAvgTime !== undefined) {
                    const days = parseFloat((recordedAvgTime / 24).toFixed(2));
                    totalDeliveryDays += days;
                    deliveryTimeCount++;
                }
            });
            // barrelPrice is a VARCHAR column; Postgres SUM() rejects varchar
            // (MySQL silently coerced it), so cast to DECIMAL and skip blanks.
            const [priceAgg] = await db.sequelize.query(
                `SELECT COALESCE(SUM(CAST(NULLIF("barrelPrice", '') AS DECIMAL)), 0) AS total FROM "barrelsprices" WHERE "deletedAt" IS NULL`,
                { type: db.sequelize.QueryTypes.SELECT }
            );
            totalPrice = parseFloat(priceAgg.total) || 0;
            const avgPricePerBarrel = (totalBarrels > 0) ? (totalPrice / totalBarrels).toFixed(2) : 0;
            const avgDeliveryTime = (deliveryTimeCount > 0) ? (totalDeliveryDays / deliveryTimeCount).toFixed(1) : 0;
            const avgBarrelsPerOrder = (totalOrders > 0) ? (totalBarrels / totalOrders).toFixed(1) : 0;

            // --- 2. Transactions Logic (Unfiltered by period, Paginated) ---
            const { count: totalTransactions, rows: transactionsList } = await db.bookings.findAndCountAll({
                where: { payment_status: 1 },
                include: [
                    {
                        model: db.users,
                        as: 'userbook',
                        required: false,
                        attributes: ['id', 'firstName', 'lastName', 'email']
                    },
                    {
                        model: db.booking_requests,
                        as: 'bookingRequest',
                        required: false,
                        attributes: ['quantity', 'pickup_date', 'delivery_date']
                    }
                ],
                order: [['id', 'DESC']],
                limit: parseInt(limit),
                offset: offset
            });

            const transactions = transactionsList.map(b => {
                const bData = b.toJSON();
                return {
                    orderId: bData.orderId || bData.id,
                    bookingId: bData.id,
                    customer: bData.userbook
                        ? `${bData.userbook.firstName || ''} ${bData.userbook.lastName || ''}`.trim()
                        : bData.primary_name || 'N/A',
                    customerEmail: bData.userbook?.email || '',
                    price: parseFloat(bData.bookingPrice) || 0,
                    pickupDate: bData.bookingRequest?.pickup_date,
                    deliveryDate: bData.bookingRequest?.delivery_date,
                    avgTime: bData.avg_time
                };
            });

            return helper.success(res, "Dashboard metrics fetched successfully", {
                period: period || 'lifetime',
                totalOrders,
                totalBarrels,
                avgPricePerBarrel,
                avgDeliveryTime,
                avgBarrelsPerOrder,
                transactions,
                pagination: {
                    totalTransactions,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalTransactions / limit),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("getDashboardMetrics error:", error);
            return helper.error(res, "Error fetching dashboard metrics", 500);
        }
    }

    // getDashboardMetrics: async (req, res) => {
    //     try {
    //         const { period } = req.query; // week, month, year, lifetime

    //         let startDate = null;
    //         const now = new Date();
    //         if (period === 'week') {
    //             startDate = new Date(now);
    //             startDate.setDate(now.getDate() - 7);
    //         } else if (period === 'month') {
    //             startDate = new Date(now);
    //             startDate.setMonth(now.getMonth() - 1);
    //         } else if (period === 'year') {
    //             startDate = new Date(now);
    //             startDate.setFullYear(now.getFullYear() - 1);
    //         }
    //         // lifetime = null (no filter)

    //         const whereClause = { payment_status: 1 };
    //         if (startDate) {
    //             whereClause.createdAt = { [Op.gte]: startDate };
    //         }

    //         const bookings = await db.bookings.findAll({
    //             where: whereClause,
    //             include: [
    //                 {
    //                     model: db.users,
    //                     as: 'userbook',
    //                     required: false,
    //                     attributes: ['id', 'firstName', 'lastName', 'email']
    //                 },
    //                 {
    //                     model: db.booking_requests,
    //                     as: 'bookingRequest',
    //                     required: false,
    //                     attributes: ['quantity', 'pickup_date', 'delivery_date']
    //                 }
    //             ],
    //             order: [['id', 'DESC']]
    //         });

    //         let totalOrders = bookings.length;
    //         let totalBarrels = 0;
    //         let totalPrice = 0;
    //         let priceBarrelPairs = 0;
    //         let totalDeliveryDays = 0;
    //         let deliveryTimeCount = 0;

    //         const transactions = bookings.map(b => {
    //             const bData = b.toJSON();
    //             const qty = parseInt(bData.bookingRequest?.quantity) || 0;
    //             const price = parseFloat(bData.bookingPrice) || 0;
    //             const pickupDate = bData.bookingRequest?.pickup_date;
    //             const deliveryDate = bData.bookingRequest?.delivery_date;
    //             const actualStartTime = bData.start_time;
    //             const actualEndTime = bData.end_time;
    //             const recordedAvgTime = bData.avg_time; // in hours

    //             totalBarrels += qty;
    //             totalPrice += price;
    //             if (qty > 0 && price > 0) {
    //                 priceBarrelPairs++;
    //             }

    //             let deliveryDays = null;
    //             if (recordedAvgTime !== null && recordedAvgTime !== undefined) {
    //                 deliveryDays = parseFloat((recordedAvgTime / 24).toFixed(2));
    //                 totalDeliveryDays += deliveryDays;
    //                 deliveryTimeCount++;
    //             }
    //             // else if (pickupDate && deliveryDate) {
    //             //     const pickup = new Date(pickupDate);
    //             //     const delivery = new Date(deliveryDate);
    //             //     deliveryDays = Math.max(0, Math.round((delivery - pickup) / (1000 * 60 * 60 * 24)));
    //             //     totalDeliveryDays += deliveryDays;
    //             //     deliveryTimeCount++;
    //             // }

    //             return {
    //                 orderId: bData.orderId || bData.id,
    //                 bookingId: bData.id,
    //                 customer: bData.userbook
    //                     ? `${bData.userbook.firstName || ''} ${bData.userbook.lastName || ''}`.trim()
    //                     : bData.primary_name || 'N/A',
    //                 customerEmail: bData.userbook?.email || '',
    //                 price: price,
    //                 pickupDate,
    //                 deliveryDate,
    //                 startTime: actualStartTime,
    //                 endTime: actualEndTime,
    //                 deliveryDays,
    //                 avgTime: recordedAvgTime
    //             };
    //         });

    //         const avgPricePerBarrel = (totalBarrels > 0) ? (totalPrice / totalBarrels).toFixed(2) : 0;
    //         const avgDeliveryTime = (deliveryTimeCount > 0) ? (totalDeliveryDays / deliveryTimeCount).toFixed(1) : 0;
    //         const avgBarrelsPerOrder = (totalOrders > 0) ? (totalBarrels / totalOrders).toFixed(1) : 0;

    //         return helper.success(res, "Dashboard metrics fetched successfully", {
    //             period: period || 'lifetime',
    //             totalOrders,
    //             totalBarrels,
    //             avgPricePerBarrel,
    //             avgDeliveryTime,
    //             avgBarrelsPerOrder,
    //             transactions
    //         });
    //     } catch (error) {
    //         console.error("getDashboardMetrics error:", error);
    //         return helper.error(res, error.message);
    //     }
    // }
}