import pandas as pd
import numpy as np
import shap
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import os

os.makedirs("eda_output", exist_ok=True)

FEATURE_COLS = [
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
    "roll_mean_3", "roll_mean_6", "roll_std_3",
    "pct_change_1m", "pct_change_3m",
    "month_sin", "month_cos", "time_index", "price_std",
    "crop_encoded", "market_encoded"
]

FEATURE_LABELS = {
    "lag_1": "Last month's price",
    "lag_2": "Price 2 months ago",
    "lag_3": "Price 3 months ago",
    "lag_6": "Price 6 months ago",
    "lag_12": "Price 1 year ago",
    "roll_mean_3": "3-month average price",
    "roll_mean_6": "6-month average price",
    "roll_std_3": "Recent price volatility",
    "pct_change_1m": "1-month price change %",
    "pct_change_3m": "3-month price change %",
    "month_sin": "Seasonal factor (sin)",
    "month_cos": "Seasonal factor (cos)",
    "time_index": "Overall time trend",
    "price_std": "Within-month price spread",
    "crop_encoded": "Crop type",
    "market_encoded": "Market location",
}

def load_model_and_data():
    df = pd.read_csv("data/features.csv", parse_dates=["date"])
    crop_encoder = joblib.load("models/crop_encoder.pkl")
    market_encoder = joblib.load("models/market_encoder.pkl")
    df["crop_encoded"] = crop_encoder.transform(df["crop"])
    df["market_encoded"] = market_encoder.transform(df["market"])

    model_path = "models/xgb_price_model_final.pkl"
    if not os.path.exists(model_path):
        model_path = "models/xgb_price_model.pkl"
    model = joblib.load(model_path)

    return model, df, crop_encoder, market_encoder


if __name__ == "__main__":
    model, df, crop_encoder, market_encoder = load_model_and_data()

    X = df[FEATURE_COLS]

    print("Computing SHAP values (this can take a minute)...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X)

    # --- Global feature importance (mean absolute SHAP value per feature) ---
    mean_abs_shap = np.abs(shap_values.values).mean(axis=0)
    importance_df = pd.DataFrame({
        "feature": FEATURE_COLS,
        "label": [FEATURE_LABELS[f] for f in FEATURE_COLS],
        "mean_abs_shap": mean_abs_shap
    }).sort_values("mean_abs_shap", ascending=False)

    print("\n--- Global Feature Importance (SHAP) ---")
    print(importance_df.to_string(index=False))

    # --- Summary plot: shows impact direction and magnitude per feature ---
    plt.figure(figsize=(10, 8))
    shap.summary_plot(shap_values.values, X, feature_names=[FEATURE_LABELS[f] for f in FEATURE_COLS], show=False)
    plt.tight_layout()
    plt.savefig("eda_output/6_shap_summary.png", dpi=120, bbox_inches="tight")
    plt.close()
    print("\nSaved SHAP summary plot to eda_output/6_shap_summary.png")

    # --- Example: explain one specific prediction ---
    sample_idx = df[(df["crop"] == "Onion")].index[-1]
    sample_row = X.loc[[sample_idx]]
    sample_shap = explainer(sample_row)

    print(f"\n--- Example explanation: Onion prediction (row {sample_idx}) ---")
    print(f"Base value (average prediction): {sample_shap.base_values[0]:.2f}")
    print(f"Final prediction: {sample_shap.base_values[0] + sample_shap.values[0].sum():.2f}")
    print("\nTop contributing factors:")
    contributions = pd.DataFrame({
        "feature": [FEATURE_LABELS[f] for f in FEATURE_COLS],
        "impact": sample_shap.values[0]
    }).sort_values("impact", key=abs, ascending=False)
    print(contributions.to_string(index=False))

    # Waterfall plot for this one example
    plt.figure(figsize=(10, 6))
    shap.plots.waterfall(sample_shap[0], show=False)
    plt.tight_layout()
    plt.savefig("eda_output/7_shap_waterfall_example.png", dpi=120, bbox_inches="tight")
    plt.close()
    print("\nSaved example waterfall plot to eda_output/7_shap_waterfall_example.png")