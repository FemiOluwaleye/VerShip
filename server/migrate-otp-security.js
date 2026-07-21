// Idempotent migration: add the hardened-OTP columns to the users table.
//
// The app boots with sequelize.sync({ alter: false }) (models/index.js), so new columns are NOT
// auto-created. Run this once against each environment's Postgres:
//
//     node migrate-otp-security.js
//
// Safe to re-run: every statement uses ADD COLUMN IF NOT EXISTS.

require('dotenv').config();
const db = require('./models');

const STATEMENTS = [
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otpHash" VARCHAR(255)`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otpPurpose" VARCHAR(32)`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otpLastSentAt" TIMESTAMP WITH TIME ZONE`,
];

(async () => {
    try {
        await db.sequelize.authenticate();
        for (const sql of STATEMENTS) {
            await db.sequelize.query(sql);
            console.log('✅', sql);
        }
        console.log('\nOTP security columns are in place.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
})();
