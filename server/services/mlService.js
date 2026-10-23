const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

function toError(err) {
  if (err.response) {
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
    const error = new Error(
      'ML service is not reachable. Check that ML_SERVICE_URL points to the running ML service.'
    );
    error.statusCode = 503;
    return error;
  }
  return err;
}

async function getPrediction(crop, market) {
  try {
    const response = await axios.post(`${ML_URL}/predict`, { crop, market }, { timeout: 10000 });
    return response.data;
  } catch (err) {
    throw toError(err);
  }
}

async function getAvailableCrops() {
  try {
    const response = await axios.get(`${ML_URL}/crops`, { timeout: 5000 });
    return response.data;
  } catch (err) {
    throw toError(err);
  }
}

async function getAvailableMarkets() {
  try {
    const response = await axios.get(`${ML_URL}/markets`, { timeout: 5000 });
    return response.data;
  } catch (err) {
    throw toError(err);
  }
}

async function getMetrics() {
  try {
    const response = await axios.get(`${ML_URL}/model-metrics`, { timeout: 10000 });
    return response.data;
  } catch (err) {
    throw toError(err);
  }
}

module.exports = { getPrediction, getAvailableCrops, getAvailableMarkets, getMetrics };
