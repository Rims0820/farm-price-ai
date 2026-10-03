const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function getPrediction(crop, market) {
  try {
    const response = await axios.post(`${ML_URL}/predict`, { crop, market }, {
      timeout: 10000
    });
    return response.data;
  } catch (err) {
    if (err.response) {
      // ML service responded with an error (e.g. 404 for unknown crop)
      const error = new Error(err.response.data.detail || 'ML service error');
      error.statusCode = err.response.status;
      throw error;
    } else if (err.code === 'ECONNREFUSED') {
      const error = new Error('ML service is not reachable. Make sure it is running on port 8000.');
      error.statusCode = 503;
      throw error;
    } else {
      throw err;
    }
  }
}

async function getAvailableCrops() {
  const response = await axios.get(`${ML_URL}/crops`, { timeout: 5000 });
  return response.data;
}

async function getAvailableMarkets() {
  const response = await axios.get(`${ML_URL}/markets`, { timeout: 5000 });
  return response.data;
}

module.exports = { getPrediction, getAvailableCrops, getAvailableMarkets };