const { execFile } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const PriceHistory = require('../models/PriceHistory');
const ModelMeta = require('../models/ModelMeta');

const ML_SERVICE_DIR = path.join(__dirname, '..', '..', 'ml-service');
const VENV_PYTHON = process.platform === 'win32'
  ? path.join(ML_SERVICE_DIR, '.venv', 'Scripts', 'python.exe')
  : path.join(ML_SERVICE_DIR, '.venv', 'bin', 'python');
const MAX_LOG_CHARS = 10000;
let activePipeline;

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    execFile(VENV_PYTHON, [scriptName], {
      cwd: ML_SERVICE_DIR,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8'
    }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join('\n');
      if (error) {
        reject(new Error(`${scriptName} failed: ${output || error.message}`));
        return;
      }
      console.log(`[${scriptName}] completed`);
      resolve(output);
    });
  });
}

function appendLog(log, text) {
  const combined = `${log}${text}`.replace(/\r\n?/g, '\n');
  if (combined.length <= MAX_LOG_CHARS) return combined;

  const tail = combined.slice(-MAX_LOG_CHARS);
  const firstNewline = tail.indexOf('\n');
  return firstNewline === -1 ? tail : tail.slice(firstNewline + 1);
}

async function shouldRetrain() {
  const currentCount = await PriceHistory.countDocuments();
  const meta = await ModelMeta.findOne({ key: 'global' });

  if (!meta || !meta.lastTrainedAt) {
    console.log('No previous training run found — retraining.');
    return { retrain: true, currentCount };
  }

  const newRowsSinceLastTrain = currentCount - meta.lastDataCountAtTraining;
  console.log(`Current rows: ${currentCount}, rows at last training: ${meta.lastDataCountAtTraining}`);
  console.log(`New rows since last training: ${newRowsSinceLastTrain}`);

  // Retrain only if meaningful new data has arrived (threshold avoids retraining on tiny changes)
  const THRESHOLD = 50;
  return { retrain: newRowsSinceLastTrain >= THRESHOLD, currentCount };
}

async function runRetrainPipeline() {
  // Only manage the connection ourselves if nothing is already connected.
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const shouldManageConnection = mongoose.connection.readyState === 0;
  let log = '';

  try {
    if (shouldManageConnection) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    const { retrain, currentCount } = await shouldRetrain();

    if (!retrain) {
      console.log('Not enough new data to justify retraining. Skipping.');
      return;
    }

    console.log('Starting retrain pipeline...');
    log = appendLog(log, 'Training started.\n');
    await ModelMeta.findOneAndUpdate(
      { key: 'global' },
      { lastTrainingStatus: 'in_progress', lastTrainingLog: log },
      { upsert: true }
    );

    for (const scriptName of [
      'aggregate.py',
      'feature_engineering.py',
      'train_model.py',
      'train_final_model.py',
      'train_ensemble.py'
    ]) {
      log = appendLog(log, `\n--- ${scriptName} ---\n`);
      await ModelMeta.findOneAndUpdate(
        { key: 'global' },
        { lastTrainingStatus: 'in_progress', lastTrainingLog: log },
        { upsert: true }
      );

      log = appendLog(log, await runScript(scriptName));
      await ModelMeta.findOneAndUpdate(
        { key: 'global' },
        { lastTrainingStatus: 'in_progress', lastTrainingLog: log },
        { upsert: true }
      );
    }

    // Tell the ML service to reload the freshly trained model
    try {
      await axios.post(`${process.env.ML_SERVICE_URL || 'http://localhost:8000'}/reload-model`);
      console.log('ML service notified to reload model.');
    } catch (reloadErr) {
      const message = `Model reload warning: ${reloadErr.message}`;
      log = appendLog(log, `\n${message}\n`);
      console.warn('Could not notify ML service to reload (is it running?):', reloadErr.message);
    }

    log = appendLog(log, '\nRetraining pipeline completed successfully.\n');
    await ModelMeta.findOneAndUpdate(
      { key: 'global' },
      {
        lastTrainedAt: new Date(),
        lastDataCountAtTraining: currentCount,
        lastTrainingStatus: 'success',
        lastTrainingLog: log
      },
      { upsert: true }
    );
    console.log('Retraining pipeline completed successfully.');
  } catch (err) {
    log = appendLog(log, `\nRetraining failed:\n${err.message}\n`);
    console.error('Retraining failed:', err.message);
    try {
      await ModelMeta.findOneAndUpdate(
        { key: 'global' },
        { lastTrainingStatus: 'failed', lastTrainingLog: log },
        { upsert: true }
      );
    } catch (metaErr) {
      console.error('Could not save failed training status:', metaErr.message);
    }
    throw err;
  } finally {
    if (shouldManageConnection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

function retrainPipeline() {
  if (!activePipeline) {
    activePipeline = runRetrainPipeline().finally(() => {
      activePipeline = null;
    });
  }
  return activePipeline;
}

module.exports = { retrainPipeline };

// Allow running directly: node scripts/retrainPipeline.js
if (require.main === module) {
  retrainPipeline()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}