import { useState, useEffect } from 'react';
import { getModelMetrics, getDataSummary } from '../services/api';

const card = 'bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-100';
const BADGES = {
  High: 'bg-green-100 text-green-800',
  Moderate: 'bg-amber-100 text-amber-800',
  Low: 'bg-red-100 text-red-800',
};
const fmtMonth = (d) =>
  new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function Accuracy() {
  const [metrics, setMetrics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([getModelMetrics(), getDataSummary().catch(() => null)]);
        setMetrics(m);
        setSummary(s);
      } catch (err) {
        setError(err.response?.data?.error || 'Could not load model results. Is the ML service running?');
      }
    })();
  }, []);

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>;
  }
  if (!metrics) return <p className="text-sm text-gray-500">Loading model results...</p>;

  const { overall, per_crop, walk_forward } = metrics;
  const gain = ((overall.naive_mape - overall.mape) / overall.naive_mape) * 100;
  const hasDemo = summary?.sources?.some((s) => s.source === 'seed');

  return (
    <div className="space-y-6">
      {hasDemo && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
          These results come from demo (synthetic) data and say nothing about real-world accuracy.
          Upload real prices on the Data page and retrain to see honest numbers.
        </div>
      )}

      <section className={card}>
        <h2 className="text-lg font-semibold text-gray-800">How far off are the forecasts?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Measured on {overall.samples.toLocaleString()} forecasts the model never saw during training
          ({fmtMonth(overall.test_start)} to {fmtMonth(overall.test_end)}).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-sm text-gray-500">Average error of this model</p>
            <p className="text-2xl font-bold text-green-700">{overall.mape}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Error if we just assume "no change"</p>
            <p className="text-2xl font-bold text-gray-800">{overall.naive_mape}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Improvement</p>
            <p className="text-2xl font-bold text-gray-800">{gain.toFixed(0)}%</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          An error of 5% means a forecast of ₹2,000 is typically within ₹100 of the real price.
        </p>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-gray-800">Reliability by crop</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-gray-500 border-b">
              <tr>
                <th className="py-2 pr-4">Crop</th><th className="pr-4">Avg error</th>
                <th className="pr-4">"No change" error</th><th className="pr-4">Reliability</th><th>What it means</th>
              </tr>
            </thead>
            <tbody>
              {per_crop.map((c) => (
                <tr key={c.crop} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{c.crop}</td>
                  <td className="pr-4">{c.mape}%</td>
                  <td className="pr-4">{c.naive_mape}%</td>
                  <td className="pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${BADGES[c.level]}`}>{c.level}</span>
                  </td>
                  <td className="text-gray-600">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {walk_forward.length > 0 && (
        <section className={card}>
          <h2 className="text-lg font-semibold text-gray-800">Does it hold up over time?</h2>
          <p className="text-sm text-gray-500 mt-1">
            The model is retrained and tested on several separate time periods. Similar errors across periods mean the result is not a lucky one-off.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 border-b">
                <tr><th className="py-2 pr-4">Period starting</th><th className="pr-4">Forecasts tested</th><th>Avg error</th></tr>
              </thead>
              <tbody>
                {walk_forward.map((w) => (
                  <tr key={w.split_date} className="border-b last:border-0">
                    <td className="py-2 pr-4">{fmtMonth(w.split_date)}</td>
                    <td className="pr-4">{w.test_size}</td>
                    <td>{w.mape}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}