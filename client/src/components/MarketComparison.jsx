import { useState } from 'react';
import { compareMarkets } from '../services/api';

export default function MarketComparison({ crop }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleCompare = async () => {
    setExpanded(true);
    setLoading(true);
    setError('');
    try {
      const result = await compareMarkets(crop);
      setData(result);
    } catch (err) {
      setError('Could not load market comparison.');
    } finally {
      setLoading(false);
    }
  };

  if (!crop) return null;

  return (
    <div className="mt-6 bg-white rounded-lg shadow-md p-6 border border-gray-100">
      <div className="flex justify-between items-center">
        <h4 className="text-md font-semibold text-gray-700">Compare across markets for {crop}</h4>
        {!expanded && (
          <button
            onClick={handleCompare}
            className="text-sm text-green-700 hover:text-green-800 font-medium"
          >
            Compare →
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-4 space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded"></div>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

      {data && !loading && (
        <div className="mt-4 space-y-2">
          {data.markets.map((m, idx) => (
            <div
              key={m.market}
              className={`flex justify-between items-center px-4 py-3 rounded-md ${
                idx === 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {idx === 0 && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Best</span>}
                <span className="font-medium text-gray-800">{m.market}</span>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-800">₹{m.predicted_price.toLocaleString()}</p>
                <p className="text-xs text-gray-500">current: ₹{m.latest_price.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}