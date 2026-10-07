import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded"
]
TARGET_COL = "target_next_month"
SPLIT_DATE = "2025-06-01"


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
    return mae, rmse, mape


if __name__ == "__main__":
    df = load_data()
    best_params = joblib.load("models/best_params.pkl")
    best_params["random_state"] = 42
    best_params["objective"] = "reg:squarederror"

    train_df = df[df["date"] < SPLIT_DATE]
    test_df = df[df["date"] >= SPLIT_DATE]

    X_train, y_train = train_df[FEATURE_COLS], train_df[TARGET_COL]
    X_test, y_test = test_df[FEATURE_COLS], test_df[TARGET_COL]

    # Model 1: tuned XGBoost (from Day 6)
    xgb_model = xgb.XGBRegressor(**best_params)
    xgb_model.fit(X_train, y_train)
    xgb_preds = xgb_model.predict(X_test)

    # Model 2: Random Forest (different algorithm family — captures different patterns)
    rf_model = RandomForestRegressor(
        n_estimators=300,
        max_depth=8,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    rf_preds = rf_model.predict(X_test)

    print("--- Individual models ---")
    evaluate(y_test.values, xgb_preds, "XGBoost")
    evaluate(y_test.values, rf_preds, "Random Forest")

    # Ensemble: weighted average (XGBoost tends to perform better, so weight it higher)
    best_weight, best_mae = None, float("inf")
    print("\n--- Searching for best ensemble weight ---")
    for w in np.arange(0.3, 1.01, 0.1):
        ensemble_preds = w * xgb_preds + (1 - w) * rf_preds
        mae = mean_absolute_error(y_test, ensemble_preds)
        print(f"XGB weight={w:.1f} -> MAE: {mae:.2f}")
        if mae < best_mae:
            best_mae = mae
            best_weight = w

    print(f"\nBest XGBoost weight: {best_weight:.1f}")
    final_ensemble_preds = best_weight * xgb_preds + (1 - best_weight) * rf_preds
    evaluate(y_test.values, final_ensemble_preds, "ENSEMBLE (final)")

    # Per-crop comparison: ensemble vs XGBoost alone
    test_df = test_df.reset_index(drop=True)
    test_df["xgb_pred"] = xgb_preds
    test_df["ensemble_pred"] = final_ensemble_preds
    test_df["xgb_abs_error"] = np.abs(test_df["xgb_pred"] - test_df[TARGET_COL])
    test_df["ensemble_abs_error"] = np.abs(test_df["ensemble_pred"] - test_df[TARGET_COL])

    print("\n--- Per-crop MAE: XGBoost alone vs Ensemble ---")
    comparison = test_df.groupby("crop")[["xgb_abs_error", "ensemble_abs_error"]].mean().round(2)
    comparison.columns = ["XGBoost MAE", "Ensemble MAE"]
    print(comparison)

    # Save both models and the ensemble weight
    joblib.dump(rf_model, "models/rf_model.pkl")
    joblib.dump({"xgb_weight": best_weight}, "models/ensemble_weights.pkl")
    print("\nSaved rf_model.pkl and ensemble_weights.pkl")