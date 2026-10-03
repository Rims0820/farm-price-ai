const express = require('express');
const router = express.Router();
const { predictPrice, getCrops, getMarketsFromML } = require('../controllers/predictController');

router.post('/predict', predictPrice);
router.get('/ml-crops', getCrops);
router.get('/ml-markets', getMarketsFromML);

module.exports = router;