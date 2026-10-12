"""
Convert a real Agmarknet / CEDA price export into the CSV this app uploads:
    crop,state,market,date,minPrice,maxPrice,modalPrice   (one row per month)

Usage:
    python convert_real_data.py data/raw            (a folder of CSV files)
    python convert_real_data.py data/raw/prices.csv (a single file)
    python convert_real_data.py data/raw --min-months 40   (accept shorter histories)

If a file has no commodity column, the crop is taken from the file name
(e.g. onion_2024.csv, Tomato-2023.csv).

Output: data/real_price_history.csv
Columns are auto-detected (see CANDIDATES). If detection fails, run
inspect_real_data.py and add your column names to CANDIDATES.
"""
import argparse
import glob
import os
import re
import sys
import warnings

import pandas as pd

warnings.filterwarnings("ignore")

# ---- settings you may want to change -------------------------------------
TARGET_CROPS = {            # app crop name -> accepted commodity names (lowercase)
    "Wheat": ["wheat"],
    "Rice": ["rice"],
    "Onion": ["onion", "onions"],
    "Tomato": ["tomato", "tomatoes"],
    "Potato": ["potato", "potatoes"],
}
MAX_MARKETS = 10            # keep the best-covered districts/markets only
MIN_MONTHS = 48             # a series needs at least this many continuous months
HISTORY_MONTHS = 96         # use at most the most recent 8 years
MAX_GAP = 2                 # fill gaps of up to 2 months by interpolation
OUT_PATH = "data/real_price_history.csv"

CANDIDATES = {
    "crop": ["commodity_name", "commodity"],
    "state": ["state_name", "state", "admin1"],
    "market": ["district_name", "district", "market_name", "market"],
    "date": ["date", "month", "price_date", "reported_date", "arrival_date"],
    "modal": ["modal_price", "modal", "modal_price_(rs./quintal)", "price"],
    "min": ["min_price", "min"],
    "max": ["max_price", "max"],
    "unit": ["unit"],                       # WFP files: KG (we convert to INR/quintal)
    "pricetype": ["pricetype", "price_type"],  # WFP files: Retail / Wholesale
}
# ---------------------------------------------------------------------------

CROP_LOOKUP = {a: crop for crop, aliases in TARGET_CROPS.items() for a in aliases}


def norm(c):
    return str(c).strip().lower().replace(" ", "_")


def find_col(columns, candidates):
    lookup = {norm(c): c for c in columns}
    for cand in candidates:
        if norm(cand) in lookup:
            return lookup[norm(cand)]
    return None


def match_crop(name):
    # "Onion", "Onion(Red)" -> onion ; "Sweet Potato" does NOT match "potato"
    return CROP_LOOKUP.get(str(name).lower().split("(")[0].strip())


def parse_dates(series):
    d = pd.to_datetime(series, errors="coerce")
    if d.isna().mean() > 0.3:
        d = pd.to_datetime(series, errors="coerce", dayfirst=True)
    return d


def list_files(arg):
    if os.path.isdir(arg):
        return sorted(glob.glob(os.path.join(arg, "*.csv")))
    return sorted(glob.glob(arg))


def load(paths):
    frames = []
    for path in paths:
        header = pd.read_csv(path, nrows=0)
        cols = {k: find_col(header.columns, v) for k, v in CANDIDATES.items()}
        year_col = find_col(header.columns, ["year"])
        file_crop = None
        if cols["crop"] is None:
            tokens = set(re.split(r"[^a-z]+", os.path.basename(path).lower()))
            file_crop = next((crop for alias, crop in CROP_LOOKUP.items() if alias in tokens), None)
            if file_crop is None:
                sys.exit(f"{path}: no commodity column and no crop name in the file name. "
                         f"Rename it like onion_2024.csv.")
        missing = [k for k in ("market", "date", "modal") if cols[k] is None]
        if missing:
            sys.exit(f"{path}: could not find columns for {missing}. "
                     f"Columns present: {list(header.columns)}\n"
                     f"Add the right names to CANDIDATES in this script.")
        use = [c for c in set(cols.values()) | {year_col} if c is not None]
        print(f"Reading {os.path.basename(path)} ...")
        for chunk in pd.read_csv(path, usecols=use, chunksize=500_000, low_memory=False):
            chunk["_crop"] = file_crop if file_crop else chunk[cols["crop"]].map(match_crop)
            chunk = chunk[chunk["_crop"].notna()]
            if chunk.empty:
                continue
            if year_col is not None and pd.api.types.is_numeric_dtype(chunk[cols["date"]]):
                date = pd.to_datetime(dict(year=chunk[year_col], month=chunk[cols["date"]], day=1),
                                      errors="coerce")
            else:
                date = parse_dates(chunk[cols["date"]])
            factor = pd.Series(1.0, index=chunk.index)   # Agmarknet is already INR per quintal
            if cols["unit"]:
                u = chunk[cols["unit"]].astype(str).str.lower().str.strip()
                factor = u.map(lambda x: 100.0 if x in ("kg", "kilogram", "kilograms")
                               else (1.0 if x in ("quintal", "100 kg", "100kg") else float("nan")))
            f = factor.values
            frames.append(pd.DataFrame({
                "crop": chunk["_crop"].values,
                "ptype": chunk[cols["pricetype"]].astype(str).str.lower().str.strip().values if cols["pricetype"] else "n/a",
                "state": chunk[cols["state"]].values if cols["state"] else "Unknown",
                "market": chunk[cols["market"]].astype(str).str.strip().values,
                "date": date.values,
                "min": pd.to_numeric(chunk[cols["min"]], errors="coerce").values * f if cols["min"] else float("nan"),
                "max": pd.to_numeric(chunk[cols["max"]], errors="coerce").values * f if cols["max"] else float("nan"),
                "modal": pd.to_numeric(chunk[cols["modal"]], errors="coerce").values * f,
            }))
    if not frames:
        sys.exit("No rows matched your target crops. Check TARGET_CROPS against the "
                 "commodity names printed by inspect_real_data.py.")
    return pd.concat(frames, ignore_index=True)


def last_continuous(s):
    """Latest unbroken stretch of a monthly series (NaN = gap)."""
    ok = s.notna()
    seg_id = (~ok).cumsum()
    seg = s[ok]
    return seg[seg_id[ok] == seg_id[ok].iloc[-1]]


def main():
    ap = argparse.ArgumentParser(description="Convert Agmarknet/CEDA exports to the app's CSV format")
    ap.add_argument("path", help="a CSV file or a folder of CSV files")
    ap.add_argument("--min-months", type=int, default=MIN_MONTHS)
    ap.add_argument("--max-markets", type=int, default=MAX_MARKETS)
    ap.add_argument("--price-type", default="auto", choices=["auto", "retail", "wholesale"],
                    help="for files with both: auto = whichever has more rows")
    ap.add_argument("--max-age-months", type=int, default=3,
                    help="drop series that stopped reporting this many months before the newest data")
    args = ap.parse_args()
    min_months, max_markets = args.min_months, args.max_markets

    paths = list_files(args.path)
    if not paths:
        sys.exit(f"No CSV files found at {args.path}")

    df = load(paths)
    df = df.dropna(subset=["date", "modal"])
    df = df[df["modal"] > 0]
    types = df["ptype"].value_counts()
    if len(types) > 1:
        keep = types.index[0] if args.price_type == "auto" else args.price_type
        if keep not in types.index:
            sys.exit(f"Price type '{keep}' not in file. Found: { {k: int(v) for k, v in types.items()} }")
        print(f"Price types found: { {k: int(v) for k, v in types.items()} } -> keeping only '{keep}'")
        df = df[df["ptype"] == keep]
    print(f"Matched {len(df):,} rows for crops: {sorted(df['crop'].unique())}")

    # drop obviously wrong prices (unit slips, typos) per crop
    med = df.groupby("crop")["modal"].transform("median")
    df = df[(df["modal"] < med * 8) & (df["modal"] > med / 8)]

    # the same market name in two states would merge two different series
    n_states = df.groupby("market")["state"].nunique()
    ambiguous = n_states[n_states > 1].index
    df.loc[df["market"].isin(ambiguous), "market"] = df["market"] + " (" + df["state"].astype(str) + ")"

    df["month"] = df["date"].dt.to_period("M").dt.to_timestamp()
    monthly = (df.groupby(["crop", "state", "market", "month"])
                 .agg(minPrice=("min", "min"), maxPrice=("max", "max"), modalPrice=("modal", "mean"))
                 .reset_index())

    latest_month = monthly["month"].max()
    cutoff = latest_month - pd.DateOffset(months=args.max_age_months)
    print(f"Newest month in the data: {latest_month:%Y-%m}. Series must reach {cutoff:%Y-%m} or later.")
    kept = []
    n_series = too_short = stale = 0
    for (crop, state, market), g in monthly.groupby(["crop", "state", "market"]):
        n_series += 1
        g = g.set_index("month").sort_index()
        full = pd.date_range(g.index.min(), g.index.max(), freq="MS")
        g = g.reindex(full)
        g["modalPrice"] = g["modalPrice"].interpolate(limit=MAX_GAP)
        seg = last_continuous(g["modalPrice"]).tail(HISTORY_MONTHS)
        if len(seg) < min_months:
            too_short += 1
            continue
        if seg.index.max() < cutoff:
            stale += 1
            continue
        out = g.loc[seg.index, ["minPrice", "maxPrice"]].copy()
        out["modalPrice"] = seg
        out["crop"], out["state"], out["market"] = crop, state, market
        kept.append(out.rename_axis("date").reset_index())
    print(f"Series checked: {n_series} | too short: {too_short} | stopped reporting early: {stale} | usable: {len(kept)}")
    if not kept:
        sys.exit(f"No series had {min_months}+ continuous recent months. Try --min-months 36, or --max-age-months 40 to accept series that stopped earlier (the forecast will then be for an older month).")
    series = pd.concat(kept, ignore_index=True)

    # keep the markets that cover the most crops, then the longest histories
    wanted = series["crop"].nunique()
    cover = (series.groupby(["state", "market"])
                   .agg(crops=("crop", "nunique"), months=("date", "size")).reset_index())
    full_cover = cover[cover["crops"] == wanted]
    if len(full_cover) >= 3:
        top = full_cover.sort_values("months", ascending=False).head(max_markets)
    else:
        print(f"WARNING: only {len(full_cover)} markets have all {wanted} crops; "
              f"keeping the best-covered ones (some crop/market pairs will be missing).")
        top = cover.sort_values(["crops", "months"], ascending=False).head(max_markets)
    series = series.merge(top[["state", "market"]], on=["state", "market"])

    series["date"] = series["date"].dt.strftime("%Y-%m-%d")
    for c in ("minPrice", "maxPrice", "modalPrice"):
        series[c] = series[c].round(2)
    series = series[["crop", "state", "market", "date", "minPrice", "maxPrice", "modalPrice"]]
    series = series.sort_values(["crop", "market", "date"])

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    series.to_csv(OUT_PATH, index=False)
    print(f"\nSaved {len(series):,} monthly rows to {OUT_PATH}")
    print(f"Crops:   {sorted(series['crop'].unique())}")
    print(f"Markets: {sorted(series['market'].unique())}")
    print(f"Range:   {series['date'].min()} to {series['date'].max()}")
    print("\nNext: upload this file on the app's Data page.")


if __name__ == "__main__":
    main()
