const db = require('../../models');

exports.cookieList = async (req, res) => {
    try {
        const cookies = await db.cookies.findAll({
            order: [['createdAt', 'DESC']]
        });
        return res.status(200).json({
            success: true,
            message: "Cookies fetched successfully.",
            data: cookies
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching cookies.",
            error: error.message
        });
    }
};

exports.createCookie = async (req, res) => {
    try {
        const { name, description, type, duration, status } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: "Name is required." });
        }
        const cookie = await db.cookies.create({
            name,
            description,
            type,
            duration,
            status: status !== undefined ? status : 1
        });
        return res.status(200).json({
            success: true,
            message: "Cookie created successfully.",
            data: cookie
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error creating cookie.",
            error: error.message
        });
    }
};

exports.cookieDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const cookie = await db.cookies.findByPk(id);
        if (!cookie) {
            return res.status(404).json({ success: false, message: "Cookie not found." });
        }
        return res.status(200).json({
            success: true,
            data: cookie
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching cookie detail.",
            error: error.message
        });
    }
};

exports.updateCookie = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, type, duration, status } = req.body;
        const cookie = await db.cookies.findByPk(id);
        if (!cookie) {
            return res.status(404).json({ success: false, message: "Cookie not found." });
        }
        await cookie.update({
            name,
            description,
            type,
            duration,
            status: status !== undefined ? status : cookie.status
        });
        return res.status(200).json({
            success: true,
            message: "Cookie updated successfully.",
            data: cookie
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error updating cookie.",
            error: error.message
        });
    }
};

exports.cookieDelete = async (req, res) => {
    try {
        const { id } = req.params;
        const cookie = await db.cookies.findByPk(id);
        if (!cookie) {
            return res.status(404).json({ success: false, message: "Cookie not found." });
        }
        await cookie.destroy();
        return res.status(200).json({
            success: true,
            message: "Cookie deleted successfully."
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error deleting cookie.",
            error: error.message
        });
    }
};
