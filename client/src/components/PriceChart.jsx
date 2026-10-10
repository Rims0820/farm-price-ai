import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });

const nextMonth = (dateStr) => {
  const d = new Date(dateStr);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
};

export default function PriceChart({ data, prediction }) {
  if (!data || data.length === 0) return null;

  const points = data.map((item) => ({ label: fmt(item.date), price: item.modalPrice }));

  if (prediction) {
    const { predicted_next_month_price: predicted, confidence_range: band, latest_known_date } = prediction;
    const last = points[points.length - 1];
    last.forecast = last.price;            // joins the forecast line to the history line
    last.band = [last.price, last.price];  // band fans out from the last known price
    points.push({
      label: `${fmt(nextMonth(latest_known_date))} (forecast)`,
      forecast: predicted,
      band: [band.lower, band.upper],
    });
  }

  const all = points.flatMap((p) => [p.price, p.forecast, ...(p.band || [])]).filter((v) => typeof v === 'number');
  const domain = [Math.floor(Math.min(...all) * 0.95), Math.ceil(Math.max(...all) * 1.05)];

  const tooltipFormatter = (value, name) =>
    Array.isArray(value)
      ? [`₹${Math.round(value[0]).toLocaleString()} – ₹${Math.round(value[1]).toLocaleString()}`, name]
      : [`₹${Math.round(value).toLocaleString()}`, name];

  return (
    <div className="mt-6 bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-100">
      <h4 className="text-md font-semibold text-gray-700 mb-4">Price history and next-month forecast</h4>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
          <YAxis tick={{ fontSize: 12 }} domain={domain} width={56} />
          <Tooltip formatter={tooltipFormatter} />
          <Legend />
          <Area dataKey="band" name="Likely range" stroke="none" fill="#16a34a" fillOpacity={0.15} legendType="square" />
          <Line type="monotone" dataKey="price" name="Price (INR/quintal)" stroke="#166534" strokeWidth={2} dot={false} />
          <Line type="linear" dataKey="forecast" name="Forecast" stroke="#d97706" strokeWidth={2}
                strokeDasharray="6 4" dot={{ r: 4 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}