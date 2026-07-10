const db = require("../../models");
const helper = require("../../helper/helper");
const { Validator } = require("node-input-validator");

module.exports = {
    tutorialCreate: async (req, res) => {
        try {
            const v = new Validator(req.body, {
            });

            if (req.files && req.files.image) {
                const filePaths = [];

                for (let file of req.files.image) {
                    let imagePath = await helper.fileUpload(file);
                    filePaths.push(imagePath);
                }

                req.body.image = filePaths;
            }

            let errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.error(res, errorsResponse);
            }

            const newTutorial = await db.tutorials.create({
                title: req.body.title,
                price: req.body.price,
                description: req.body.description,
                status: req.body.status || '1',
            });

            if (req.body.image && req.body.image.length > 0) {
                for (let imagePath of req.body.image) {
                    await db.tutorialImages.create({
                        tutorialId: newTutorial.id,
                        image: imagePath,
                    });
                }
            }

            return helper.success(res, "Tutorial Created Successfully", { data: newTutorial });
        } catch (error) {
            console.error("Error details:", error);
            return helper.error(res, error.message);
        }
    },
    tutorialList: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || "";
            const dateFilter = req.query.dateFilter || "all";
            const whereClause = {};

            if (search) {
                whereClause[db.Sequelize.Op.or] = [
                    {
                        title: {
                            [db.Sequelize.Op.like]: `%${search}%`,
                        },
                    },
                    {
                        price: {
                            [db.Sequelize.Op.like]: `%${search}%`,
                        },
                    },
                ];
            }

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

            const totalTutorials = await db.tutorials.count({ where: whereClause });

            const tutorials = await db.tutorials.findAll({
                where: whereClause,
                offset: offset,
                limit: limit,
                order: [["id", "DESC"]],
                include: [
                    {
                        model: db.tutorialImages,
                        as: 'tutorialImages',
                    },
                    {
                         model: db.users,
                        as: 'tutorialcoach',
                    }
                ],
            });

            return helper.success(res, "All tutorial details", {
                data: tutorials,
                total: totalTutorials,
                page,
                limit,
                totalPages: Math.ceil(totalTutorials / limit),
            });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    tutorialDetail: async (req, res) => {
        try {
            const tutorial = await db.tutorials.findOne({
                where: { id: req.params.id },
                include: [
                    {
                        model: db.tutorialImages,
                        as: 'tutorialImages',
                    },
                ],
            });

            if (!tutorial) {
                return helper.error(res, "Tutorial not found");
            }

            return helper.success(res, "Tutorial details", tutorial);
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    tutorialDelete: async (req, res) => {
        try {
            const { id } = req.params;
            const Tutorial = await db.tutorials.findOne({ where: { id } });

            if (!Tutorial) {
                return helper.error(res, "Tutorial not found");
            }

            await db.tutorials.destroy({ where: { id } });
            return helper.success(res, "Tutorial deleted successfully");
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    tutorialStatus: async (req, res) => {
        try {
            const { id, status } = req.body;
            const Tutorial = await db.tutorials.findOne({ where: { id } });
            if (!Tutorial) {
                return helper.error(res, "Tutorial not found");
            }

            await db.tutorials.update({ status }, { where: { id } });

            return helper.success(res, "Tutorial status updated successfully", { id, status });
        } catch (error) {
            return helper.error(res, error.message);
        }
    },
    tutorialUpdate: async (req, res) => {
        try {
            const { id } = req.params;
            const { title, price, description, status } = req.body;

            const v = new Validator(req.body, {

            });

            let errorsResponse = await helper.checkValidation(v);
            if (errorsResponse) {
                return helper.error(res, errorsResponse);
            }

            let existingTutorial = await db.tutorials.findOne({ where: { id } });
            if (!existingTutorial) {
                return helper.error(res, "Tutorial not found");
            }

            const updatedTutorial = await db.tutorials.update(
                {
                    title: title || existingTutorial.title,
                    price: price || existingTutorial.price,
                    description: description || existingTutorial.description,
                    status: status || existingTutorial.status,
                },
                { where: { id }, returning: true }
            );

            if (req.files && req.files.image) {
                const fileCreationPromises = [];

                for (let file of req.files.image) {
                    let filePath = await helper.fileUpload(file);

                    fileCreationPromises.push(
                        db.tutorialImages.create({
                            tutorialId: id,
                            image: filePath,
                        })
                    );
                }

                await Promise.all(fileCreationPromises);
            }

            return helper.success(res, "Tutorial updated successfully", {
                data: updatedTutorial[1],
            });
        } catch (error) {
            console.error("Error details:", error);
            return helper.error(res, "An error occurred while updating the tutorial.");
        }
    },
    imageDelete: async (req, res) => {
        try {
            const { id } = req.params;

            const imageRecord = await db.tutorialImages.findOne({ where: { id } });

            if (!imageRecord) {
                return helper.error400(res, "Image not found");
            }

            const response = await db.tutorialImages.destroy({ where: { id } });

            if (response) {

                return helper.success(res, "Image deleted successfully");
            } else {
                return helper.error400(res, "Failed to delete.");
            }
        } catch (error) {
            console.error(error);
            return helper.error400(res, "Something went wrong");
        }
    }

};
