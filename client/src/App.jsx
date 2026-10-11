import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Forecast from './pages/Forecast';
import DataPage from './pages/DataPage';
import Accuracy from './pages/Accuracy';

const linkClass = ({ isActive }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium transition ${
    isActive ? 'bg-white text-green-800' : 'text-green-100 hover:bg-green-600'
  }`;

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-green-700 text-white py-5 px-4 sm:py-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold">Farm Price AI</h1>
            <p className="text-green-100 text-xs sm:text-sm mt-1">
              Next-month crop price forecasts for Indian markets
            </p>
            <nav className="flex gap-2 mt-4">
              <NavLink to="/" end className={linkClass}>Forecast</NavLink>
              <NavLink to="/accuracy" className={linkClass}>Accuracy</NavLink>
              <NavLink to="/data" className={linkClass}>Data</NavLink>
            </nav>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <Routes>
            <Route path="/" element={<Forecast />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="/data" element={<DataPage />} />
          </Routes>
        </main>

        <footer className="text-center text-xs text-gray-400 py-6">
          Forecasts are AI-generated estimates based on historical trends — not financial advice.
        </footer>
      </div>
    </BrowserRouter>
  );
}
