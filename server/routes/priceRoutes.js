const express = require('express');
const router = express.Router();
const PriceHistory = require('../models/PriceHistory');

// GET /api/crops - list all distinct crops
router.get('/crops', async (req, res) => {
  try {
    const crops = await PriceHistory.distinct('crop');
    res.json(crops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/markets - list all distinct markets (optionally filter by state)
router.get('/markets', async (req, res) => {
  try {
    const filter = req.query.state ? { state: req.query.state } : {};
    const markets = await PriceHistory.find(filter).distinct('market');
    res.json(markets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prices?crop=Onion&market=Pune - historical prices for charting
router.get('/prices', async (req, res) => {
  try {
    const { crop, market, limit = 200 } = req.query;
    if (!crop || !market) {
      return res.status(400).json({ error: 'crop and market query params are required' });
    }
    const data = await PriceHistory.find({ crop, market })
      .sort({ date: 1 })
      .limit(parseInt(limit));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;