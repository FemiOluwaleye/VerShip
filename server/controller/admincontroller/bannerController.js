const db = require("../../models");
const helper = require("../../helper/helper");


module.exports = {
    addBanner: async (req, res) => {
        try {
            const { title } = req.body;
            if (!title) return helper.error(res, "Title is required");

            let imagePath = null;
            if (req.files && req.files.image) {
                imagePath = await helper.fileUpload(req.files.image);
            }

            const banner = await db.banners.create({ title, image: imagePath });``
            return helper.success(res, "Banner created successfully", banner);
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    bannerList: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || "";
            let dateFilter = req.query.dateFilter || "all";
            const whereClause = search
                ? {
                    question: {
                        [db.Sequelize.Op.like]: `%${search}%`,
                    },
                }
                : {};

            let whereCondition = { ...whereClause };


            if (dateFilter !== 'all') {
                const daysAgo = parseInt(dateFilter, 10);
                if (!isNaN(daysAgo)) {
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - daysAgo);

                    whereCondition.createdAt = {
                        [db.Sequelize.Op.gte]: startDate,
                    };
                }
            }

            const totalbanners = await db.banners.count({ where: whereCondition });

            const banners = await db.banners.findAll({
                where: whereCondition,
                offset: offset,
                limit: limit,
                order: [["id", "DESC"]],
            });

            return helper.success(res, "All banner details", {
                data: banners,
                total: totalbanners,
                page,
                limit,
                totalPages: Math.ceil(totalbanners / limit),
            });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    bannerDelete: async (req, res) => {
        try {
            const { id } = req.params;
            const sport = await db.banners.findOne({ where: { id } });
            if (!sport) {
                return helper.error(res, "Banner not found");
            }
            await db.banners.destroy({ where: { id } });
            return helper.success(res, "Banner deleted successfully");
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    bannerDetail: async (req, res) => {
        try {
            const sport = await db.banners.findOne({ where: { id: req.params.id } });
            if (!sport) {
                return helper.error(res, "Banner not found");
            }
            return helper.success(res, "Banner details", sport);
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    bannerUpdate: async (req, res) => {
        try {
            const { id } = req.params;
            const banner = await db.banners.findOne({ where: { id } });

            if (!banner) {
                return helper.error(res, "Banner not found.");
            }

            const existingBanner = await db.banners.findOne({
                where: { title: req.body.title, id: { [db.Sequelize.Op.ne]: id } }
            });

            if (existingBanner) {
                return helper.error(res, "Another banner already exists with that title.");
            }

            if (req.files && req.files.image) {
                let imagePath = await helper.fileUpload(req.files.image);
                req.body.image = imagePath;
            }

            await db.banners.update(
                { title: req.body.title, image: req.body.image || banner.image },
                { where: { id } }
            );

            const updatedBanner = await db.banners.findOne({ where: { id } });
            return helper.success(res, "Banner updated successfully", { data: updatedBanner });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },



};
