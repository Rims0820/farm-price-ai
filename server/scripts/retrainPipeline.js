const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const PriceHistory = require('../models/PriceHistory');
const ModelMeta = require('../models/ModelMeta');
const Prediction = require('../models/Prediction');

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

function getScripts() {
  const scripts = [
    'aggregate.py',
    'feature_engineering.py',
    'train_model.py',
    'train_final_model.py'
  ];
  // An ensemble trained earlier must be retrained too, or it goes stale.
  if (fs.existsSync(path.join(ML_SERVICE_DIR, 'models', 'rf_model.pkl'))) {
    scripts.push('train_ensemble.py');
  }
  return scripts;
}

async function shouldRetrain() {
  const currentCount = await PriceHistory.countDocuments();
  const meta = await ModelMeta.findOne({ key: 'global' });

  if (!meta || !meta.lastTrainedAt) {
    console.log('No previous training run found — retraining.');
    return { retrain: true, currentCount };
  }

  // Absolute change: rows can also DROP (e.g. demo data removed)
  const changedRows = Math.abs(currentCount - meta.lastDataCountAtTraining);
  console.log(`Current rows: ${currentCount}, rows at last training: ${meta.lastDataCountAtTraining}`);
  console.log(`Rows changed since last training: ${changedRows}`);

  const THRESHOLD = 50;
  return { retrain: changedRows >= THRESHOLD, currentCount };
}

async function saveMeta(fields) {
  await ModelMeta.findOneAndUpdate({ key: 'global' }, fields, { upsert: true });
}

async function runRetrainPipeline({ force = false } = {}) {
  const shouldManageConnection = mongoose.connection.readyState === 0;
  let log = '';

  try {
    if (shouldManageConnection) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    const decision = await shouldRetrain();
    const currentCount = decision.currentCount;

    if (!force && !decision.retrain) {
      console.log('Not enough new data to justify retraining. Skipping.');
      return;
    }

    console.log('Starting retrain pipeline...');
    log = appendLog(log, 'Training started.\n');
    await saveMeta({ lastTrainingStatus: 'in_progress', lastTrainingLog: log });

    for (const scriptName of getScripts()) {
      log = appendLog(log, `\n--- ${scriptName} ---\n`);
      await saveMeta({ lastTrainingStatus: 'in_progress', lastTrainingLog: log });

      log = appendLog(log, await runScript(scriptName));
      await saveMeta({ lastTrainingStatus: 'in_progress', lastTrainingLog: log });
    }

    try {
      await axios.post(`${process.env.ML_SERVICE_URL || 'http://localhost:8000'}/reload-model`);
      console.log('ML service notified to reload model.');
    } catch (reloadErr) {
      log = appendLog(log, `\nModel reload warning: ${reloadErr.message}\n`);
      console.warn('Could not notify ML service to reload (is it running?):', reloadErr.message);
    }

    await Prediction.deleteMany({}); // cached forecasts came from the old model

    log = appendLog(log, '\nRetraining pipeline completed successfully.\n');
    await saveMeta({
      lastTrainedAt: new Date(),
      lastDataCountAtTraining: currentCount,
      lastTrainingStatus: 'success',
      lastTrainingLog: log
    });
    console.log('Retraining pipeline completed successfully.');
  } catch (err) {
    log = appendLog(log, `\nRetraining failed:\n${err.message}\n`);
    console.error('Retraining failed:', err.message);
    try {
      await saveMeta({ lastTrainingStatus: 'failed', lastTrainingLog: log });
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

function retrainPipeline(options) {
  if (!activePipeline) {
    activePipeline = runRetrainPipeline(options).finally(() => {
      activePipeline = null;
    });
  }
  return activePipeline;
}

module.exports = { retrainPipeline };

// node scripts/retrainPipeline.js   (add --force to skip the row-count check)
if (require.main === module) {
  retrainPipeline({ force: process.argv.includes('--force') })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}