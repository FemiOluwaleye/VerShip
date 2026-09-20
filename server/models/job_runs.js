const Sequelize = require('sequelize');
// Last-run bookkeeping for in-process scheduled jobs (payout reminders), so two
// server instances — or a restart — can't send the same reminder twice.
module.exports = function (sequelize, DataTypes) {
    return sequelize.define('job_runs', {
        name: { type: DataTypes.STRING(64), allowNull: false, primaryKey: true },
        last_run_at: { type: DataTypes.DATE, allowNull: true },
        last_result: { type: DataTypes.TEXT, allowNull: true },
    }, { tableName: 'job_runs', timestamps: true });
};
