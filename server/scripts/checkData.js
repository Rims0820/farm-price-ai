const mongoose = require('mongoose');
require('dotenv').config();
const PriceHistory = require('../models/PriceHistory');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const total = await PriceHistory.countDocuments();
  const crops = await PriceHistory.distinct('crop');
  const markets = await PriceHistory.distinct('market');
  const sample = await PriceHistory.findOne({ crop: 'Onion' }).sort({ date: -1 });

  console.log('Total documents:', total);
  console.log('Crops:', crops);
  console.log('Markets:', markets);
  console.log('Sample (latest Onion record):', sample);

  await mongoose.disconnect();
}
check();