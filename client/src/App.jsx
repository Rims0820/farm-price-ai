import { useState } from 'react';
import PredictionForm from './components/PredictionForm';
import PredictionResult from './components/PredictionResult';
import PriceChart from './components/PriceChart';
import { getPricePrediction, getPriceHistory } from './services/api';

function App() {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePredict = async (crop, market) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const [prediction, priceHistory] = await Promise.all([
        getPricePrediction(crop, market),
        getPriceHistory(crop, market, 24),
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
      <header className="bg-green-700 text-white py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold">Farm Price AI</h1>
          <p className="text-green-100 text-sm mt-1">Next-month crop price forecasts for Indian markets</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
          <PredictionForm onPredict={handlePredict} loading={loading} />
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <PredictionResult result={result} />
        <PriceChart data={history} />
      </main>
    </div>
  );
}

export default App;
