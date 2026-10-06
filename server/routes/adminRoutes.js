const express = require('express');
const router = express.Router();
const { retrainPipeline } = require('../scripts/retrainPipeline');
const ModelMeta = require('../models/ModelMeta');

router.post('/retrain-now', async (req, res) => {
  // respond immediately, run in background (retraining takes time)
  res.json({ message: 'Retraining started in background. Check /api/admin/status for progress.' });
  retrainPipeline().catch(err => console.error('Background retrain error:', err));
});

router.get('/status', async (req, res) => {
  const meta = await ModelMeta.findOne({ key: 'global' });
  res.json(meta || { lastTrainingStatus: 'never_run' });
});

module.exports = router;