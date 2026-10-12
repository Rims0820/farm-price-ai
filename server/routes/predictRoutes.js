const express = require('express');
const router = express.Router();
const { predictPrice, getCrops, getMarketsFromML } = require('../controllers/predictController');
const { compareMarkets } = require('../controllers/compareController');
const mlService = require('../services/mlService');

router.post('/predict', predictPrice);
router.get('/ml-crops', getCrops);
router.get('/ml-markets', getMarketsFromML);
router.get('/compare', compareMarkets);

router.get('/metrics', async (req, res) => {
  try {
    res.json(await mlService.getMetrics());
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
