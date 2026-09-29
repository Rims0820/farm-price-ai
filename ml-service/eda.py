import pandas as pd
import matplotlib
matplotlib.use("Agg")  # non-interactive backend, saves files instead of popping windows
import matplotlib.pyplot as plt
import seaborn as sns
import os

os.makedirs("eda_output", exist_ok=True)
sns.set_theme(style="whitegrid")

monthly = pd.read_csv("data/monthly_prices.csv", parse_dates=["date"])

# 1. Price trend per crop (averaged across markets) over time
plt.figure(figsize=(12, 6))
for crop in monthly["crop"].unique():
    crop_data = monthly[monthly["crop"] == crop].groupby("date")["avg_price"].mean()
    plt.plot(crop_data.index, crop_data.values, label=crop)
plt.title("Average Monthly Price Trend by Crop (2020-2026)")
plt.xlabel("Date")
plt.ylabel("Price (INR/quintal)")
plt.legend()
plt.tight_layout()
plt.savefig("eda_output/1_price_trends.png", dpi=120)
plt.close()

# 2. Seasonality - average price by month, per crop
plt.figure(figsize=(12, 6))
seasonal = monthly.groupby(["crop", "month"])["avg_price"].mean().reset_index()
sns.lineplot(data=seasonal, x="month", y="avg_price", hue="crop", marker="o")
plt.title("Seasonal Pattern: Avg Price by Calendar Month")
plt.xlabel("Month (1=Jan, 12=Dec)")
plt.ylabel("Average Price (INR/quintal)")
plt.xticks(range(1, 13))
plt.tight_layout()
plt.savefig("eda_output/2_seasonality.png", dpi=120)
plt.close()

# 3. Volatility comparison across crops (box plot of price_std)
plt.figure(figsize=(10, 6))
sns.boxplot(data=monthly, x="crop", y="price_std")
plt.title("Price Volatility by Crop (std dev within each month)")
plt.ylabel("Price Std Dev")
plt.tight_layout()
plt.savefig("eda_output/3_volatility.png", dpi=120)
plt.close()

# 4. Market-to-market price comparison for one crop (example: Onion)
plt.figure(figsize=(12, 6))
onion = monthly[monthly["crop"] == "Onion"]
for market in onion["market"].unique():
    m_data = onion[onion["market"] == market]
    plt.plot(m_data["date"], m_data["avg_price"], label=market)
plt.title("Onion Price Across Different Markets")
plt.xlabel("Date")
plt.ylabel("Price (INR/quintal)")
plt.legend()
plt.tight_layout()
plt.savefig("eda_output/4_market_comparison_onion.png", dpi=120)
plt.close()

# 5. Correlation: does last month's price predict next month's? (autocorrelation check)
print("\n--- Summary Statistics per Crop ---")
summary = monthly.groupby("crop")["avg_price"].agg(["mean", "std", "min", "max"])
summary["coefficient_of_variation"] = summary["std"] / summary["mean"]
print(summary.round(2))

print("\n--- Month-over-month price change (volatility indicator) ---")
monthly_sorted = monthly.sort_values(["crop", "market", "date"])
monthly_sorted["prev_price"] = monthly_sorted.groupby(["crop", "market"])["avg_price"].shift(1)
monthly_sorted["pct_change"] = ((monthly_sorted["avg_price"] - monthly_sorted["prev_price"])
                                  / monthly_sorted["prev_price"] * 100)
change_summary = monthly_sorted.groupby("crop")["pct_change"].agg(["mean", "std"]).round(2)
print(change_summary)

print("\nAll plots saved to eda_output/ folder.")