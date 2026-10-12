import joblib
import optuna
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error

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
    return mean_absolute_error(val_df[TARGET_COL], model.predict(val_df[FEATURE_COLS]))


if __name__ == "__main__":
    df = load_data()
    test_start = get_split_date(df)                 # the final test window is never touched
    val_start = test_start - pd.DateOffset(months=6)

    train_df = df[df["date"] < val_start]
    val_df = df[(df["date"] >= val_start) & (df["date"] < test_start)]
    print(f"Tuning on train: {len(train_df)} rows, validate: {len(val_df)} rows")
    print(f"(Test set from {test_start.date()} onward is untouched during tuning)")

    study = optuna.create_study(direction="minimize")
    study.optimize(lambda t: objective(t, train_df, val_df), n_trials=40, show_progress_bar=True)

    print("\nBest MAE:", study.best_value)
    print("Best params:", study.best_params)
    joblib.dump(study.best_params, "models/best_params.pkl")
    print("\nSaved best params to models/best_params.pkl")
