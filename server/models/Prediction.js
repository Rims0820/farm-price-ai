const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  crop: { type: String, required: true },
  market: { type: String, required: true },
  predictedPrice: { type: Number, required: true },
  latestKnownDate: { type: String },
  latestKnownPrice: { type: Number },
  confidenceLower: { type: Number },
  confidenceUpper: { type: Number },
  generatedAt: { type: Date, default: Date.now }
});

// one cached prediction per crop+market; refresh after 24 hours
predictionSchema.index({ crop: 1, market: 1 }, { unique: true });

module.exports = mongoose.model('Prediction', predictionSchema);