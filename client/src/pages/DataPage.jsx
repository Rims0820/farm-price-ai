import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDataSummary, uploadCsv, deleteDemoData, triggerRetrain, getRetrainStatus,
} from '../services/api';

const fmtMonth = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-';
const errText = (err) => err.response?.data?.error || err.message || 'Something went wrong.';

const SOURCE_LABELS = { seed: 'Demo data (synthetic)', upload: 'Uploaded data' };

const card = 'bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-100';
const primaryBtn =
  'bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium px-5 py-2 rounded-md transition';

export default function DataPage() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState(null);
  const [adminKey, setAdminKey] = useState('');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [polling, setPolling] = useState(false);
  const seenRunning = useRef(false);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await getDataSummary());
    } catch (err) {
      setMessage({ type: 'error', text: `Could not load data summary: ${errText(err)}` });
    }
  }, []);

  useEffect(() => {
    loadSummary();
    getRetrainStatus().then(setStatus).catch(() => {});
  }, [loadSummary]);

  // Poll training status until it finishes
  useEffect(() => {
    if (!polling) return undefined;
    const started = Date.now();
    const id = setInterval(async () => {
      const s = await getRetrainStatus().catch(() => null);
      if (!s) return;
      setStatus(s);
      if (s.lastTrainingStatus === 'in_progress') seenRunning.current = true;
      const finished = seenRunning.current && ['success', 'failed'].includes(s.lastTrainingStatus);
      if (finished || Date.now() - started > 10 * 60 * 1000) {
        setPolling(false);
        if (finished) loadSummary();
      }
    }, 3000);
    return () => clearInterval(id);
  }, [polling, loadSummary]);

  const handleUpload = async () => {
    if (!file) return;
    setBusy('upload');
    setProgress(0);
    setMessage(null);
    try {
      const r = await uploadCsv(file, adminKey, setProgress);
      setMessage({
        type: 'ok',
        text: `Upload finished: ${r.inserted} new rows, ${r.updated} updated, ${r.skipped} skipped. Retrain the model to use this data.`,
      });
      setFile(null);
      loadSummary();
    } catch (err) {
      setMessage({ type: 'error', text: errText(err) });
    } finally {
      setBusy('');
    }
  };

  const handleDeleteDemo = async () => {
    if (!window.confirm('Remove all demo (synthetic) rows? This cannot be undone.')) return;
    setBusy('delete');
    setMessage(null);
    try {
      const r = await deleteDemoData(adminKey);
      setMessage({ type: 'ok', text: `Removed ${r.deleted} demo rows. Retrain the model next.` });
      loadSummary();
    } catch (err) {
      setMessage({ type: 'error', text: errText(err) });
    } finally {
      setBusy('');
    }
  };

  const handleRetrain = async () => {
    setBusy('retrain');
    setMessage(null);
    try {
      await triggerRetrain(adminKey);
      seenRunning.current = false;
      setPolling(true);
      setMessage({ type: 'ok', text: 'Retraining started. This takes a few minutes.' });
    } catch (err) {
      setMessage({ type: 'error', text: errText(err) });
    } finally {
      setBusy('');
    }
  };

  const hasDemo = summary?.sources?.some((s) => s.source === 'seed');
  const training = polling || status?.lastTrainingStatus === 'in_progress';

  return (
    <div className="space-y-6">
      {message && (
        <div className={`px-4 py-3 rounded-md text-sm border ${
          message.type === 'ok'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <section className={card}>
        <h2 className="text-lg font-semibold text-gray-800">What data the app has</h2>
        {!summary ? (
          <p className="text-sm text-gray-500 mt-3">Loading...</p>
        ) : summary.sources.length === 0 ? (
          <p className="text-sm text-gray-500 mt-3">No price data yet. Upload a CSV below.</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-500 border-b">
                  <tr><th className="py-2 pr-4">Source</th><th className="pr-4">Rows</th><th>Covers</th></tr>
                </thead>
                <tbody>
                  {summary.sources.map((s) => (
                    <tr key={s.source} className="border-b last:border-0">
                      <td className="py-2 pr-4">{SOURCE_LABELS[s.source] || s.source}</td>
                      <td className="pr-4">{s.rows.toLocaleString()}</td>
                      <td>{fmtMonth(s.from)} to {fmtMonth(s.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              {summary.crops.length} crops, {summary.markets.length} markets.
            </p>
          </>
        )}
        {hasDemo && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
            The app still contains demo data. Forecasts built on it do not reflect real prices.
            After uploading real data, remove the demo rows so the two are not mixed.
            <div className="mt-2">
              <button onClick={handleDeleteDemo} disabled={!!busy}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white text-sm px-4 py-1.5 rounded-md">
                {busy === 'delete' ? 'Removing...' : 'Remove demo data'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-gray-800">Upload price data</h2>
        <p className="text-sm text-gray-500 mt-1">
          CSV with these columns: <code className="bg-gray-100 px-1 rounded">crop, state, market, date, minPrice, maxPrice, modalPrice</code>.
          Prices are in INR per quintal. Uploading the same crop, market and date again updates the row instead of duplicating it.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0] || null)}
            className="text-sm flex-1" />
          <button onClick={handleUpload} disabled={!file || !!busy} className={primaryBtn}>
            {busy === 'upload' ? `Uploading ${progress}%` : 'Upload CSV'}
          </button>
        </div>
        <div className="mt-4">
          <label className="block text-xs text-gray-500 mb-1">
            Admin key (leave empty when running locally)
          </label>
          <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full sm:w-72 bg-white" />
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-gray-800">Retrain the model</h2>
        <p className="text-sm text-gray-500 mt-1">
          Rebuilds the forecasts from the data above. The model also retrains automatically every night when enough data has changed.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <button onClick={handleRetrain} disabled={!!busy || training} className={primaryBtn}>
            {training ? 'Training...' : 'Retrain now'}
          </button>
          {status && (
            <span className="text-sm text-gray-600">
              Status: <strong>{status.lastTrainingStatus?.replace('_', ' ')}</strong>
              {status.lastTrainedAt && ` · last trained ${new Date(status.lastTrainedAt).toLocaleString('en-IN')}`}
            </span>
          )}
        </div>
        {status?.lastTrainingLog && (
          <pre className="mt-4 bg-gray-900 text-gray-100 text-xs rounded-md p-3 max-h-56 overflow-auto whitespace-pre-wrap">
            {status.lastTrainingLog}
          </pre>
        )}
      </section>
    </div>
  );
}
