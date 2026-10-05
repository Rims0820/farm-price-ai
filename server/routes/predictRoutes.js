const express = require('express');
const router = express.Router();
const { predictPrice, getCrops, getMarketsFromML } = require('../controllers/predictController');
const { compareMarkets } = require('../controllers/compareController');

router.post('/predict', predictPrice);
router.get('/ml-crops', getCrops);
router.get('/ml-markets', getMarketsFromML);
router.post('/predict', predictPrice);
router.get('/ml-crops', getCrops);
router.get('/ml-markets', getMarketsFromML);
router.get('/compare', compareMarkets);

module.exports = router;