const path = require('path');
const fs = require('fs');
const uuid = require("uuid").v4;

// Root for user uploads. On Render this points at the mounted persistent disk
// (set UPLOAD_DIR=/var/data); locally it falls back to the app's public folder.
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), "public");

module.exports = {
    success: function (res, message = "", body = {}) {
        return res.status(200).json({
            success: true,
            status: 200,
            message: message,
            body: body
        });
    },
    failure: function (res, message = "", body = {}) {
        return res.status(400).json({
            success: false,
            status: 400,
            message: message,
            body: body
        });
    },
    error: function (res, message = "", status = 403, body = {}) {
        return res.status(status).json({
            success: false,
            status: status,
            message: message,
            body: body
        });
    },
    forbidden: function (res, message = "", body = {}) {
        return res.status(402).json({
            success: false,
            status: 402,
            message: message,
            body: body
        });
    },
    fileUpload: async (file) => {
        if (!file) return null;

        try {
            const extension = path.extname(file.name);
            const filename = uuid() + extension;
            const imagesDir = path.join(UPLOAD_ROOT, "images");
            await fs.promises.mkdir(imagesDir, { recursive: true });
            const uploadPath = path.join(imagesDir, filename);

            await file.mv(uploadPath);

            return `/images/${filename}`;
        } catch (err) {
            throw err;
        }
    },
    checkValidation: async (v) => {
        var errorsResponse;
        const match = await v.check().then(function (matched) {
            if (!matched) {
                var valdErrors = v.errors;
                var respErrors = [];
                Object.keys(valdErrors).forEach(function (key) {
                    if (valdErrors && valdErrors[key] && valdErrors[key].message) {
                        respErrors.push(valdErrors[key].message);
                    }
                });
                errorsResponse = respErrors.length > 0 ? respErrors[0] : '';
            }
        });
        return errorsResponse;
    },
    unixTimestamp: function () {
        var time = Date.now();
        var n = time / 1000;
        return (time = Math.floor(n));
    },

}