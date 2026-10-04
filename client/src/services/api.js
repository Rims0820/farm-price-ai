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

export default api;