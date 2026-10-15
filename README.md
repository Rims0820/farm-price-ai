# Farm Price AI

A full-stack app that forecasts **next-month wholesale-style crop prices for Indian markets** and explains each forecast. Built with React, Express, MongoDB and a Python ML service (XGBoost).

**Live demo:** [FILL IN: your Vercel URL]  
**Status:** portfolio / learning project. Not a production pricing service.

---

## Read this first: what the forecasts are (and are not)

- **The data ends in July 2023.** The public source stopped reporting city-level prices in 2023, so every forecast is for the month *after* the last data month. These are **not live forecasts for today**.
- **Prices are retail prices from city markets**, converted to INR per quintal. They are not mandi (wholesale) prices.
- **Coverage is small:** 5 crops (Wheat, Rice, Onion, Tomato, Potato) in 12 cities.
- **Forecasts are estimates with real error.** See the accuracy section. Volatile crops (typically Onion and Tomato) are the least reliable.
- **Not financial advice.** The "sell now vs wait" card ignores storage cost, spoilage and transport.

## Features

- **Next-month forecast** per crop and market, with a likely range and a plain-language explanation of what drove it (SHAP).
- **Sell now vs wait card** that only gives a firm recommendation when the expected move is larger than the model's typical error.
- **Chart** of price history with the forecast point and likely range.
- **Market comparison** across all markets for a crop.
- **Accuracy page** with error against a "no change" baseline, a reliability label per crop, and walk-forward results.
- **Data page** to upload a CSV, see what data the app holds, and retrain (local use; protected by an admin key).

## Accuracy

Measured on the final 12 months of data, which the model never saw in training. "No change" means predicting next month's price equals this month's.

| Crop | Model error (MAPE) | "No change" error | Reliability |
|---|---|---|---|
| Wheat | 4.62% | 3.13% | High |
| Rice | 4.05% | 2.76% | High |
| Potato | 11.08% | 9.31% | Low |
| Onion | 11.1% | 8.97% | Low |
| Tomato | 30.5% | 22.81% | Low |

Walk-forward validation (retrain and test on four consecutive 3-month windows): average error 11.40%.

## Data

- **Source:** World Food Programme, *India Food Prices*, from the Humanitarian Data Exchange. The underlying price data comes from India's Department of Consumer Affairs. 
Source-DEPARTMENT OF CONSUMER AFFAIRS, Department of Consumer Affairs (Price Monitoring Division), FPMA, Food and Public Distribution, Government of India, Ministry of Consumer Affairs, Ministry of Consumer Affairs via FAO: GIEWS
License-Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)
- **Preparation** (`ml-service/convert_real_data.py`): keeps the five crops; converts price per kg to per quintal; keeps one price type (the one with most rows, retail); averages to monthly values; fills gaps of up to 2 months by interpolation; drops implausible prices; keeps markets with all five crops and at least 48 continuous months.
- **Result:** about 3,300 monthly rows after preparation.

## How it works

```
React (Vercel)  ->  Express API (Render)  ->  FastAPI ML service (Render)
                        |                          |
                   MongoDB Atlas            model + data files in git
```

1. Prices are stored in MongoDB.
2. `aggregate.py` -> `feature_engineering.py` build monthly lag, rolling, momentum and seasonal features.
3. XGBoost (tuned with Optuna) predicts the next month's price. An optional Random Forest ensemble is supported.
4. The test set is always the last 12 months (no random shuffling, so there is no leakage from the future).
5. The "likely range" is the model's typical error (RMSE) for that crop on held-out months.
6. Express caches forecasts for 24 hours and proxies requests to the ML service.

## Tech stack

React, Vite, Tailwind CSS, Recharts, React Router · Node.js, Express, Mongoose · Python, FastAPI, pandas, scikit-learn, XGBoost, Optuna, SHAP · MongoDB Atlas.

## Run it locally (Windows / PowerShell)

Prerequisites: Node.js LTS, Python 3.10+, a free MongoDB Atlas cluster.

```powershell
# 1. Settings: copy each .env.example to .env and fill it in
copy server\.env.example server\.env
copy client\.env.example client\.env
copy ml-service\.env.example ml-service\.env

# 2. Install
cd server;  npm install; cd ..
cd client;  npm install; cd ..
cd ml-service; python -m venv .venv; .venv\Scripts\activate; pip install -r requirements-train.txt; cd ..

# 3. Run (three terminals)
cd server;     npm run dev
cd client;     npm run dev
cd ml-service; .venv\Scripts\activate; uvicorn main:app --reload --port 8000
```

Open http://localhost:5173.

### Use your own data
1. Prepare a CSV with columns `crop,state,market,date,minPrice,maxPrice,modalPrice` (monthly rows, INR per quintal). `convert_real_data.py` does this for the WFP file.
2. Upload it on the **Data** page (needs the admin key if `ADMIN_KEY` is set), then remove any demo data.
3. Rebuild the model:

```powershell
cd ml-service
.venv\Scripts\activate
python aggregate.py
python feature_engineering.py
python train_model.py
python tune_model.py
python train_final_model.py
python walk_forward_validation.py
python check_artifacts.py
```

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Client | Vercel | Root `client`. Set `VITE_API_URL` to `https://<server>/api` |
| Server | Render | Root `server`. Set `MONGO_URI`, `ADMIN_KEY`, `ML_SERVICE_URL`, `CLIENT_URL`, `NODE_ENV=production`, `RETRAIN_ENABLED=false` |
| ML service | Render | Root `ml-service`. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT` |

**Retraining is local only.** The deployed services are separate machines and the ML service has no training pipeline or database access, so the Retrain button is disabled in production. To update the model: retrain locally, run `python check_artifacts.py`, commit the new `.pkl` and `.csv` files, and push. Render redeploys automatically.

On the free tier the services sleep when idle, so the first request after a pause can take a minute.

## Project structure

```
client/       React app (pages: Forecast, Accuracy, Data)
server/       Express API, MongoDB models, admin routes
ml-service/   Data prep, training scripts, FastAPI service, committed model files
```

## Credits and licence

- Price data: World Food Programme / Department of Consumer Affairs via HDX. 
License-Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)
- [FILL IN: your own licence for the code, e.g. MIT, or remove this line]

## Disclaimer

Forecasts are statistical estimates from historical data and may be wrong. Do not use them as the sole basis for selling, buying or storing produce.
