const mongoose = require('mongoose');
require('dotenv').config();
const Prediction = require('../models/Prediction');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const all = await Prediction.find();
  console.log(`${all.length} cached predictions:`);
  console.log(all);
  await mongoose.disconnect();
}
check();