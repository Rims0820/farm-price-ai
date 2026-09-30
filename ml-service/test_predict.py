import pandas as pd
import joblib

model = joblib.load("models/xgb_price_model.pkl")
crop_encoder = joblib.load("models/crop_encoder.pkl")
market_encoder = joblib.load("models/market_encoder.pkl")

df = pd.read_csv("data/features.csv", parse_dates=["date"])

# Grab the most recent row for Onion, Pune as a real example
latest = df[(df["crop"] == "Onion") & (df["market"] == "Pune")].sort_values("date").iloc[-1]
latest["crop_encoded"] = crop_encoder.transform([latest["crop"]])[0]
latest["market_encoded"] = market_encoder.transform([latest["market"]])[0]

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded"
]

X = latest[FEATURE_COLS].values.reshape(1, -1)
prediction = model.predict(X)[0]

print(f"Crop: Onion, Market: Pune")
print(f"Latest known date: {latest['date'].date()}, price: {latest['avg_price']:.2f}")
print(f"Predicted next month's price: {prediction:.2f}")