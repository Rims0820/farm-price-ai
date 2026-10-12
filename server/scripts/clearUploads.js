require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const PriceHistory = require('../models/PriceHistory');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const r = await PriceHistory.deleteMany({ source: 'upload' });
  console.log('Deleted uploaded rows:', r.deletedCount);
  process.exit(0);
});