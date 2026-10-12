const express = require('express');
const router = express.Router();
const PriceHistory = require('../models/PriceHistory');

// GET /api/crops - list all distinct crops
router.get('/crops', async (req, res) => {
  try {
    res.json(await PriceHistory.distinct('crop'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/markets - list all distinct markets (optionally filter by state)
router.get('/markets', async (req, res) => {
  try {
    const filter = req.query.state ? { state: req.query.state } : {};
    res.json(await PriceHistory.find(filter).distinct('market'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prices?crop=Onion&market=Pune&limit=36 - the MOST RECENT `limit` records, oldest first
router.get('/prices', async (req, res) => {
  try {
    const { crop, market } = req.query;
    if (!crop || !market) {
      return res.status(400).json({ error: 'crop and market query params are required' });
    }
    const limit = Math.min(parseInt(req.query.limit) || 36, 500);
    const data = await PriceHistory.find({ crop, market }).sort({ date: -1 }).limit(limit);
    res.json(data.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
