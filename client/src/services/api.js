import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

export const getCrops = async () => {
  const res = await api.get('/ml-crops');
  return res.data;
};

export const getMarkets = async () => {
  const res = await api.get('/ml-markets');
  return res.data;
};

export const getPricePrediction = async (crop, market) => {
  const res = await api.post('/predict', { crop, market });
  return res.data;
};

export const getPriceHistory = async (crop, market, limit = 24) => {
  const res = await api.get('/prices', { params: { crop, market, limit } });
  return res.data;
};

export const compareMarkets = async (crop) => {
  const res = await api.get('/compare', { params: { crop } });
  return res.data;
};

const adminHeaders = (key) => (key ? { 'x-admin-key': key } : {});

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

export const getModelMetrics = async () => (await api.get('/metrics')).data;

export default api;