import shap
import pandas as pd

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
    "month_sin": "Seasonal factor",
    "month_cos": "Seasonal factor",
    "time_index": "Overall market trend",
    "price_std": "Within-month price spread",
    "crop_encoded": "Crop type",
    "market_encoded": "Market location",
}

_explainer_cache = {}

def get_explainer(model, model_key="default"):
    """Cache the SHAP explainer per model so it's not rebuilt on every request."""
    if model_key not in _explainer_cache:
        _explainer_cache[model_key] = shap.TreeExplainer(model)
    return _explainer_cache[model_key]


def explain_prediction(model, feature_row_df, model_key="default", top_n=4):
    """
    feature_row_df: a single-row DataFrame with the feature columns.
    Returns a list of top contributing factors in plain language.
    """
    explainer = get_explainer(model, model_key)
    shap_values = explainer(feature_row_df)

    contributions = pd.DataFrame({
        "feature": feature_row_df.columns,
        "impact": shap_values.values[0]
    })
    contributions["abs_impact"] = contributions["impact"].abs()
    contributions = contributions.sort_values("abs_impact", ascending=False).head(top_n)

    explanations = []
    for _, row in contributions.iterrows():
        label = FEATURE_LABELS.get(row["feature"], row["feature"])
        direction = "increased" if row["impact"] > 0 else "decreased"
        explanations.append({
            "factor": label,
            "effect": direction,
            "impact_amount": round(float(row["impact"]), 2)
        })

    return explanations