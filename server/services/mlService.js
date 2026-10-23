const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const COLD_START_MS = 100000;

console.log('[mlService] using ML_SERVICE_URL =', ML_URL);

function toError(err) {
  if (err.response) {
    const error = new Error(err.response.data?.detail || 'ML service error');
    error.statusCode = err.response.status;
    return error;
  }
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    const error = new Error('The forecast service is still waking up. Please try again in a minute.');
    error.statusCode = 504;
    return error;
  }
  if (['ECONNREFUSED', 'ENOTFOUND', 'ERR_INVALID_URL', 'ECONNRESET'].includes(err.code)) {
    const error = new Error(`ML service is not reachable (${err.code}). Check that ML_SERVICE_URL points to the running ML service.`);
    error.statusCode = 503;
    return error;
  }
  return err;
}

async function call(config) {
  try {
    return (await axios({ timeout: COLD_START_MS, ...config })).data;
  } catch (err) {
    console.error('[mlService] request failed:', config.url, '| code:', err.code, '| message:', err.message);
    throw toError(err);
  }
}

const getPrediction = (crop, market) =>
  call({ method: 'post', url: `${ML_URL}/predict`, data: { crop, market } });
const getAvailableCrops = () => call({ url: `${ML_URL}/crops` });
const getAvailableMarkets = () => call({ url: `${ML_URL}/markets` });
const getMetrics = () => call({ url: `${ML_URL}/model-metrics` });
const ping = () => call({ url: `${ML_URL}/health` });

module.exports = { getPrediction, getAvailableCrops, getAvailableMarkets, getMetrics, ping };