import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ML_API_URL = import.meta.env.VITE_ML_API_URL || 'https://farm-price-ai-ubhu.onrender.com';
const ML_REQUEST_TIMEOUT_MS = 120000;
const ML_FALLBACK_STATUSES = new Set([429, 502, 503, 504]);

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

const mlApi = axios.create({
  baseURL: ML_API_URL,
  timeout: ML_REQUEST_TIMEOUT_MS,
});

const adminHeaders = (key) => (key ? { 'x-admin-key': key } : {});

const withDirectMlFallback = async (apiRequest, mlRequest) => {
  try {
    return (await apiRequest()).data;
  } catch (err) {
    const shouldFallback = !err.response || ML_FALLBACK_STATUSES.has(err.response.status);
    if (!shouldFallback) throw err;
    return (await mlRequest()).data;
  }
};

export const getCrops = () =>
  withDirectMlFallback(
    () => api.get('/ml-crops', { timeout: ML_REQUEST_TIMEOUT_MS }),
    () => mlApi.get('/crops'),
  );

export const getMarkets = () =>
  withDirectMlFallback(
    () => api.get('/ml-markets', { timeout: ML_REQUEST_TIMEOUT_MS }),
    () => mlApi.get('/markets'),
  );

export const getPricePrediction = (crop, market) =>
  withDirectMlFallback(
    () => api.post('/predict', { crop, market }, { timeout: ML_REQUEST_TIMEOUT_MS }),
    () => mlApi.post('/predict', { crop, market }),
  );

export const getPriceHistory = async (crop, market, limit = 36) =>
  (await api.get('/prices', { params: { crop, market, limit } })).data;

export const compareMarkets = async (crop) =>
  (await api.get('/compare', { params: { crop } })).data;

export const getModelMetrics = () =>
  withDirectMlFallback(
    () => api.get('/metrics', { timeout: ML_REQUEST_TIMEOUT_MS }),
    () => mlApi.get('/model-metrics'),
  );

export const getDataSummary = async () => (await api.get('/data/summary')).data;

export const uploadCsv = async (file, adminKey, onProgress) => {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/data/upload', form, {
    timeout: 300000,
    headers: adminHeaders(adminKey),
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
  return res.data;
};

export const deleteDemoData = async (adminKey) =>
  (await api.delete('/data/demo', { headers: adminHeaders(adminKey) })).data;

export const triggerRetrain = async (adminKey) =>
  (await api.post('/admin/retrain-now', {}, { headers: adminHeaders(adminKey) })).data;

export const getRetrainStatus = async () => (await api.get('/admin/status')).data;

export default api;
