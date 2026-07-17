const db = require("../../models");
const helper = require("../../helper/helper");

// Admin CRUD for the "VerShip Pre-Packed Food Barrel" product + its contents,
// plus a read-only order list. Mirrors bannerController's shape (paginated list,
// create-with-image-upload, detail, update, delete). Contents are managed inline:
// create/update accept a `contents` array (or JSON string) and REPLACE the
// child rows (parent-replaces-children).

// Normalize a truthy/falsy request value (checkbox, "true"/"false", 1/0) to a boolean.
function toBool(v) {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") return ["1", "true", "on", "yes"].includes(v.toLowerCase());
    return false;
}

// Accepts an array or a JSON string; returns a normalized array of {name,quantity,icon,sort_order}.
function parseContents(raw) {
    let arr = raw;
    if (typeof raw === "string") {
        try { arr = JSON.parse(raw); } catch (e) { arr = []; }
    }
    if (!Array.isArray(arr)) return [];
    return arr
        .filter((c) => c && (c.name || "").trim())
        .map((c, i) => ({
            name: String(c.name).trim(),
            quantity: String(c.quantity ?? "1"),
            icon: String(c.icon || ""),
            sort_order: Number.isFinite(+c.sort_order) ? +c.sort_order : i + 1,
        }));
}

async function replaceContents(productId, contents) {
    await db.prepacked_barrel_items.destroy({ where: { prepacked_barrel_id: productId }, force: true });
    for (const c of contents) {
        await db.prepacked_barrel_items.create({ ...c, prepacked_barrel_id: productId });
    }
}

module.exports = {
    addProduct: async (req, res) => {
        try {
            const { name, tagline, description, price, compareAtPrice, currency, transitTime, status } = req.body;
            if (!name) return helper.error(res, "Product name is required");
            if (price === undefined || price === "") return helper.error(res, "Price is required");
            const featured = req.body.featured !== undefined ? toBool(req.body.featured) : false;

            let imagePath = "";
            if (req.files && req.files.image) {
                imagePath = await helper.fileUpload(req.files.image);
            }

            const product = await db.prepacked_barrel.create({
                name,
                tagline: tagline || "",
                description: description || "",
                image: imagePath,
                price: String(price),
                compareAtPrice: compareAtPrice !== undefined ? String(compareAtPrice) : "",
                currency: currency || "USD",
                transitTime: transitTime || "",
                status: status || "1",
                featured,
            });

            await replaceContents(product.id, parseContents(req.body.contents));

            const full = await db.prepacked_barrel.findOne({
                where: { id: product.id },
                include: [{ model: db.prepacked_barrel_items, as: "contents" }],
            });
            return helper.success(res, "Product created successfully", full);
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

    productList: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || "";

            const whereCondition = search
                ? { name: { [db.Sequelize.Op.iLike]: `%${search}%` } }
                : {};

            const total = await db.prepacked_barrel.count({ where: whereCondition });
            const products = await db.prepacked_barrel.findAll({
                where: whereCondition,
                include: [{ model: db.prepacked_barrel_items, as: "contents" }],
                offset,
                limit,
                order: [["id", "DESC"]],
                distinct: true,
            });

            return helper.success(res, "All pre-packed products", {
                data: products,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

    productDetail: async (req, res) => {
        try {
            const product = await db.prepacked_barrel.findOne({
                where: { id: req.params.id },
                include: [{ model: db.prepacked_barrel_items, as: "contents" }],
                order: [[{ model: db.prepacked_barrel_items, as: "contents" }, "sort_order", "ASC"]],
            });
            if (!product) return helper.error(res, "Product not found");
            return helper.success(res, "Product details", product);
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

    productUpdate: async (req, res) => {
        try {
            const { id } = req.params;
            const product = await db.prepacked_barrel.findOne({ where: { id } });
            if (!product) return helper.error(res, "Product not found");

            if (req.files && req.files.image) {
                req.body.image = await helper.fileUpload(req.files.image);
            }

            const fields = {
                name: req.body.name ?? product.name,
                tagline: req.body.tagline ?? product.tagline,
                description: req.body.description ?? product.description,
                price: req.body.price !== undefined && req.body.price !== "" ? String(req.body.price) : product.price,
                compareAtPrice: req.body.compareAtPrice !== undefined ? String(req.body.compareAtPrice) : product.compareAtPrice,
                currency: req.body.currency ?? product.currency,
                transitTime: req.body.transitTime ?? product.transitTime,
                status: req.body.status ?? product.status,
                featured: req.body.featured !== undefined ? toBool(req.body.featured) : product.featured,
                image: req.body.image || product.image,
            };
            await db.prepacked_barrel.update(fields, { where: { id } });

            // Only replace contents when the caller sends a contents payload.
            if (req.body.contents !== undefined) {
                await replaceContents(id, parseContents(req.body.contents));
            }

            const updated = await db.prepacked_barrel.findOne({
                where: { id },
                include: [{ model: db.prepacked_barrel_items, as: "contents" }],
            });
            return helper.success(res, "Product updated successfully", { data: updated });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

    productDelete: async (req, res) => {
        try {
            const { id } = req.params;
            const product = await db.prepacked_barrel.findOne({ where: { id } });
            if (!product) return helper.error(res, "Product not found");
            await db.prepacked_barrel_items.destroy({ where: { prepacked_barrel_id: id }, force: true });
            await db.prepacked_barrel.destroy({ where: { id } });
            return helper.success(res, "Product deleted successfully");
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

    // List of placed orders (so the owner can fulfil them via orderUpdateStatus).
    orderList: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || "";

            const whereCondition = search
                ? {
                    [db.Sequelize.Op.or]: [
                        { orderId: { [db.Sequelize.Op.iLike]: `%${search}%` } },
                        { recipient_name: { [db.Sequelize.Op.iLike]: `%${search}%` } },
                        { recipient_email: { [db.Sequelize.Op.iLike]: `%${search}%` } },
                    ],
                }
                : {};

            const total = await db.prepacked_orders.count({ where: whereCondition });
            const orders = await db.prepacked_orders.findAll({
                where: whereCondition,
                include: [
                    { model: db.users, as: "buyer", attributes: ["id", "firstName", "lastName", "email", "phoneNumber"] },
                    { model: db.prepacked_barrel, as: "barrel", attributes: ["id", "name"] },
                ],
                offset,
                limit,
                order: [["id", "DESC"]],
                distinct: true,
            });

            return helper.success(res, "All pre-packed orders", {
                data: orders,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },

    // Update an order's fulfilment state: status ('0'..'4') and/or payment_status (0|1).
    orderUpdateStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const order = await db.prepacked_orders.findOne({ where: { id } });
            if (!order) return helper.error(res, "Order not found");

            const fields = {};

            if (req.body.status !== undefined) {
                const status = String(req.body.status);
                if (!["0", "1", "2", "3", "4"].includes(status)) {
                    return helper.error(res, "Invalid status");
                }
                fields.status = status;
            }

            if (req.body.payment_status !== undefined) {
                const payment = Number(req.body.payment_status);
                if (![0, 1].includes(payment)) {
                    return helper.error(res, "Invalid payment status");
                }
                fields.payment_status = payment;
            }

            if (Object.keys(fields).length === 0) {
                return helper.error(res, "Nothing to update");
            }

            await db.prepacked_orders.update(fields, { where: { id } });
            const updated = await db.prepacked_orders.findOne({ where: { id } });
            return helper.success(res, "Order updated successfully", { data: updated });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
};
