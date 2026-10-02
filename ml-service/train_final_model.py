import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
from sklearn.metrics import mean_absolute_error, mean_squared_error

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded"
]
TARGET_COL = "target_next_month"
SPLIT_DATE = "2025-06-01"  # same test cutoff as Day 5, for a fair comparison


def load_data():
    df = pd.read_csv("data/features.csv", parse_dates=["date"])
    crop_encoder = joblib.load("models/crop_encoder.pkl")
    market_encoder = joblib.load("models/market_encoder.pkl")
    df["crop_encoded"] = crop_encoder.transform(df["crop"])
    df["market_encoded"] = market_encoder.transform(df["market"])
    return df


def evaluate(y_true, y_pred, label=""):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
    print(f"{label} -> MAE: {mae:.2f} | RMSE: {rmse:.2f} | MAPE: {mape:.2f}%")
    return mae


if __name__ == "__main__":
    df = load_data()
    best_params = joblib.load("models/best_params.pkl")
    best_params["random_state"] = 42
    best_params["objective"] = "reg:squarederror"

    train_df = df[df["date"] < SPLIT_DATE]
    test_df = df[df["date"] >= SPLIT_DATE]

    model = xgb.XGBRegressor(**best_params)
    model.fit(train_df[FEATURE_COLS], train_df[TARGET_COL])

    preds = model.predict(test_df[FEATURE_COLS])
    evaluate(test_df[TARGET_COL].values, preds, "TUNED MODEL (test set)")

    # Compare to Day 5's default-params model for a clear before/after
    old_model = joblib.load("models/xgb_price_model.pkl")
    old_preds = old_model.predict(test_df[FEATURE_COLS])
    evaluate(test_df[TARGET_COL].values, old_preds, "OLD MODEL (Day 5 defaults)")

    # Retrain on ALL data (train+test) for the production model — more data = better real forecasts
    full_model = xgb.XGBRegressor(**best_params)
    full_model.fit(df[FEATURE_COLS], df[TARGET_COL])
    joblib.dump(full_model, "models/xgb_price_model_final.pkl")
    print("\nFinal production model (trained on all data) saved to models/xgb_price_model_final.pkl")