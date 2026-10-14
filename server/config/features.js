
const retrainEnabled = process.env.RETRAIN_ENABLED
  ? process.env.RETRAIN_ENABLED === 'true'
  : process.env.NODE_ENV !== 'production';

module.exports = { retrainEnabled };