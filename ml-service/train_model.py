import os

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import LabelEncoder

from config import get_split_date

os.makedirs("models", exist_ok=True)

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded",
]
TARGET_COL = "target_next_month"


def load_and_encode():
    df = pd.read_csv("data/features.csv", parse_dates=["date"])
    crop_encoder = LabelEncoder()
    market_encoder = LabelEncoder()
    df["crop_encoded"] = crop_encoder.fit_transform(df["crop"])
    df["market_encoded"] = market_encoder.fit_transform(df["market"])
    joblib.dump(crop_encoder, "models/crop_encoder.pkl")
    joblib.dump(market_encoder, "models/market_encoder.pkl")
    return df


def time_based_split(df, split_date=None):
    split_date = split_date or get_split_date(df)
    train = df[df["date"] < split_date].copy()
    test = df[df["date"] >= split_date].copy()
    print(f"Train: {len(train):,} rows ({train['date'].min().date()} to {train['date'].max().date()})")
    print(f"Test:  {len(test):,} rows ({test['date'].min().date()} to {test['date'].max().date()})")
    return train, test


def evaluate(y_true, y_pred, label=""):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
    print(f"\n{label}\n  MAE:  {mae:,.2f}\n  RMSE: {rmse:,.2f}\n  MAPE: {mape:,.2f}%")
    return {"mae": mae, "rmse": rmse, "mape": mape}


def train_xgboost(train_df, test_df):
    model = xgb.XGBRegressor(
        n_estimators=300, max_depth=5, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, random_state=42, objective="reg:squarederror",
    )
    model.fit(train_df[FEATURE_COLS], train_df[TARGET_COL], verbose=False)
    return model, model.predict(test_df[FEATURE_COLS]), test_df[TARGET_COL].values


if __name__ == "__main__":
    df = load_and_encode()
    train_df, test_df = time_based_split(df)

    baseline = evaluate(test_df[TARGET_COL].values, test_df["avg_price"].values,
                        "BASELINE (naive: next month = this month)")
    model, preds, y_test = train_xgboost(train_df, test_df)
    xgb_metrics = evaluate(y_test, preds, "XGBOOST MODEL")
    print(f"\nXGBoost improves MAE over baseline by "
          f"{(baseline['mae'] - xgb_metrics['mae']) / baseline['mae'] * 100:.1f}%")

    test_df = test_df.reset_index(drop=True)
    test_df["prediction"] = preds
    test_df["abs_error"] = np.abs(test_df["prediction"] - test_df[TARGET_COL])
    test_df["pct_error"] = test_df["abs_error"] / test_df[TARGET_COL] * 100
    per_crop = test_df.groupby("crop")[["abs_error", "pct_error"]].mean().round(2)
    per_crop.columns = ["MAE", "MAPE (%)"]
    print("\n--- Per-crop performance (XGBoost) ---")
    print(per_crop)

    importance = pd.Series(model.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
    print("\n--- Feature importance ---")
    print(importance.round(4))

    joblib.dump(model, "models/xgb_price_model.pkl")
    test_df.to_csv("data/test_predictions.csv", index=False)
    print("\nModel saved to models/xgb_price_model.pkl")
