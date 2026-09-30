import pandas as pd

df = pd.read_csv("data/features.csv")

numeric_cols = [
    "avg_price", "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m", "month_sin", "month_cos",
    "time_index", "price_std", "target_next_month"
]

corr = df[numeric_cols].corr()["target_next_month"].sort_values(ascending=False)
print("Correlation with target_next_month:")
print(corr.round(3))