import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

df = pd.read_csv("data/test_predictions.csv", parse_dates=["date"])

crops = df["crop"].unique()
fig, axes = plt.subplots(len(crops), 1, figsize=(12, 4 * len(crops)))

for ax, crop in zip(axes, crops):
    crop_df = df[df["crop"] == crop].groupby("date").agg(
        actual=("target_next_month", "mean"),
        predicted=("prediction", "mean")
    ).reset_index()

    ax.plot(crop_df["date"], crop_df["actual"], label="Actual", marker="o")
    ax.plot(crop_df["date"], crop_df["predicted"], label="Predicted", marker="x")
    ax.set_title(f"{crop}: Actual vs Predicted Next-Month Price")
    ax.legend()
    ax.set_ylabel("Price (INR/quintal)")

plt.tight_layout()
plt.savefig("eda_output/5_predictions_vs_actual.png", dpi=120)
print("Saved to eda_output/5_predictions_vs_actual.png")