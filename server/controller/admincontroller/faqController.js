const db = require("../../models");
const helper = require("../../helper/helper");
const { Validator } = require("node-input-validator");

module.exports = {
    createFAQ: async (req, res) => {
        try {
            const v = new Validator(req.body, {
                question: "required|string",
                answer: "required|string",
            });

            let errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.error(res, errorsResponse);
            }

            const newFAQ = await db.faqs.create({
                question: req.body.question,
                answer: req.body.answer,
            });

            return helper.success(res, "FAQ Created Successfully", { data: newFAQ });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    FAQList: async (req, res) => {
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

            const totalFAQs = await db.faqs.count({ where: whereCondition });

            const faqs = await db.faqs.findAll({
                where: whereCondition,
                offset: offset,
                limit: limit,
                order: [["id", "DESC"]],
            });

            return helper.success(res, "All FAQ details", {
                data: faqs,
                total: totalFAQs,
                page,
                limit,
                totalPages: Math.ceil(totalFAQs / limit),
            });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

    FAQDetail: async (req, res) => {
        try {
            const faq = await db.faqs.findOne({ where: { id: req.params.id } });
            if (!faq) {
                return helper.error(res, "FAQ not found");
            }
            return helper.success(res, "FAQ details", faq);
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    FAQDelete: async (req, res) => {
        try {
            const { id } = req.params;
            const faq = await db.faqs.findOne({ where: { id } });

            if (!faq) {
                return helper.error(res, "FAQ not found");
            }

            await db.faqs.destroy({ where: { id } });
            return helper.success(res, "FAQ deleted successfully");
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    FAQUpdate: async (req, res) => {
        try {
            const { id } = req.params;
            const v = new Validator(req.body, {
                question: "required|string",
                answer: "required|string",
            });

            let errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.error(res, errorsResponse);
            }

            const faq = await db.faqs.findOne({ where: { id } });
            if (!faq) {
                return helper.error(res, "FAQ not found");
            }

            await db.faqs.update(
                { question: req.body.question, answer: req.body.answer },
                { where: { id } }
            );
            const updatedFAQ = await db.faqs.findOne({ where: { id } });
            return helper.success(res, "FAQ updated successfully", { data: updatedFAQ });
        } catch (error) {
            return helper.error(res, error.message);
        }
    }

};
