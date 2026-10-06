const mongoose = require('mongoose');

const modelMetaSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  lastTrainedAt: { type: Date },
  lastDataCountAtTraining: { type: Number, default: 0 },
  lastTrainingStatus: { type: String, default: 'never_run' }, // never_run | in_progress | success | failed
  lastTrainingLog: { type: String, default: '' }
});

module.exports = mongoose.model('ModelMeta', modelMetaSchema);