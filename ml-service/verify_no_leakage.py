import pandas as pd

df = pd.read_csv("data/features.csv", parse_dates=["date"])

# Pick one crop+market and manually trace a few rows
sample = df[(df["crop"] == "Onion") & (df["market"] == "Pune")].sort_values("date").head(5)

print("Manual trace — Onion, Pune:")
print(sample[["date", "avg_price", "lag_1", "lag_3", "target_next_month"]].to_string(index=False))

print("\nCheck: does target_next_month for row N match avg_price of row N+1?")
full_series = df[(df["crop"] == "Onion") & (df["market"] == "Pune")].sort_values("date").reset_index(drop=True)
mismatches = 0
for i in range(len(full_series) - 1):
    target = full_series.loc[i, "target_next_month"]
    actual_next = full_series.loc[i + 1, "avg_price"]
    if abs(target - actual_next) > 0.01:
        mismatches += 1
print(f"Mismatches found: {mismatches} (should be 0)")

# Check lag_1 correctness too
print("\nCheck: does lag_1 for row N match avg_price of row N-1?")
lag_mismatches = 0
for i in range(1, len(full_series)):
    lag1 = full_series.loc[i, "lag_1"]
    actual_prev = full_series.loc[i - 1, "avg_price"]
    if pd.notna(lag1) and abs(lag1 - actual_prev) > 0.01:
        lag_mismatches += 1
print(f"Lag mismatches found: {lag_mismatches} (should be 0)")