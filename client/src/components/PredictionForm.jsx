import { useState, useEffect } from 'react';
import { getCrops, getMarkets } from '../services/api';

export default function PredictionForm({ onPredict, loading }) {
  const [crops, setCrops] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadOptions() {
      try {
        const [cropList, marketList] = await Promise.all([getCrops(), getMarkets()]);
        setCrops(cropList);
        setMarkets(marketList);
        if (cropList.length) setSelectedCrop(cropList[0]);
        if (marketList.length) setSelectedMarket(marketList[0]);
      } catch (err) {
        setError('Could not load crop/market list. Is the backend running?');
      } finally {
        setLoadingOptions(false);
      }
    }
    loadOptions();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCrop || !selectedMarket) return;
    onPredict(selectedCrop, selectedMarket);
  };

  if (loadingOptions) {
    return <p className="text-gray-500">Loading crops and markets...</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">Crop</label>
        <select
          value={selectedCrop}
          onChange={(e) => setSelectedCrop(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {crops.map((crop) => (
            <option key={crop} value={crop}>{crop}</option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">Market</label>
        <select
          value={selectedMarket}
          onChange={(e) => setSelectedMarket(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {markets.map((market) => (
            <option key={market} value={market}>{market}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium px-6 py-2 rounded-md transition"
      >
        {loading ? 'Predicting...' : 'Predict Price'}
      </button>
    </form>
  );
}