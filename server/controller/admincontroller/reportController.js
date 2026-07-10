const db = require("../../models");
const helper = require("../../helper/helper");

module.exports = {
    reportList: async (req, res) => {
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
                    as: 'reportedby',
                    required: false,
                },
                {
                    model: db.users,
                    as: 'reportedto',
                    required: false,
                },
                {
                    model: db.bookings,
                    as: 'reportedbooking',
                    required: false,
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
                    '$reportedby.name$': {
                        [db.Sequelize.Op.like]: `%${search}%`
                    }
                });

                searchConditions.push({
                    '$reportedto.name$': {
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

            const totalRatings = await db.reports.count({
                where: whereClause,
                distinct: true,
                col: 'id',
                include: includeClause
            });

            const ratings = await db.reports.findAll({
                where: whereClause,
                offset: offset,
                limit: limit,
                order: [["id", "DESC"]],
                include: includeClause,
                subQuery: false,
            });

            return helper.success(res, "All report details", {
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
    reportDelete: async (req, res) => {
        try {
            const { id } = req.params;

            const report = await db.reports.findOne({ where: { id } });
            await db.reports.destroy({ where: { id } });

            return helper.success(res, "Report deleted successfully");
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

};
