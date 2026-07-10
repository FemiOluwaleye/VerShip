const db = require('../../models');
const bcrypt = require('bcryptjs');
const helper = require('../../helper/helper');
const { Validator } = require('node-input-validator');
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");


module.exports = {
    getAllFaqs: async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return helper.failure(res, "User ID is missing");
            }
            const data = await db.faqs.findAll();
            return helper.success(res, "FAQ data fetched successfully", data);

        } catch (error) {
            return helper.failure(res, "An error occurred while fetching FAQ data");
        }
    },
    getFaqs: async (req, res) => {
        try {
            const { id } = req.params
            const data = await db.faqs.findOne({ where: { id } })
            return helper.success(res, "Faq fetched successfully", data)
        } catch (error) {
            return helper.failure(res, "Something Went Wrong")
        }
    },
}