import { useEffect, useState } from 'react';
import { getDataSummary } from '../services/api';

// Edit this sentence if you ever switch to a different data source.
const DATA_DESCRIPTION =
  'These are retail prices from city markets (World Food Programme / Department of Consumer Affairs), shown per quintal, not mandi wholesale prices.';

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function DataNotice() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    getDataSummary().then(setInfo).catch(() => {});
  }, []);

  if (!info || !info.sources?.length) return null;

  const demo = info.sources.some((s) => s.source === 'seed');
  const first = info.sources.map((s) => s.from).filter(Boolean).sort()[0];
  const last = info.sources.map((s) => s.to).filter(Boolean).sort().pop();

  if (demo) {
    return (
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
        This app is currently showing <strong>demo data</strong>, so forecasts do not reflect real prices.
      </div>
    );
  }

  return (
    <div className="mb-4 bg-gray-100 border border-gray-200 rounded-md p-3 text-sm text-gray-700">
      <strong>About the data:</strong> prices run from {fmt(first)} to <strong>{fmt(last)}</strong>, the latest
      month available. Every forecast is for the month <em>after</em> {fmt(last)}, not for today.{' '}
      {DATA_DESCRIPTION} {info.markets.length} markets, {info.crops.length} crops.
    </div>
  );
}