import glob
import sys
import pandas as pd

path = sys.argv[1] if len(sys.argv) > 1 else glob.glob("data/raw/*.csv")[0]
df = pd.read_csv(path, low_memory=False)
df = df[~df["date"].astype(str).str.startswith("#")]      # skip the HXL tag row
df["date"] = pd.to_datetime(df["date"], errors="coerce")
df["price"] = pd.to_numeric(df["price"], errors="coerce")

print("File:", path)
print("Rows:", len(df), "| dates:", df["date"].min().date(), "to", df["date"].max().date())

print("\nCommodities (rows, markets, first date, last date):")
g = df.groupby("commodity").agg(rows=("price", "size"), markets=("market", "nunique"),
                                first=("date", "min"), last=("date", "max"))
print(g.sort_values("rows", ascending=False).to_string())

if "pricetype" in df.columns:
    print("\nPrice types:", df["pricetype"].value_counts().to_dict())
print("\nRows per year:")
print(df.groupby(df["date"].dt.year).size().to_string())