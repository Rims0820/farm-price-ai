const cron = require('node-cron');
const { retrainPipeline } = require('../scripts/retrainPipeline');
const { retrainEnabled } = require('../config/features');

function startScheduler() {
  if (!retrainEnabled) {
    console.log('Retrain scheduler disabled (retraining is off on this server).');
    return;
  }

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

