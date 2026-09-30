import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb
import joblib
import os

os.makedirs("models", exist_ok=True)

SPLIT_DATE = "2025-06-01"

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded"
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


def time_based_split(df, split_date=SPLIT_DATE):
    train = df[df["date"] < split_date].copy()
    test = df[df["date"] >= split_date].copy()
    print(f"Train: {len(train):,} rows ({train['date'].min().date()} to {train['date'].max().date()})")
    print(f"Test:  {len(test):,} rows ({test['date'].min().date()} to {test['date'].max().date()})")
    return train, test


def baseline_naive(test_df):
    """Baseline: predict next month = this month's price (no model at all)."""
    preds = test_df["avg_price"].values  # naive: assume no change
    return preds


def evaluate(y_true, y_pred, label=""):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
    print(f"\n{label}")
    print(f"  MAE:  {mae:,.2f}")
    print(f"  RMSE: {rmse:,.2f}")
    print(f"  MAPE: {mape:,.2f}%")
    return {"mae": mae, "rmse": rmse, "mape": mape}


def train_xgboost(train_df, test_df):
    X_train, y_train = train_df[FEATURE_COLS], train_df[TARGET_COL]
    X_test, y_test = test_df[FEATURE_COLS], test_df[TARGET_COL]

    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        objective="reg:squarederror"
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )

    preds = model.predict(X_test)
    return model, preds, y_test.values


if __name__ == "__main__":
    df = load_and_encode()
    train_df, test_df = time_based_split(df)

    # --- Baseline ---
    baseline_preds = baseline_naive(test_df)
    baseline_metrics = evaluate(test_df[TARGET_COL].values, baseline_preds, "BASELINE (naive: next month = this month)")

    # --- XGBoost ---
    model, xgb_preds, y_test = train_xgboost(train_df, test_df)
    xgb_metrics = evaluate(y_test, xgb_preds, "XGBOOST MODEL")

    improvement = (baseline_metrics["mae"] - xgb_metrics["mae"]) / baseline_metrics["mae"] * 100
    print(f"\nXGBoost improves MAE over baseline by {improvement:.1f}%")

    # --- Per-crop breakdown ---
    print("\n--- Per-crop performance (XGBoost) ---")
    test_df = test_df.reset_index(drop=True)
    test_df["prediction"] = xgb_preds
    test_df["abs_error"] = np.abs(test_df["prediction"] - test_df[TARGET_COL])
    test_df["pct_error"] = test_df["abs_error"] / test_df[TARGET_COL] * 100

    per_crop = test_df.groupby("crop")[["abs_error", "pct_error"]].mean().round(2)
    per_crop.columns = ["MAE", "MAPE (%)"]
    print(per_crop)

    # --- Feature importance ---
    print("\n--- Feature importance ---")
    importance = pd.Series(model.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
    print(importance.round(4))

    # --- Save model and test predictions ---
    joblib.dump(model, "models/xgb_price_model.pkl")
    test_df.to_csv("data/test_predictions.csv", index=False)
    print("\nModel saved to models/xgb_price_model.pkl")
    print("Test predictions saved to data/test_predictions.csv")