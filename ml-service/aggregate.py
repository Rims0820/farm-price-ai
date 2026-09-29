import pandas as pd
from data_loader import load_price_data

def aggregate_monthly(df):
    df["year_month"] = df["date"].dt.to_period("M")

    monthly = (
        df.groupby(["crop", "state", "market", "year_month"])
        .agg(
            avg_price=("modalPrice", "mean"),
            min_price=("minPrice", "min"),
            max_price=("maxPrice", "max"),
            price_std=("modalPrice", "std"),
            record_count=("modalPrice", "count"),
        )
        .reset_index()
    )

    monthly["date"] = monthly["year_month"].dt.to_timestamp()
    monthly["year"] = monthly["date"].dt.year
    monthly["month"] = monthly["date"].dt.month
    monthly = monthly.drop(columns=["year_month"])
    monthly["price_std"] = monthly["price_std"].fillna(0)

    return monthly.sort_values(["crop", "market", "date"]).reset_index(drop=True)

if __name__ == "__main__":
    df = load_price_data()
    monthly = aggregate_monthly(df)

    print(f"Aggregated to {len(monthly):,} monthly records")
    print(monthly.head(10))

    monthly.to_csv("data/monthly_prices.csv", index=False)
    print("Saved to data/monthly_prices.csv")