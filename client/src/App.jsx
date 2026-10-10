import { useState } from 'react';
import PredictionForm from './components/PredictionForm';
import PredictionResult from './components/PredictionResult';
import PriceChart from './components/PriceChart';
import LoadingSkeleton from './components/LoadingSkeleton';
import MarketComparison from './components/MarketComparison';
import { getPricePrediction, getPriceHistory } from './services/api';
import AdviceCard from './components/AdviceCard';

function App() {
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
      const message = err.response?.data?.error || 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white py-5 px-4 sm:py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold">Farm Price AI</h1>
          <p className="text-green-100 text-xs sm:text-sm mt-1">Next-month crop price forecasts for Indian markets</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
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
      </main>

      <footer className="text-center text-xs text-gray-400 py-6">
        Forecasts are AI-generated estimates based on historical trends — not financial advice.
      </footer>
    </div>
  );
}

export default App;
