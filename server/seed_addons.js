const db = require('./models');

async function seedAddons() {
    try {
        // Sync the addons model specifically
        await db.addons.sync({ alter: true });
        console.log('Database synced');

        const initialAddons = [
            { name: 'Customs Clearance', price_in_percent: 5.0, status: 1 },
            { name: 'Cargo Insurance', price_in_percent: 2.5, status: 1 },
            { name: 'Pre & Post-Shipment Inspection', price_in_percent: 3.0, status: 1 }
        ];

        for (const addon of initialAddons) {
            await db.addons.findOrCreate({
                where: { name: addon.name },
                defaults: addon
            });
        }

        console.log('Addons seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding addons:', error);
        process.exit(1);
    }
}

seedAddons();
