const db = require("../../models");
const helper = require("../../helper/helper");

module.exports = {
    bookingList: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || "";
            const dateFilter = req.query.dateFilter || "all";

            const whereClause = {
                payment_status: 1
            };
            const includeClause = [
                {
                    model: db.users,
                    as: 'driverbook',
                    required: false,
                    include: [
                        {
                            model: db.providerDetails,
                            as: 'businessInfo',
                            required: false,
                            include: [
                                {
                                    model: db.barrelsprices,
                                    as: 'barrelPrices',
                                    required: false,
                                }
                            ]
                        },

                    ]
                },
                {
                    model: db.users,
                    as: 'userbook',
                    required: false,
                },
                {
                    model: db.booking_requests,
                    as: 'bookingRequest',
                    required: false,
                    include: [
                        {
                            model: db.booking_requests_items,
                            as: 'items',
                            required: false,
                        }
                    ]
                },
                // "Pay as Your Shipment Moves": deposit / customs & delivery / extras
                { model: db.booking_charges, as: 'charges', required: false },
            ];

            // Date filter
            if (dateFilter !== 'all') {
                const daysAgo = parseInt(dateFilter, 10);
                if (!isNaN(daysAgo)) {
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - daysAgo);
                    whereClause.createdAt = {
                        [db.Sequelize.Op.gte]: startDate,
                    };
                }
            }

            if (search) {
                const searchConditions = [];

                searchConditions.push({ '$driverbook.firstName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$driverbook.lastName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$driverbook.email$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.firstName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.lastName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.email$': { [db.Sequelize.Op.like]: `%${search}%` } });


                if (!isNaN(search)) {
                    searchConditions.push({
                        id: parseInt(search)
                    });
                }

                whereClause[db.Sequelize.Op.or] = searchConditions;
            }

            const totalBookings = await db.bookings.count({
                where: whereClause,
                distinct: true,
                col: 'id',
                include: includeClause
            });

            const bookings = await db.bookings.findAll({
                where: whereClause,
                offset: offset,
                limit: limit,
                order: [["id", "DESC"]],
                include: includeClause,
            });

            console.log(bookings, ">>>>>>>>>>>>>>>>>>>>>bookings");


            return helper.success(res, "All bookings details", {
                data: bookings,
                total: totalBookings,
                page,
                limit,
                totalPages: Math.ceil(totalBookings / limit),
            });
        } catch (error) {
            console.error("Booking list error:", error);
            return helper.error(res, error.message);
        }
    },
    bookingDelete: async (req, res) => {
        try {
            const { id } = req.params;

            const League = await db.bookings.findOne({ where: { id } });
            await db.bookings.destroy({ where: { id } });

            return helper.success(res, "Booking deleted successfully");
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    activeBookinglist: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || "";
            const dateFilter = req.query.dateFilter || "all";
            const statusFilter = req.query.statusFilter || "all"; // Add status filter

            const whereClause = {
                // In transit: shipped, arrived in Jamaica (customs due), delivered
                status: {
                    [db.Sequelize.Op.in]: ["1", "5", "2"]
                },
                payment_status: 1
            };

            const includeClause = [
                {
                    model: db.users,
                    as: 'driverbook',
                    required: false,
                },
                {
                    model: db.users,
                    as: 'userbook',
                    required: false,
                },
                { model: db.booking_charges, as: 'charges', required: false },
                { model: db.booking_requests, as: 'bookingRequest', required: false, attributes: ['id', 'origin', 'destination', 'quantity', 'parish'] },
            ];

            // Date filter
            if (dateFilter !== 'all') {
                const daysAgo = parseInt(dateFilter, 10);
                if (!isNaN(daysAgo)) {
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - daysAgo);
                    whereClause.createdAt = {
                        [db.Sequelize.Op.gte]: startDate,
                    };
                }
            }

            // Status filter for active bookings
            if (statusFilter !== 'all') {
                whereClause.status = statusFilter; // Override to show specific status
            }

            if (search) {
                const searchConditions = [];

                searchConditions.push({ '$driverbook.firstName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$driverbook.lastName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$driverbook.email$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.firstName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.lastName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.email$': { [db.Sequelize.Op.like]: `%${search}%` } });

                if (!isNaN(search)) {
                    searchConditions.push({
                        id: parseInt(search)
                    });
                }

                whereClause[db.Sequelize.Op.or] = searchConditions;
            }

            const totalBookings = await db.bookings.count({
                where: whereClause,
                distinct: true,
                col: 'id',
                include: includeClause
            });

            const bookings = await db.bookings.findAll({
                where: whereClause,
                offset: offset,
                limit: limit,
                order: [["id", "DESC"]],
                include: includeClause,
            });

            return helper.success(res, "Active bookings details", {
                data: bookings,
                total: totalBookings,
                page,
                limit,
                totalPages: Math.ceil(totalBookings / limit),
            });
        } catch (error) {
            console.error("Active booking list error:", error);
            return helper.error(res, error.message);
        }
    },
    bookingCompleted: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || "";
            const dateFilter = req.query.dateFilter || "all";

            const whereClause = {
                status: "4"
            };
            const includeClause = [
                {
                    model: db.users,
                    as: 'driverbook',
                    required: false,
                },
                {
                    model: db.users,
                    as: 'userbook',
                    required: false,
                },
                { model: db.booking_charges, as: 'charges', required: false },
                { model: db.booking_requests, as: 'bookingRequest', required: false, attributes: ['id', 'origin', 'destination', 'quantity', 'parish'] },
            ];

            if (dateFilter !== 'all') {
                const daysAgo = parseInt(dateFilter, 10);
                if (!isNaN(daysAgo)) {
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - daysAgo);
                    whereClause.createdAt = {
                        [db.Sequelize.Op.gte]: startDate,
                    };
                }
            }

            if (search) {
                const searchConditions = [];

                searchConditions.push({ '$driverbook.firstName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$driverbook.lastName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$driverbook.email$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.firstName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.lastName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.email$': { [db.Sequelize.Op.like]: `%${search}%` } });

                if (!isNaN(search)) {
                    searchConditions.push({
                        id: parseInt(search)
                    });
                }

                whereClause[db.Sequelize.Op.and] = [
                    { [db.Sequelize.Op.or]: searchConditions }
                ];
            }

            const totalBookings = await db.bookings.count({
                where: whereClause,
                distinct: true,
                col: 'id',
                include: includeClause
            });

            const bookings = await db.bookings.findAll({
                where: whereClause,
                offset: offset,
                limit: limit,
                order: [["id", "DESC"]],
                include: includeClause,
            });

            const processedBookings = await Promise.all(bookings.map(async (booking) => {
                const bookingData = booking.toJSON();

                if (bookingData.bookingPrice) {
                    try {
                        const adminUser = await db.users.findOne({
                            where: { role: "0" },
                            attributes: ['adminCommission']
                        });

                        if (adminUser && adminUser.adminCommission) {
                            const commissionPercentage = parseFloat(adminUser.adminCommission);
                            if (!isNaN(commissionPercentage) && commissionPercentage > 0) {
                                bookingData.adminAmount = (bookingData.bookingPrice * commissionPercentage) / 100;
                            } else {
                                bookingData.adminAmount = 0;
                            }
                        } else {
                            bookingData.adminAmount = 0;
                        }
                    } catch (error) {
                        console.error("Error calculating admin commission:", error);
                        bookingData.adminAmount = 0;
                    }
                } else {
                    bookingData.adminAmount = 0;
                }

                return bookingData;
            }));

            return helper.success(res, "All completed booking details", {
                data: processedBookings,
                total: totalBookings,
                page,
                limit,
                totalPages: Math.ceil(totalBookings / limit),
            });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    bookingDriverList: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || "";
            const dateFilter = req.query.dateFilter || "all";
            const driverId = req.params.id;

            if (!driverId) {
                return helper.error(res, "Driver ID is required");
            }

            const whereClause = {
                driverId: driverId
            };

            const includeClause = [
                {
                    model: db.users,
                    as: 'driverbook',
                    required: false,
                },
                {
                    model: db.users,
                    as: 'userbook',
                    required: false,
                },
                { model: db.booking_charges, as: 'charges', required: false },
                { model: db.booking_requests, as: 'bookingRequest', required: false, attributes: ['id', 'origin', 'destination', 'quantity', 'parish'] },
            ];

            if (dateFilter !== 'all') {
                const daysAgo = parseInt(dateFilter, 10);
                if (!isNaN(daysAgo)) {
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - daysAgo);
                    whereClause.createdAt = {
                        [db.Sequelize.Op.gte]: startDate,
                    };
                }
            }

            if (search) {
                const searchConditions = [];

                searchConditions.push({ '$driverbook.firstName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$driverbook.lastName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$driverbook.email$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.firstName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.lastName$': { [db.Sequelize.Op.like]: `%${search}%` } });
                searchConditions.push({ '$userbook.email$': { [db.Sequelize.Op.like]: `%${search}%` } });

                if (!isNaN(search)) {
                    searchConditions.push({
                        id: parseInt(search)
                    });
                }

                whereClause[db.Sequelize.Op.or] = searchConditions;
            }

            const totalBookings = await db.bookings.count({
                where: whereClause,
                distinct: true,
                col: 'id',
                include: includeClause
            });

            const bookings = await db.bookings.findAll({
                where: whereClause,
                offset: offset,
                limit: limit,
                order: [["id", "DESC"]],
                include: includeClause,
            });

            return helper.success(res, "Driver bookings details", {
                data: bookings,
                total: totalBookings,
                page,
                limit,
                totalPages: Math.ceil(totalBookings / limit),
            });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

    assignBooking: async (req, res) => {
        try {
            const { bookingId, driverId } = req.body;

            if (!bookingId || !driverId) {
                return helper.error(res, "Booking ID and Driver ID are required");
            }

            const booking = await db.bookings.findOne({ where: { id: bookingId } });
            if (!booking) {
                return helper.error(res, "Booking not found");
            }

            const driver = await db.users.findOne({ where: { id: driverId, role: "2" } });
            if (!driver) {
                return helper.error(res, "Driver not found or invalid role");
            }

            await db.bookings.update(
                { driverId: driverId, isAssigned: 1 },
                { where: { id: bookingId } }
            );

            // Notify Provider
            try {
                if (driver && driver.deviceToken) {
                    const notificationHelper = require("../../helper/notificationHelper");
                    await notificationHelper.sendNotification(
                        driver.deviceToken,
                        "New Booking Assigned",
                        `You have been assigned a new booking #${booking.orderId}.`,
                        { bookingId: String(bookingId), type: "booking_assigned" }
                    );
                }
            } catch (notiError) {
                console.error("Notification Error:", notiError);
            }

            return helper.success(res, "Booking assigned successfully");
        } catch (error) {
            console.error("Assign booking error:", error);
            return helper.error(res, error.message);
        }
    },


};
