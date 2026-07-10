const db = require("../../models");
const helper = require("../../helper/helper");

module.exports = {
    ratingList: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || "";
            const dateFilter = req.query.dateFilter || "all";

            const whereClause = {};
            const includeClause = [
                {
                    model: db.users,
                    as: 'ratedby',
                    required: false,
                },
                {
                    model: db.users,
                    as: 'ratedto',
                    required: false,
                },
                {
                    model: db.bookings,
                    as: 'ratedbooking',
                    required: false,
                    include: [
                        {
                            model: db.booking_requests,
                            as: 'bookingRequest',
                            required: false,
                            include: [
                                {
                                    model: db.booking_requests_items,
                                    as: 'items',
                                    required: false
                                }
                            ]
                        }
                    ]
                },
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
                searchConditions.push({
                    '$ratedby.name$': {
                        [db.Sequelize.Op.like]: `%${search}%`
                    }
                });

                searchConditions.push({
                    '$ratedto.name$': {
                        [db.Sequelize.Op.like]: `%${search}%`
                    }
                });

                if (!isNaN(search)) {
                    searchConditions.push({
                        id: parseInt(search)
                    });
                }

                whereClause[db.Sequelize.Op.or] = searchConditions;
            }

            const totalRatings = await db.reviewrating.count({
                where: whereClause,
                distinct: true,
                col: 'id',
                include: includeClause
            });

            const ratings = await db.reviewrating.findAll({
                where: whereClause,
                offset: offset,
                limit: limit,
                order: [["id", "DESC"]],
                include: includeClause,
                subQuery: false,
            });
            console.log("rating review listing--------------->>>>", ratings);
            return helper.success(res, "All rating details", {
                data: ratings,
                total: totalRatings,
                page,
                limit,
                totalPages: Math.ceil(totalRatings / limit),
            });
        } catch (error) {
            console.error("Rating list error:", error);
            return helper.error(res, error.message);
        }
    },
    ratingDelete: async (req, res) => {
        try {
            const { id } = req.params;

            const League = await db.reviewrating.findOne({ where: { id } });
            await db.reviewrating.destroy({ where: { id } });

            return helper.success(res, "Rating deleted successfully");
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

};
