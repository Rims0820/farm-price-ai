import pandas as pd
import numpy as np
import xgboost as xgb
import optuna
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import LabelEncoder
import joblib

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded"
]
TARGET_COL = "target_next_month"

TRAIN_END = "2025-01-01"     # train on data before this
VAL_START = "2025-01-01"     # validate on this window
VAL_END = "2025-06-01"       # test set (Day 5) starts here — never touch it during tuning


def load_data():
    df = pd.read_csv("data/features.csv", parse_dates=["date"])
    crop_encoder = joblib.load("models/crop_encoder.pkl")
    market_encoder = joblib.load("models/market_encoder.pkl")
    df["crop_encoded"] = crop_encoder.transform(df["crop"])
    df["market_encoded"] = market_encoder.transform(df["market"])
    return df


def objective(trial, train_df, val_df):
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 100, 600),
        "max_depth": trial.suggest_int("max_depth", 3, 8),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
        "subsample": trial.suggest_float("subsample", 0.6, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
        "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
        "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 5.0),
        "reg_lambda": trial.suggest_float("reg_lambda", 0.0, 5.0),
        "random_state": 42,
        "objective": "reg:squarederror",
    }

    model = xgb.XGBRegressor(**params)
    model.fit(train_df[FEATURE_COLS], train_df[TARGET_COL], verbose=False)
    preds = model.predict(val_df[FEATURE_COLS])
    mae = mean_absolute_error(val_df[TARGET_COL], preds)
    return mae


if __name__ == "__main__":
    df = load_data()

    train_df = df[df["date"] < TRAIN_END]
    val_df = df[(df["date"] >= VAL_START) & (df["date"] < VAL_END)]

    print(f"Tuning on train: {len(train_df)} rows, validate: {len(val_df)} rows")
    print("(Test set from Day 5, June 2025 onward, is untouched during tuning)")

    study = optuna.create_study(direction="minimize")
    study.optimize(lambda trial: objective(trial, train_df, val_df), n_trials=40, show_progress_bar=True)

    print("\nBest MAE:", study.best_value)
    print("Best params:", study.best_params)

    joblib.dump(study.best_params, "models/best_params.pkl")
    print("\nSaved best params to models/best_params.pkl")