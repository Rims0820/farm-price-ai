const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_REQUEST_TIMEOUT_MS = 120000;

function getTargetHost() {
  try {
    return new URL(ML_URL).host;
  } catch {
    return 'invalid ML_SERVICE_URL';
  }
}

function toError(err) {
  if (err.response) {
    console.error('ML service returned an error', {
      target: getTargetHost(),
      status: err.response.status,
    });
    const error = new Error(err.response.data?.detail || 'ML service error');
    error.statusCode = err.response.status;
    return error;
  }
  if (
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ERR_NETWORK' ||
    err.request
  ) {
    console.error('ML service connection failed', {
      target: getTargetHost(),
      code: err.code || 'NO_RESPONSE',
    });
    const error = new Error(
      'ML service is not reachable. Check that ML_SERVICE_URL points to the running ML service.'
    );
    error.statusCode = 503;
    return error;
  }
  console.error('ML service request failed', {
    target: getTargetHost(),
    code: err.code || 'UNKNOWN',
  });
  return err;
}

async function getPrediction(crop, market) {
  try {
    const response = await axios.post(`${ML_URL}/predict`, { crop, market }, {
      timeout: ML_REQUEST_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    throw toError(err);
  }
}

async function getAvailableCrops() {
  try {
    const response = await axios.get(`${ML_URL}/crops`, { timeout: ML_REQUEST_TIMEOUT_MS });
    return response.data;
  } catch (err) {
    throw toError(err);
  }
}

async function getAvailableMarkets() {
  try {
    const response = await axios.get(`${ML_URL}/markets`, { timeout: ML_REQUEST_TIMEOUT_MS });
    return response.data;
  } catch (err) {
    throw toError(err);
  }
}

async function getMetrics() {
  try {
    const response = await axios.get(`${ML_URL}/model-metrics`, { timeout: ML_REQUEST_TIMEOUT_MS });
    return response.data;
  } catch (err) {
    throw toError(err);
  }
}

module.exports = { getPrediction, getAvailableCrops, getAvailableMarkets, getMetrics };
