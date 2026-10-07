export default function PredictionResult({ result }) {
  if (!result) return null;

  const { crop, market, latest_known_date, latest_known_price, predicted_next_month_price, confidence_range, cached } = result;

  const change = predicted_next_month_price - latest_known_price;
  const changePercent = (change / latest_known_price) * 100;
  const isIncrease = change >= 0;

  return (
    <div className="mt-6 bg-white rounded-lg shadow-md p-6 border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{crop} — {market}</h3>
          <p className="text-sm text-gray-500">Latest data: {latest_known_date}</p>
        </div>
        {cached && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">cached</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-500">Current Price</p>
          <p className="text-2xl font-bold text-gray-800">₹{latest_known_price.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Predicted Next Month</p>
          <p className="text-2xl font-bold text-green-700">₹{predicted_next_month_price.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className={`text-sm font-medium ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
          {isIncrease ? '▲' : '▼'} {Math.abs(changePercent).toFixed(1)}% {isIncrease ? 'increase' : 'decrease'} expected
        </span>
      </div>

      <div className="mt-3 text-sm text-gray-500">
        Confidence range: ₹{confidence_range.lower.toLocaleString()} – ₹{confidence_range.upper.toLocaleString()}
      </div>
            {result.explanation && result.explanation.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-2">Why this prediction?</p>
          <ul className="space-y-1.5">
            {result.explanation.map((item, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                <span className={item.effect === 'increased' ? 'text-green-600' : 'text-red-600'}>
                  {item.effect === 'increased' ? '▲' : '▼'}
                </span>
                <span>{item.factor}</span>
                <span className="text-gray-400">
                  ({item.effect === 'increased' ? '+' : ''}₹{Math.abs(item.impact_amount).toFixed(0)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}