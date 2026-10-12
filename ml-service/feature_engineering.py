import pandas as pd
import numpy as np


def build_features(monthly: pd.DataFrame) -> pd.DataFrame:
    df = monthly.copy()
    df = df.sort_values(["crop", "market", "date"]).reset_index(drop=True)

    group_cols = ["crop", "market"]

    # --- Lag features: price N months ago ---
    for lag in [1, 2, 3, 6, 12]:
        df[f"lag_{lag}"] = df.groupby(group_cols)["avg_price"].shift(lag)

    # --- Rolling statistics (past values only, no leakage) ---
    df["roll_mean_3"] = df.groupby(group_cols)["avg_price"].transform(lambda x: x.shift(1).rolling(window=3).mean())
    df["roll_mean_6"] = df.groupby(group_cols)["avg_price"].transform(lambda x: x.shift(1).rolling(window=6).mean())
    df["roll_std_3"] = df.groupby(group_cols)["avg_price"].transform(lambda x: x.shift(1).rolling(window=3).std())

    # --- Momentum ---
    df["pct_change_1m"] = (df["avg_price"] - df["lag_1"]) / df["lag_1"] * 100
    df["pct_change_3m"] = (df["avg_price"] - df["lag_3"]) / df["lag_3"] * 100

    # --- Seasonal encoding ---
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

    # --- Trend ---
    df["time_index"] = (df["date"].dt.year - df["date"].dt.year.min()) * 12 + df["date"].dt.month

    # --- TARGET: next month's price for this crop+market ---
    df["target_next_month"] = df.groupby(group_cols)["avg_price"].shift(-1)

    return df


def clean_features(df: pd.DataFrame) -> pd.DataFrame:
    required_cols = ["lag_1", "lag_3", "lag_6", "lag_12", "roll_mean_3", "target_next_month"]
    before = len(df)
    df_clean = df.dropna(subset=required_cols).reset_index(drop=True)
    print(f"Dropped {before - len(df_clean)} rows lacking full lag history or target (kept {len(df_clean)})")
    return df_clean


def latest_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Newest row per crop+market. It has every input but no target yet, which is
    exactly the row we need to forecast the month AFTER the latest data."""
    needed = ["lag_1", "lag_3", "lag_6", "lag_12", "roll_mean_3"]
    return df.dropna(subset=needed).sort_values("date").groupby(["crop", "market"]).tail(1)


if __name__ == "__main__":
    monthly = pd.read_csv("data/monthly_prices.csv", parse_dates=["date"])
    print(f"Input: {len(monthly):,} monthly records")

    features = build_features(monthly)
    features_clean = clean_features(features)
    features_clean.to_csv("data/features.csv", index=False)
    print(f"Saved {len(features_clean):,} training rows to data/features.csv")

    latest = latest_rows(features)
    latest.to_csv("data/features_latest.csv", index=False)
    print(f"Saved {len(latest):,} forecast rows to data/features_latest.csv")
