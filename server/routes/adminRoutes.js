const express = require('express');
const router = express.Router();
const { retrainPipeline } = require('../scripts/retrainPipeline');
const ModelMeta = require('../models/ModelMeta');
const adminAuth = require('../middleware/adminAuth');
const { retrainEnabled } = require('../config/features');

router.post('/retrain-now', adminAuth, (req, res) => {
  if (!retrainEnabled) {
    return res.status(403).json({
      error: 'Retraining is turned off on this server. Retrain on your computer and redeploy the model files.',
    });
  }
  res.json({ message: 'Retraining started in background. Check /api/admin/status for progress.' });
  retrainPipeline({ force: true }).catch((err) => console.error('Background retrain error:', err.message));
});

router.get('/status', async (req, res) => {
  try {
    const meta = await ModelMeta.findOne({ key: 'global' });
    const out = meta ? meta.toObject() : { lastTrainingStatus: 'never_run' };
    if (!retrainEnabled) delete out.lastTrainingLog; // logs can contain file paths
    res.json({ ...out, retrainEnabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
