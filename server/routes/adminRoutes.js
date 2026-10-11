const express = require('express');
const router = express.Router();
const { retrainPipeline } = require('../scripts/retrainPipeline');
const ModelMeta = require('../models/ModelMeta');
const adminAuth = require('../middleware/adminAuth');

router.post('/retrain-now', adminAuth, (req, res) => {
  res.json({ message: 'Retraining started in background. Check /api/admin/status for progress.' });
  retrainPipeline({ force: true }).catch((err) => console.error('Background retrain error:', err.message));
});

router.get('/status', async (req, res) => {
  try {
    const meta = await ModelMeta.findOne({ key: 'global' });
    res.json(meta || { lastTrainingStatus: 'never_run' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;