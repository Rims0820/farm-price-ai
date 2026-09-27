const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  crop: { type: String, required: true, index: true },
  state: { type: String, required: true },
  market: { type: String, required: true },
  date: { type: Date, required: true, index: true },
  minPrice: Number,
  maxPrice: Number,
  modalPrice: { type: Number, required: true },
  unit: { type: String, default: 'INR/quintal' },
  source: { type: String, default: 'seed' }
}, { timestamps: true });

priceHistorySchema.index({ crop: 1, market: 1, date: 1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);