const cron = require('node-cron');
const { retrainPipeline } = require('../scripts/retrainPipeline');

function startScheduler() {
  // Every day at 2:00 AM server time
  cron.schedule('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Scheduled retrain check starting...`);
    try {
      await retrainPipeline();
    } catch (err) {
      console.error('Scheduled retrain failed:', err.message);
    }
  });

  console.log('Retrain scheduler started (daily at 2:00 AM).');
}

module.exports = { startScheduler };