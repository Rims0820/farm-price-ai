const TONES = {
  green: 'bg-green-50 border-green-200 text-green-900',
  red: 'bg-red-50 border-red-200 text-red-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  gray: 'bg-gray-50 border-gray-200 text-gray-800',
};

const CHANGE_THRESHOLD = 3; // % move that counts as meaningful

export function getAdvice(result) {
  const current = result.latest_known_price;
  const predicted = result.predicted_next_month_price;
  const { lower, upper } = result.confidence_range;

  const changePct = ((predicted - current) / current) * 100;
  const errorPct = ((upper - lower) / 2 / current) * 100; // typical forecast error
  const confidence = errorPct < 6 ? 'High' : errorPct < 12 ? 'Medium' : 'Low';
  const size = Math.abs(changePct).toFixed(1);
  const strong = Math.abs(changePct) >= errorPct;

  let title, tone, detail;
  if (Math.abs(changePct) < CHANGE_THRESHOLD) {
    title = 'Price expected to stay steady';
    tone = 'gray';
    detail = `The forecast is within ${size}% of today's price, so waiting is unlikely to change much.`;
  } else if (changePct > 0) {
    if (strong) {
      title = 'Consider waiting to sell';
      tone = 'green';
      detail = `Price is forecast to rise about ${size}%, more than the model's typical error.`;
    } else {
      title = 'Small rise possible, but uncertain';
      tone = 'amber';
      detail = `Forecast is +${size}%, which is smaller than the model's typical error (about ±${errorPct.toFixed(0)}%). Treat it as a weak signal.`;
    }
  } else if (strong) {
    title = 'Consider selling now';
    tone = 'red';
    detail = `Price is forecast to fall about ${size}%, more than the model's typical error.`;
  } else {
    title = 'Small fall possible, but uncertain';
    tone = 'amber';
    detail = `Forecast is -${size}%, which is smaller than the model's typical error (about ±${errorPct.toFixed(0)}%). Treat it as a weak signal.`;
  }
  return { title, tone, detail, confidence, errorPct };
}

export default function AdviceCard({ result }) {
  if (!result) return null;
  const { title, tone, detail, confidence, errorPct } = getAdvice(result);

  return (
    <div className={`mt-6 rounded-lg border p-5 ${TONES[tone]}`}>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm mt-1">{detail}</p>
      <p className="text-xs mt-3 opacity-80">
        Forecast confidence: {confidence} (typical error about ±{errorPct.toFixed(0)}%).
        Storage cost, spoilage and transport are not included.
      </p>
    </div>
  );
}