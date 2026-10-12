"""Look at a downloaded price file BEFORE converting it.
Usage: python inspect_real_data.py data/raw/yourfile.csv
"""
import sys
import pandas as pd

if len(sys.argv) < 2:
    sys.exit("Usage: python inspect_real_data.py <path-to-csv>")

df = pd.read_csv(sys.argv[1], nrows=200000, low_memory=False)
print(f"\nColumns ({len(df.columns)}):")
for c in df.columns:
    print(f"  - {c}  [{df[c].dtype}]")

print("\nFirst 5 rows:")
print(df.head(5).to_string())

for c in df.columns:
    if any(k in c.lower() for k in ("commodity", "state")):
        print(f"\nDistinct values in '{c}' (top 40 of {df[c].nunique()}):")
        print(df[c].value_counts().head(40).to_string())
