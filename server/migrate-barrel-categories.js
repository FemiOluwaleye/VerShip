// Adds prepacked_barrel_items.category and backfills the existing rows into the
// three public groups (Food / Household Items / Personal Care).
//
// sequelize.sync({alter:false}) creates missing TABLES but never adds a column
// to an existing one, so this has to run once per environment:
//     node server/migrate-barrel-categories.js
// Idempotent — safe to re-run.
require('dotenv').config();
const db = require('./models');

// Everything not named here is food, which is the overwhelming majority of the
// barrel and also the model's column default.
const HOUSEHOLD = [
  'Toilet Paper',
  'Paper Towel',
  'Trash Bag',
];
const PERSONAL_CARE = [
  'Colgate Toothpaste',
  'Irish Spring Bath Soap',
  'Always Ultra-Thin w/Wings',
  'Adult Toothbrush',
  'Equate Mouthwash',
];

(async () => {
  try {
    await db.sequelize.authenticate();

    await db.sequelize.query(
      `ALTER TABLE prepacked_barrel_items
         ADD COLUMN IF NOT EXISTS category VARCHAR(255) NOT NULL DEFAULT 'Food'`
    );
    console.log('✓ prepacked_barrel_items.category present');

    // Backfill: only touch rows still sitting on the default, so an owner who has
    // already re-categorised something in the admin panel keeps their choice.
    const [, hh] = await db.sequelize.query(
      `UPDATE prepacked_barrel_items SET category = 'Household Items'
        WHERE category = 'Food' AND name IN (:names)`,
      { replacements: { names: HOUSEHOLD } }
    );
    const [, pc] = await db.sequelize.query(
      `UPDATE prepacked_barrel_items SET category = 'Personal Care'
        WHERE category = 'Food' AND name IN (:names)`,
      { replacements: { names: PERSONAL_CARE } }
    );
    console.log(`✓ backfilled: ${hh?.rowCount ?? 0} household, ${pc?.rowCount ?? 0} personal care`);

    const [rows] = await db.sequelize.query(
      `SELECT category, COUNT(*)::int AS n FROM prepacked_barrel_items
        WHERE "deletedAt" IS NULL GROUP BY category ORDER BY category`
    );
    console.table(rows);

    process.exit(0);
  } catch (e) {
    console.error('MIGRATE BARREL CATEGORIES FAILED:', e);
    process.exit(1);
  }
})();
