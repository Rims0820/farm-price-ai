import { useState } from 'react';
import PredictionForm from '../components/PredictionForm';
import PredictionResult from '../components/PredictionResult';
import AdviceCard from '../components/AdviceCard';
import PriceChart from '../components/PriceChart';
import LoadingSkeleton from '../components/LoadingSkeleton';
import MarketComparison from '../components/MarketComparison';
import { getPricePrediction, getPriceHistory } from '../services/api';

export default function Forecast() {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastCrop, setLastCrop] = useState('');

  const handlePredict = async (crop, market) => {
    setLoading(true);
    setError('');
    setResult(null);
    setLastCrop(crop);

    try {
      const [prediction, priceHistory] = await Promise.all([
        getPricePrediction(crop, market),
        getPriceHistory(crop, market, 36),
      ]);
      setResult(prediction);
      setHistory(priceHistory);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-100">
        <PredictionForm onPredict={handlePredict} loading={loading} />
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && result && (
        <>
          <AdviceCard result={result} />
          <PredictionResult result={result} />
          <PriceChart data={history} prediction={result} />
          <MarketComparison crop={lastCrop} />
        </>
      )}
    </>
  );
}
