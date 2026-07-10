const db = require('./models');

async function checkSchema() {
    try {
        const queryInterface = db.sequelize.getQueryInterface();
        const columns = await queryInterface.describeTable('booking_requests');
        console.log("Columns in booking_requests:");
        Object.entries(columns).forEach(([field, def]) => {
            console.log(`${field} - ${def.type}`);
        });
    } catch (error) {
        console.error("Error checking schema:", error);
    } finally {
        process.exit();
    }
}

checkSchema();
