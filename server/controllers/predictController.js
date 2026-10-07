const Prediction = require('../models/Prediction');
const mlService = require('../services/mlService');

const CACHE_TTL_HOURS = 24;

exports.predictPrice = async (req, res) => {
  const { crop, market } = req.body;

  if (!crop || !market) {
    return res.status(400).json({ error: 'crop and market are required fields' });
  }

  try {
    // 1. Check cache first
    const cached = await Prediction.findOne({ crop, market });
    const cacheIsValid = cached &&
      (Date.now() - new Date(cached.generatedAt).getTime()) < CACHE_TTL_HOURS * 60 * 60 * 1000;

    if (cacheIsValid) {
      return res.json({
        crop: cached.crop,
        market: cached.market,
        latest_known_date: cached.latestKnownDate,
        latest_known_price: cached.latestKnownPrice,
        predicted_next_month_price: cached.predictedPrice,
        confidence_range: { lower: cached.confidenceLower, upper: cached.confidenceUpper },
        cached: true,
        generated_at: cached.generatedAt
      });
    }

    // 2. Cache miss or stale — call the ML service
    const result = await mlService.getPrediction(crop, market);

    // 3. Upsert into cache
    await Prediction.findOneAndUpdate(
      { crop, market },
      {
        crop,
        market,
        predictedPrice: result.predicted_next_month_price,
        latestKnownDate: result.latest_known_date,
        latestKnownPrice: result.latest_known_price,
        confidenceLower: result.confidence_range.lower,
        confidenceUpper: result.confidence_range.upper,
        explanation: result.explanation,
        generatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ ...result, cached: false });

  } catch (err) {
    console.error('Prediction error:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.getCrops = async (req, res) => {
  try {
    const crops = await mlService.getAvailableCrops();
    res.json(crops);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.getMarketsFromML = async (req, res) => {
  try {
    const markets = await mlService.getAvailableMarkets();
    res.json(markets);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};