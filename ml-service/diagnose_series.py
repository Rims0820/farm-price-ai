"""Shows where each crop/market series starts and ends, to pick the best cut-off.
Usage: python diagnose_series.py data/raw"""
import sys

import pandas as pd

import convert_real_data as c

paths = c.list_files(sys.argv[1] if len(sys.argv) > 1 else "data/raw")
df = c.load(paths).dropna(subset=["date", "modal"])
df = df[df["modal"] > 0]
df = df[df["ptype"] == df["ptype"].value_counts().index[0]]      # same price type as the converter
df["month"] = df["date"].dt.to_period("M").dt.to_timestamp()
m = df.groupby(["crop", "market", "month"])["modal"].mean().reset_index()
newest = m["month"].max()

rows = []
for (crop, market), g in m.groupby(["crop", "market"]):
    s = g.set_index("month")["modal"].sort_index()
    s = s.reindex(pd.date_range(s.index.min(), s.index.max(), freq="MS")).interpolate(limit=2)
    seg = c.last_continuous(s)
    rows.append({"crop": crop, "market": market, "first": s.index.min(), "last": s.index.max(),
                 "run": len(seg), "run_start": seg.index.min()})
r = pd.DataFrame(rows)
n_crops = r["crop"].nunique()

print(f"\nNewest month in file: {newest:%Y-%m} | crop/market series: {len(r)} | crops: {sorted(r['crop'].unique())}")

print("\nA) Series by the year they STOP reporting:")
print(r.groupby(r["last"].dt.year).size().to_string())

print("\nB) Series that report in the newest 6 months - longest unbroken run (months):")
recent = r[r["last"] >= newest - pd.DateOffset(months=6)]
if recent.empty:
    print("   none")
else:
    print(recent.pivot_table(index="market", columns="crop", values="run", aggfunc="max").fillna(0).astype(int).head(40).to_string())
    print(f"   -> longest run among them: {recent['run'].max()} months")

print("\nC) Markets with ALL crops having 48+ unbroken months, grouped by when they stop (quarter):")
full = r[r["run"] >= 48]
bm = full.groupby("market").agg(crops=("crop", "nunique"), stops=("last", "min"))
ok = bm[bm["crops"] == n_crops]
if ok.empty:
    print("   none (try the 36-month version below)")
else:
    print(ok.groupby(ok["stops"].dt.to_period("Q")).size().to_string())

print("\nD) Same as C but with only 36+ unbroken months:")
full36 = r[r["run"] >= 36]
bm36 = full36.groupby("market").agg(crops=("crop", "nunique"), stops=("last", "min"))
ok36 = bm36[bm36["crops"] == n_crops]
print("   none" if ok36.empty else ok36.groupby(ok36["stops"].dt.to_period("Q")).size().to_string())