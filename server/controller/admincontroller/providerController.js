const db = require("../../models");
const helper = require("../../helper/helper");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");

const normalizeStoragePath = (filePath) => {
  if (!filePath || typeof filePath !== "string") return "";

  let normalized = filePath.trim();
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      normalized = new URL(normalized).pathname;
    } catch {
      return "";
    }
  }

  normalized = normalized.replace(/^\/+/, "");

  if (!normalized.startsWith("images/") && !normalized.includes("/")) {
    normalized = `images/${normalized}`;
  }

  return normalized;
};

const pipeRemoteFile = (url, res, downloadName) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    client
      .get(url, (upstream) => {
        if (upstream.statusCode && upstream.statusCode >= 400) {
          upstream.resume();
          reject(new Error(`Remote file unavailable (${upstream.statusCode})`));
          return;
        }

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${downloadName}"`
        );
        if (upstream.headers["content-type"]) {
          res.setHeader("Content-Type", upstream.headers["content-type"]);
        }

        upstream.pipe(res);
        res.on("finish", resolve);
        res.on("error", reject);
        upstream.on("error", reject);
      })
      .on("error", reject);
  });

module.exports = {
  providerList: async (req, res) => {
    try {
      let { page, limit, search, dateFilter } = req.query;

      page = parseInt(page) || 1;
      limit = parseInt(limit) || 10;
      const offset = (page - 1) * limit;

      const Op = db.Sequelize.Op;

      const whereCondition = { role: "2" };

      if (search && search.trim() !== "") {
        const s = search.trim();
        whereCondition[Op.or] = [
          { firstName: { [Op.like]: `%${s}%` } },
          { lastName: { [Op.like]: `%${s}%` } },
          { email: { [Op.like]: `%${s}%` } },
          { working_as: { [Op.like]: `%${s}%` } }
        ];
      }

      if (dateFilter && dateFilter !== "all") {
        const daysAgo = parseInt(dateFilter);
        if (!isNaN(daysAgo)) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - daysAgo);
          whereCondition.createdAt = { [Op.gte]: startDate };
        }
      }

      const {
        count,
        rows: providers
      } = await db.users.findAndCountAll({
        where: whereCondition,
        attributes: {
          include: [
            [
              db.sequelize.literal(`(
                SELECT AVG(avg_time)
                FROM bookings AS b
                WHERE b."driverId" = users.id AND b.status = '2'
              )`),
              'delivery_avg'
            ],
            [
              db.sequelize.literal(`(
                SELECT COUNT(*)
                FROM bookings AS b
                WHERE b."driverId" = users.id AND b.status = '2'
              )`),
              'safety_avg'
            ]
          ]
        },
        include: [
          {
            model: db.providerDetails,
            as: "businessInfo",
            required: false,
          },
          {
            model: db.serviceAreaRoutes,
            as: "serviceArea",
            required: false,
            attributes: ["country", "freightType", "flightsPerWeekTo", "flightsPerWeekFrom"]
          }
        ],
        limit: parseInt(limit),
        offset: offset,
        order: [
          ["ranking", "ASC"],
          ["id", "DESC"]
        ],
      });

      const formattedRows = providers.map((r) => {
        const u = r.toJSON();
        if ((!u.firstName || !u.lastName) && u.name) {
          const parts = u.name.trim().split(" ");
          u.firstName = parts[0];
          u.lastName = parts.slice(1).join(" ");
        }
        return u;
      });

      return helper.success(res, "All Providers Detail", {
        data: formattedRows,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalProviders: count,
      });

    } catch (error) {
      console.error("providerList error:", error);
      return helper.error(res, error.message || "Internal server error");
    }
  },


  providerStatus: async (req, res) => {
    try {
      const { id, status } = req.body;

      const provider = await db.users.findOne({ where: { id, role: "2" } });
      if (!provider) return helper.error(res, "Provider not found");

      await db.users.update({ status }, { where: { id } });

      return helper.success(res, "Provider status updated", {
        id,
        status,
      });
    } catch (error) {
      return helper.error(res, error.message);
    }
  },

  providerDelete: async (req, res) => {
    try {
      const { id } = req.params;

      const provider = await db.users.findOne({ where: { id, role: "2" } });
      if (!provider) return helper.error(res, "Provider not found");

      await db.users.destroy({ where: { id } });

      return helper.success(res, "Provider deleted successfully");
    } catch (error) {
      return helper.error(res, error.message);
    }
  },

  providerBlock: async (req, res) => {
    try {
      const { id, block } = req.body;

      const provider = await db.users.findOne({ where: { id, role: "2" } });
      if (!provider) return helper.error(res, "Provider not found");

      await db.users.update({ block }, { where: { id } });

      return helper.success(res, "Provider block status updated", {
        id,
        block,
      });
    } catch (error) {
      return helper.error(res, error.message);
    }
  },

  providerSuspend: async (req, res) => {
    try {
      const { id, suspend } = req.body;

      const provider = await db.users.findOne({ where: { id, role: "2" } });
      if (!provider) return helper.error(res, "Provider not found");

      await db.users.update({ suspend }, { where: { id } });

      return helper.success(res, "Provider suspend status updated", {
        id,
        suspend,
      });
    } catch (error) {
      return helper.error(res, error.message);
    }
  },
  updateDocumentVerify: async (req, res) => {
    try {
      const { id, documentVerify } = req.body;
      // console.log(id, documentVerify);
      const provider = await db.users.findOne({ where: { id, role: "2" } });
      if (!provider) return helper.error(res, "Provider not found");
      // console.log(typeof documentVerify.toString());
      await db.providerDetails.update(
        { documentVerify },
        { where: { providerId: id } }
      );

      return helper.success(res, "Document verification status updated", {
        id,
        documentVerify,
      });

    } catch (error) {
      return helper.error(res, error.message);
    }
  },

  verifyAdminPassword: async (req, res) => {
    try {
      const { password } = req.body;
      const adminId = req.admin.id;

      if (!password) {
        return helper.error(res, "Password is required.");
      }

      const admin = await db.users.findOne({ where: { id: adminId, role: "0" } });
      if (!admin) {
        return helper.error(res, "Admin not found.");
      }

      const bcrypt = require("bcryptjs");
      const isMatch = await bcrypt.compare(password, admin.password);

      if (!isMatch) {
        return helper.error(res, "Incorrect password.");
      }

      return helper.success(res, "Password verified.", { valid: true });
    } catch (error) {
      return helper.error(res, error.message);
    }
  },

  updateRanking: async (req, res) => {
    try {
      const { id, ranking } = req.body;

      const provider = await db.users.findOne({ where: { id, role: "2" } });
      if (!provider) return helper.error(res, "Provider not found");

      await db.users.update({ ranking }, { where: { id } });

      return helper.success(res, "Provider ranking updated successfully", {
        id,
        ranking,
      });
    } catch (error) {
      return helper.error(res, error.message);
    }
  },

  downloadDocument: async (req, res) => {
    try {
      const filePath = req.query.path;

      if (!filePath || typeof filePath !== "string") {
        return helper.error(res, "File path is required", 400);
      }

      if (filePath.includes("..")) {
        return helper.error(res, "Invalid file path", 400);
      }

      const relativePath = normalizeStoragePath(filePath);
      if (!relativePath || !relativePath.startsWith("images/")) {
        return helper.error(res, "Invalid file path", 400);
      }

      const fileName = path.basename(relativePath);
      const publicDir = path.join(__dirname, "..", "..", "public");
      const fullPath = path.join(publicDir, relativePath);

      if (fs.existsSync(fullPath)) {
        return res.download(fullPath, fileName);
      }

      const remoteBase = (process.env.PUBLIC_BASE_URL || "https://admin.vershipgo.com").replace(
        /\/$/,
        ""
      );
      const remoteUrl = `${remoteBase}/${relativePath}`;

      await pipeRemoteFile(remoteUrl, res, fileName);
    } catch (error) {
      return helper.error(res, error.message || "File not found", 404);
    }
  },

};

