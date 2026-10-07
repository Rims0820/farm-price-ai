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

# Rolling window cutoffs — each one trains on everything before it, tests on the next 3 months
SPLIT_DATES = [
    "2024-06-01",
    "2024-09-01",
    "2024-12-01",
    "2025-03-01",
    "2025-06-01",
]
TEST_WINDOW_MONTHS = 3


def load_data():
    df = pd.read_csv("data/features.csv", parse_dates=["date"])
    crop_encoder = joblib.load("models/crop_encoder.pkl")
    market_encoder = joblib.load("models/market_encoder.pkl")
    df["crop_encoded"] = crop_encoder.transform(df["crop"])
    df["market_encoded"] = market_encoder.transform(df["market"])
    return df


def evaluate(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
    return mae, rmse, mape


def run_walk_forward(df, best_params):
    results = []

    for split_date in SPLIT_DATES:
        split_dt = pd.Timestamp(split_date)
        test_end = split_dt + pd.DateOffset(months=TEST_WINDOW_MONTHS)

        train_df = df[df["date"] < split_dt]
        test_df = df[(df["date"] >= split_dt) & (df["date"] < test_end)]

        if len(test_df) == 0 or len(train_df) < 100:
            print(f"Skipping {split_date} — insufficient data")
            continue

        model = xgb.XGBRegressor(**best_params)
        model.fit(train_df[FEATURE_COLS], train_df[TARGET_COL])
        preds = model.predict(test_df[FEATURE_COLS])

        mae, rmse, mape = evaluate(test_df[TARGET_COL].values, preds)
        results.append({
            "split_date": split_date,
            "train_size": len(train_df),
            "test_size": len(test_df),
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "mape": round(mape, 2)
        })
        print(f"Split {split_date}: train={len(train_df)}, test={len(test_df)} -> MAE={mae:.2f}, MAPE={mape:.2f}%")

    return pd.DataFrame(results)


if __name__ == "__main__":
    df = load_data()
    best_params = joblib.load("models/best_params.pkl")
    best_params["random_state"] = 42
    best_params["objective"] = "reg:squarederror"

    print("Running walk-forward validation across 5 rolling windows...\n")
    results_df = run_walk_forward(df, best_params)

    print("\n--- Walk-Forward Summary ---")
    print(results_df.to_string(index=False))

    print(f"\nAverage MAE across windows: {results_df['mae'].mean():.2f}")
    print(f"Average MAPE across windows: {results_df['mape'].mean():.2f}%")
    print(f"MAPE std dev across windows: {results_df['mape'].std():.2f}%  (lower = more consistent)")

    results_df.to_csv("data/walk_forward_results.csv", index=False)
    print("\nSaved to data/walk_forward_results.csv")