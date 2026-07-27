// Adds users."surveyOther" — the free text captured when a customer picks
// "Other" in the signup survey. sync({alter:false}) won't add a column to an
// existing table, so run this once per environment:
//     node server/migrate-survey-other.js
// Idempotent — safe to re-run.
require('dotenv').config();
const db = require('./models');

(async () => {
  try {
    await db.sequelize.authenticate();
    await db.sequelize.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "surveyOther" VARCHAR(500) DEFAULT ''`
    );
    console.log('✓ users."surveyOther" present');

    const [[row]] = await db.sequelize.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE "surveyOther" IS NOT NULL AND "surveyOther" <> ''`
    );
    console.log(`  rows with free-text answers: ${row.n}`);
    process.exit(0);
  } catch (e) {
    console.error('MIGRATE SURVEY OTHER FAILED:', e);
    process.exit(1);
  }
})();
