const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    dialect: config.dialect,
    logging: console.log
});

async function addColumns() {
    try {
        const queryInterface = sequelize.getQueryInterface();

        // Users table
        const usersTable = await queryInterface.describeTable('users');
        if (!usersTable.full_address) {
            await queryInterface.addColumn('users', 'full_address', {
                type: DataTypes.STRING(255),
                allowNull: true,
                defaultValue: ""
            });
            console.log('Added full_address to users');
        }
        if (!usersTable.suite_apt_building) {
            await queryInterface.addColumn('users', 'suite_apt_building', {
                type: DataTypes.STRING(255),
                allowNull: true,
                defaultValue: ""
            });
            console.log('Added suite_apt_building to users');
        }

        // Bookings table
        const bookingsTable = await queryInterface.describeTable('bookings');
        const bookingColumns = [
            'primary_suite_apt_building', 'primary_full_address',
            'secondary_suite_apt_building', 'secondary_full_address',
            'shiper_suite_apt_building', 'shiper_full_address',
            'consignee_suite_apt_building', 'consignee_full_address'
        ];

        for (const col of bookingColumns) {
            if (!bookingsTable[col]) {
                await queryInterface.addColumn('bookings', col, {
                    type: DataTypes.STRING(255),
                    allowNull: true,
                    defaultValue: ""
                });
                console.log(`Added ${col} to bookings`);
            }
        }

        console.log('Database update completed successfully.');
    } catch (error) {
        console.error('Error updating database:', error);
    } finally {
        await sequelize.close();
    }
}

addColumns();
