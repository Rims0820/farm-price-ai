import os

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from explainer import explain_prediction
except Exception:  
    explain_prediction = None

load_dotenv()

app = FastAPI(title="Farm Price ML Service")

allowed_origins = ["http://localhost:5000", "http://localhost:5173"]
for var in ("CLIENT_URL", "SERVER_URL"):
    if os.getenv(var):
        allowed_origins.append(os.getenv(var))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded",
]

model = None
crop_encoder = None
market_encoder = None
features_df = None   
latest_df = None     
rf_model = None
ensemble_weights = None
crop_error = {}      


@app.on_event("startup")
def load_artifacts():
    global model, crop_encoder, market_encoder, features_df, latest_df
    global rf_model, ensemble_weights, crop_error

    model_path = "models/xgb_price_model_final.pkl"
    if not os.path.exists(model_path):
        print("WARNING: final model not found, falling back to the default model")
        model_path = "models/xgb_price_model.pkl"

    model = joblib.load(model_path)
    crop_encoder = joblib.load("models/crop_encoder.pkl")
    market_encoder = joblib.load("models/market_encoder.pkl")
    features_df = pd.read_csv("data/features.csv", parse_dates=["date"])

    if os.path.exists("data/features_latest.csv"):
        latest_df = pd.read_csv("data/features_latest.csv", parse_dates=["date"])
    else:
        print("WARNING: data/features_latest.csv missing - re-run feature_engineering.py. "
              "Falling back to features.csv (forecast will be one month behind).")
        latest_df = features_df

    if os.path.exists("models/rf_model.pkl") and os.path.exists("models/ensemble_weights.pkl"):
        rf_model = joblib.load("models/rf_model.pkl")
        ensemble_weights = joblib.load("models/ensemble_weights.pkl")
        print("Ensemble model loaded")
    else:
        rf_model, ensemble_weights = None, None
        print("Ensemble not found, using XGBoost only")

    crop_error = {}
    if os.path.exists("data/test_predictions.csv"):
        t = pd.read_csv("data/test_predictions.csv")
        t["resid"] = t["prediction"] - t["target_next_month"]
        crop_error = {c: float(np.sqrt((g["resid"] ** 2).mean())) for c, g in t.groupby("crop")}

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
    rows = latest_df[(latest_df["crop"] == req.crop) & (latest_df["market"] == req.market)].sort_values("date")
    if rows.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for crop='{req.crop}', market='{req.market}'. "
                   f"Available crops: {sorted(features_df['crop'].unique().tolist())}",
        )
    latest = rows.iloc[-1]

    try:
        crop_encoded = crop_encoder.transform([req.crop])[0]
        market_encoded = market_encoder.transform([req.market])[0]
    except ValueError:
        raise HTTPException(status_code=400, detail="Crop or market not recognized by the model")

    row = latest.copy()
    row["crop_encoded"] = crop_encoded
    row["market_encoded"] = market_encoded

    X = row[FEATURE_COLS].values.reshape(1, -1).astype(float)
    xgb_prediction = float(model.predict(X)[0])
    if rf_model is not None and ensemble_weights is not None:
        w = ensemble_weights["xgb_weight"]
        prediction = w * xgb_prediction + (1 - w) * float(rf_model.predict(X)[0])
    else:
        prediction = xgb_prediction

    err = crop_error.get(req.crop)
    if err is None:
        hist = features_df[(features_df["crop"] == req.crop) & (features_df["market"] == req.market)]
        err = float(hist["price_std"].tail(6).mean()) if not hist.empty else 0.0
    lower_bound = round(max(prediction - err, 0), 2)
    upper_bound = round(prediction + err, 2)

    explanation = []
    if explain_prediction is not None:
        try:
            feature_row_df = row[FEATURE_COLS].to_frame().T.astype(float)
            explanation = explain_prediction(model, feature_row_df, model_key=f"xgb-{id(model)}")
        except Exception as e:
            print(f"SHAP explanation failed: {e}")

    return {
        "crop": req.crop,
        "market": req.market,
        "latest_known_date": latest["date"].strftime("%Y-%m-%d"),
        "latest_known_price": round(float(latest["avg_price"]), 2),
        "predicted_next_month_price": round(prediction, 2),
        "confidence_range": {"lower": lower_bound, "upper": upper_bound},
        "explanation": explanation,
    }


def reliability(mape: float) -> dict:
    if mape < 5:
        return {"level": "High", "note": "Reliable for planning"}
    if mape < 10:
        return {"level": "Moderate", "note": "Useful guide, expect some error"}
    return {"level": "Low", "note": "Volatile price - use with caution"}


@app.get("/model-metrics")
def model_metrics():
    path = "data/test_predictions.csv"
    if not os.path.exists(path):
        raise HTTPException(status_code=404,
                            detail="No test results yet. Run train_model.py and train_final_model.py.")
    t = pd.read_csv(path, parse_dates=["date"])
    target = t["target_next_month"]
    t["model_pct"] = (t["prediction"] - target).abs() / target * 100
    t["naive_pct"] = (t["avg_price"] - target).abs() / target * 100
    t["abs_err"] = (t["prediction"] - target).abs()

    per_crop = []
    for crop, g in t.groupby("crop"):
        mape = float(g["model_pct"].mean())
        per_crop.append({
            "crop": crop,
            "mape": round(mape, 2),
            "naive_mape": round(float(g["naive_pct"].mean()), 2),
            "mae": round(float(g["abs_err"].mean()), 2),
            "samples": int(len(g)),
            **reliability(mape),
        })
    per_crop.sort(key=lambda r: r["mape"])

    walk_forward = []
    if os.path.exists("data/walk_forward_results.csv"):
        walk_forward = pd.read_csv("data/walk_forward_results.csv").fillna(0).to_dict(orient="records")

    return {
        "overall": {
            "mape": round(float(t["model_pct"].mean()), 2),
            "naive_mape": round(float(t["naive_pct"].mean()), 2),
            "mae": round(float(t["abs_err"].mean()), 2),
            "samples": int(len(t)),
            "test_start": t["date"].min().strftime("%Y-%m-%d"),
            "test_end": t["date"].max().strftime("%Y-%m-%d"),
        },
        "per_crop": per_crop,
        "walk_forward": walk_forward,
    }


@app.post("/reload-model")
def reload_model():
    load_artifacts()
    return {"status": "Model reloaded successfully"}
