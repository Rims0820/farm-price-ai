const mlService = require('../services/mlService');
const Prediction = require('../models/Prediction');

exports.compareMarkets = async (req, res) => {
  const { crop } = req.query;

  if (!crop) {
    return res.status(400).json({ error: 'crop query param is required' });
  }

  try {
    const markets = await mlService.getAvailableMarkets();

    const results = await Promise.allSettled(
      markets.map(async (market) => {
        const cached = await Prediction.findOne({ crop, market });
        const cacheIsValid = cached &&
          (Date.now() - new Date(cached.generatedAt).getTime()) < 24 * 60 * 60 * 1000;

        if (cacheIsValid) {
          return {
            market,
            predicted_price: cached.predictedPrice,
            latest_price: cached.latestKnownPrice,
          };
        }

        const prediction = await mlService.getPrediction(crop, market);

        await Prediction.findOneAndUpdate(
          { crop, market },
          {
            crop, market,
            predictedPrice: prediction.predicted_next_month_price,
            latestKnownDate: prediction.latest_known_date,
            latestKnownPrice: prediction.latest_known_price,
            confidenceLower: prediction.confidence_range.lower,
            confidenceUpper: prediction.confidence_range.upper,
            generatedAt: new Date()
          },
          { upsert: true }
        );

        return {
          market,
          predicted_price: prediction.predicted_next_month_price,
          latest_price: prediction.latest_known_price,
        };
      })
    );

    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => b.predicted_price - a.predicted_price);

    res.json({ crop, markets: successful });

  } catch (err) {
    console.error('Compare error:', err.message);
    res.status(500).json({ error: 'Failed to compare markets' });
  }
};