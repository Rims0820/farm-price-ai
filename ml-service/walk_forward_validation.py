import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error

from config import get_split_date

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded",
]
TARGET_COL = "target_next_month"
TEST_WINDOW_MONTHS = 3


def load_data():
    df = pd.read_csv("data/features.csv", parse_dates=["date"])
    df["crop_encoded"] = joblib.load("models/crop_encoder.pkl").transform(df["crop"])
    df["market_encoded"] = joblib.load("models/market_encoder.pkl").transform(df["market"])
    return df


def evaluate(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
    return mae, rmse, mape


def run_walk_forward(df, best_params):
    first_split = get_split_date(df)
    # four consecutive 3-month windows covering the last 12 months
    split_dates = [first_split + pd.DateOffset(months=m) for m in (0, 3, 6, 9)]
    results = []
    for split_dt in split_dates:
        test_end = split_dt + pd.DateOffset(months=TEST_WINDOW_MONTHS)
        train_df = df[df["date"] < split_dt]
        test_df = df[(df["date"] >= split_dt) & (df["date"] < test_end)]
        if len(test_df) == 0 or len(train_df) < 100:
            print(f"Skipping {split_dt.date()} - insufficient data")
            continue
        model = xgb.XGBRegressor(**best_params).fit(train_df[FEATURE_COLS], train_df[TARGET_COL])
        mae, rmse, mape = evaluate(test_df[TARGET_COL].values, model.predict(test_df[FEATURE_COLS]))
        results.append({"split_date": str(split_dt.date()), "train_size": len(train_df),
                        "test_size": len(test_df), "mae": round(mae, 2),
                        "rmse": round(rmse, 2), "mape": round(mape, 2)})
        print(f"Window {split_dt.date()}: train={len(train_df)}, test={len(test_df)} "
              f"-> MAE={mae:.2f}, MAPE={mape:.2f}%")
    return pd.DataFrame(results)


if __name__ == "__main__":
    df = load_data()
    best_params = joblib.load("models/best_params.pkl")
    best_params["random_state"] = 42
    best_params["objective"] = "reg:squarederror"

    print("Running walk-forward validation over the last 12 months...\n")
    results_df = run_walk_forward(df, best_params)
    if results_df.empty:
        raise SystemExit("Not enough data for walk-forward validation.")
    print("\n--- Walk-Forward Summary ---")
    print(results_df.to_string(index=False))
    print(f"\nAverage MAPE across windows: {results_df['mape'].mean():.2f}%")
    print(f"MAPE std dev across windows: {results_df['mape'].std():.2f}%  (lower = more consistent)")
    results_df.to_csv("data/walk_forward_results.csv", index=False)
    print("\nSaved to data/walk_forward_results.csv")
