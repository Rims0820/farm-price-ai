const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const COLD_START_MS = 100000;
const MAX_CONCURRENT = 3;                 
const RETRY_DELAYS_MS = [3000, 8000, 20000];
const RETRYABLE_STATUS = [429, 502, 503, 504];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('[mlService] using ML_SERVICE_URL =', ML_URL);

// ---- limit how many requests are in flight at once ----
let active = 0;
const waiting = [];
async function limited(fn) {
  if (active >= MAX_CONCURRENT) await new Promise((resolve) => waiting.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = waiting.shift();
    if (next) next();
  }
}


const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise;
  const promise = fn().catch((err) => {
    cache.delete(key); 
    throw err;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

function toError(err) {
  if (err.response) {
    const error = new Error(err.response.data?.detail || `ML service error (${err.response.status})`);
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

async function request(config) {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await axios({ timeout: COLD_START_MS, ...config })).data;
    } catch (err) {
      const status = err.response?.status;
      console.error('[mlService] request failed:', config.url, '| status:', status, '| code:', err.code);
      const canRetry =
        attempt < RETRY_DELAYS_MS.length && (RETRYABLE_STATUS.includes(status) || err.code === 'ECONNRESET');
      if (!canRetry) throw toError(err);
      const retryAfter = Number(err.response?.headers?.['retry-after']);
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 20000)
        : RETRY_DELAYS_MS[attempt];
      await sleep(wait);
    }
  }
}

const call = (config) => limited(() => request(config));

const MIN = 60 * 1000;
const getPrediction = (crop, market) =>
  call({ method: 'post', url: `${ML_URL}/predict`, data: { crop, market } });
const getAvailableCrops = () => cached('crops', 30 * MIN, () => call({ url: `${ML_URL}/crops` }));
const getAvailableMarkets = () => cached('markets', 30 * MIN, () => call({ url: `${ML_URL}/markets` }));
const getMetrics = () => cached('metrics', 30 * MIN, () => call({ url: `${ML_URL}/model-metrics` }));
const ping = () => cached('ping', 4 * MIN, () => call({ url: `${ML_URL}/health` }));

module.exports = { getPrediction, getAvailableCrops, getAvailableMarkets, getMetrics, ping };