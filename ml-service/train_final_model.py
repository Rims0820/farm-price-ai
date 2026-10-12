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
    return mae


if __name__ == "__main__":
    df = load_data()
    best_params = joblib.load("models/best_params.pkl")
    best_params["random_state"] = 42
    best_params["objective"] = "reg:squarederror"

    split = get_split_date(df)
    train_df = df[df["date"] < split]
    test_df = df[df["date"] >= split].copy()

    model = xgb.XGBRegressor(**best_params)
    model.fit(train_df[FEATURE_COLS], train_df[TARGET_COL])
    preds = model.predict(test_df[FEATURE_COLS])
    evaluate(test_df[TARGET_COL].values, preds, "TUNED MODEL (test set)")

    old_model = joblib.load("models/xgb_price_model.pkl")
    evaluate(test_df[TARGET_COL].values, old_model.predict(test_df[FEATURE_COLS]), "OLD MODEL (default params)")

    # Save the tuned model's held-out predictions: the Accuracy page and the
    # forecast confidence range are both computed from this file.
    test_df["prediction"] = preds
    test_df["abs_error"] = (test_df["prediction"] - test_df[TARGET_COL]).abs()
    test_df["pct_error"] = test_df["abs_error"] / test_df[TARGET_COL] * 100
    test_df.to_csv("data/test_predictions.csv", index=False)

    # Production model: retrain on ALL data
    full_model = xgb.XGBRegressor(**best_params)
    full_model.fit(df[FEATURE_COLS], df[TARGET_COL])
    joblib.dump(full_model, "models/xgb_price_model_final.pkl")
    print("\nFinal production model saved to models/xgb_price_model_final.pkl")
