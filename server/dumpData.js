const db = require('./models');

async function dumpBarrelPrices() {
    try {
        const results = await db.barrelsprices.findAll({
            attributes: ['originCountry', 'destinationCountry', 'type', 'id']
        });
        console.log("Data in barrelsprices:");
        results.forEach(row => {
            console.log(`${row.originCountry} -> ${row.destinationCountry} (${row.type}) [id:${row.id}]`);
        });
    } catch (error) {
        console.error("Error dumping barrelsprices:", error);
    } finally {
        process.exit();
    }
}

dumpBarrelPrices();
