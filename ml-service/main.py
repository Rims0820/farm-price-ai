from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import joblib
import os

app = FastAPI(title="Farm Price ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded"
]

# --- Load model and data once at startup ---
model = None
crop_encoder = None
market_encoder = None
features_df = None

@app.on_event("startup")
def load_artifacts():
    global model, crop_encoder, market_encoder, features_df
    model_path = "models/xgb_price_model_final.pkl"
    if not os.path.exists(model_path):
        print("WARNING: final model not found, falling back to Day 5 model")
        model_path = "models/xgb_price_model.pkl"

    model = joblib.load(model_path)
    crop_encoder = joblib.load("models/crop_encoder.pkl")
    market_encoder = joblib.load("models/market_encoder.pkl")
    features_df = pd.read_csv("data/features.csv", parse_dates=["date"])
    print("Model and data loaded successfully")


class PredictRequest(BaseModel):
    crop: str
    market: str


@app.get("/health")
def health():
    return {"status": "ML service running", "model_loaded": model is not None}


@app.get("/crops")
def get_crops():
    return sorted(features_df["crop"].unique().tolist())


@app.get("/markets")
def get_markets():
    return sorted(features_df["market"].unique().tolist())


@app.post("/predict")
def predict(req: PredictRequest):
    subset = features_df[
        (features_df["crop"] == req.crop) & (features_df["market"] == req.market)
    ].sort_values("date")

    if subset.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for crop='{req.crop}', market='{req.market}'. "
                    f"Available crops: {sorted(features_df['crop'].unique().tolist())}"
        )

    latest = subset.iloc[-1]

    try:
        crop_encoded = crop_encoder.transform([req.crop])[0]
        market_encoded = market_encoder.transform([req.market])[0]
    except ValueError:
        raise HTTPException(status_code=400, detail="Crop or market not recognized by the model")

    row = latest.copy()
    row["crop_encoded"] = crop_encoded
    row["market_encoded"] = market_encoded

    X = row[FEATURE_COLS].values.reshape(1, -1).astype(float)
    prediction = float(model.predict(X)[0])

    # simple confidence band using historical volatility for this crop/market
    volatility = float(subset["price_std"].tail(6).mean())
    lower_bound = round(prediction - volatility, 2)
    upper_bound = round(prediction + volatility, 2)

    return {
        "crop": req.crop,
        "market": req.market,
        "latest_known_date": latest["date"].strftime("%Y-%m-%d"),
        "latest_known_price": round(float(latest["avg_price"]), 2),
        "predicted_next_month_price": round(prediction, 2),
        "confidence_range": {"lower": lower_bound, "upper": upper_bound},
    }