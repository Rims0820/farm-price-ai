
import os
import sys

import joblib
import pandas as pd

REQUIRED = [
    "models/xgb_price_model_final.pkl", "models/crop_encoder.pkl", "models/market_encoder.pkl",
    "data/features.csv", "data/features_latest.csv", "data/test_predictions.csv",
]
OPTIONAL = ["models/rf_model.pkl", "models/ensemble_weights.pkl", "data/walk_forward_results.csv"]
problems = []

for f in REQUIRED + OPTIONAL:
    if os.path.exists(f):
        print(f"ok       {f}  ({os.path.getsize(f) / 1e6:.1f} MB)")
    else:
        print(f"{'MISSING ' if f in REQUIRED else 'optional'} {f}")
        if f in REQUIRED:
            problems.append(f"missing {f}")

if not problems:
    crop_enc = joblib.load("models/crop_encoder.pkl")
    mkt_enc = joblib.load("models/market_encoder.pkl")
    joblib.load("models/xgb_price_model_final.pkl")
    feats = pd.read_csv("data/features.csv", parse_dates=["date"])
    latest = pd.read_csv("data/features_latest.csv", parse_dates=["date"])

    print("\nCrops:  ", sorted(feats["crop"].unique()))
    print("Markets:", sorted(feats["market"].unique()))
    print("Forecast rows:", len(latest), "| latest data month:", latest["date"].max().date())

    if set(feats["market"]) - set(mkt_enc.classes_):
        problems.append("market encoder does not know every market in features.csv")
    if set(feats["crop"]) - set(crop_enc.classes_):
        problems.append("crop encoder does not know every crop in features.csv")
    if os.path.exists("models/rf_model.pkl") != os.path.exists("models/ensemble_weights.pkl"):
        problems.append("only one of rf_model.pkl / ensemble_weights.pkl exists (need both or neither)")

print("\n" + ("ALL GOOD" if not problems else "PROBLEMS:\n- " + "\n- ".join(problems)))
sys.exit(1 if problems else 0)