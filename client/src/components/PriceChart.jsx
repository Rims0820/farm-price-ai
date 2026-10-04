import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PriceChart({ data }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    price: item.modalPrice,
  }));

  return (
    <div className="mt-6 bg-white rounded-lg shadow-md p-6 border border-gray-100">
      <h4 className="text-md font-semibold text-gray-700 mb-4">Historical Price Trend</h4>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`₹${value}`, 'Price']} />
          <Legend />
          <Line type="monotone" dataKey="price" stroke="#16a34a" strokeWidth={2} dot={false} name="Modal Price (INR/quintal)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}