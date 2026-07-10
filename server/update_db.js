const db = require('./models');

async function updateDatabase() {
    try {
        // Check if discount column exists in barrelsprices (dialect-agnostic).
        const queryInterface = db.sequelize.getQueryInterface();
        const columns = await queryInterface.describeTable('barrelsprices');
        if (!columns.discount) {
            await queryInterface.addColumn('barrelsprices', 'discount', {
                type: db.Sequelize.STRING,
                defaultValue: '0',
            });
            console.log("Added 'discount' column to barrelsprices table.");
        } else {
            console.log("'discount' column already exists in barrelsprices table.");
        }

        // Sync user_cookies model (creates table if not exists)
        await db.user_cookies.sync({ alter: true });
        console.log("user_cookies table is synced.");

        process.exit(0);
    } catch (error) {
        console.error("Database update failed:", error);
        process.exit(1);
    }
}

updateDatabase();
