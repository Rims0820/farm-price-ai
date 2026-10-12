import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.ensemble import RandomForestRegressor
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


def load_data():
    df = pd.read_csv("data/features.csv", parse_dates=["date"])
    df["crop_encoded"] = joblib.load("models/crop_encoder.pkl").transform(df["crop"])
    df["market_encoded"] = joblib.load("models/market_encoder.pkl").transform(df["market"])
    return df


def evaluate(y_true, y_pred, label=""):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
    print(f"{label} -> MAE: {mae:.2f} | RMSE: {rmse:.2f} | MAPE: {mape:.2f}%")


if __name__ == "__main__":
    df = load_data()
    best_params = joblib.load("models/best_params.pkl")
    best_params["random_state"] = 42
    best_params["objective"] = "reg:squarederror"

    split = get_split_date(df)
    train_df = df[df["date"] < split]
    test_df = df[df["date"] >= split]
    X_train, y_train = train_df[FEATURE_COLS], train_df[TARGET_COL]
    X_test, y_test = test_df[FEATURE_COLS], test_df[TARGET_COL]

    xgb_model = xgb.XGBRegressor(**best_params).fit(X_train, y_train)
    xgb_preds = xgb_model.predict(X_test)

    rf_model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=3,
                                     random_state=42, n_jobs=-1).fit(X_train, y_train)
    rf_preds = rf_model.predict(X_test)

    print("--- Individual models ---")
    evaluate(y_test.values, xgb_preds, "XGBoost")
    evaluate(y_test.values, rf_preds, "Random Forest")

    best_weight, best_mae = 1.0, float("inf")
    for w in np.arange(0.3, 1.01, 0.1):
        mae = mean_absolute_error(y_test, w * xgb_preds + (1 - w) * rf_preds)
        print(f"XGB weight={w:.1f} -> MAE: {mae:.2f}")
        if mae < best_mae:
            best_mae, best_weight = mae, float(w)
    print(f"\nBest XGBoost weight: {best_weight:.1f}")
    evaluate(y_test.values, best_weight * xgb_preds + (1 - best_weight) * rf_preds, "ENSEMBLE (final)")

    # The Random Forest used in production should see all data, like the final XGBoost
    rf_full = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=3,
                                    random_state=42, n_jobs=-1).fit(df[FEATURE_COLS], df[TARGET_COL])
    joblib.dump(rf_full, "models/rf_model.pkl")
    joblib.dump({"xgb_weight": best_weight}, "models/ensemble_weights.pkl")
    print("\nSaved rf_model.pkl and ensemble_weights.pkl")
