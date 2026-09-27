import pandas as pd
import numpy as np

np.random.seed(42)

crops = {
    'Wheat':  {'base': 2200, 'amp': 150,  'vol': 0.03, 'peak_month': 4},
    'Rice':   {'base': 2800, 'amp': 200,  'vol': 0.03, 'peak_month': 10},
    'Onion':  {'base': 1800, 'amp': 900,  'vol': 0.15, 'peak_month': 9},
    'Tomato': {'base': 1500, 'amp': 1000, 'vol': 0.20, 'peak_month': 7},
    'Potato': {'base': 1200, 'amp': 400,  'vol': 0.10, 'peak_month': 11},
}

markets = [
    ('Maharashtra', 'Pune'), ('Maharashtra', 'Nashik'),
    ('Uttar Pradesh', 'Lucknow'), ('Punjab', 'Ludhiana'),
    ('Uttarakhand', 'Dehradun'),
]

dates = pd.date_range('2020-01-01', '2026-08-31', freq='W')
rows = []

for crop, cfg in crops.items():
    for state, market in markets:
        level = cfg['base'] * np.random.uniform(0.9, 1.1)
        for d in dates:
            season = cfg['amp'] * np.sin(2 * np.pi * (d.month - cfg['peak_month']) / 12)
            trend = (d.year - 2020) * cfg['base'] * 0.04
            level += np.random.normal(0, cfg['base'] * cfg['vol'] * 0.3)
            level = np.clip(level, cfg['base'] * 0.5, cfg['base'] * 2.5)
            modal = max(level + season + trend + np.random.normal(0, cfg['base'] * cfg['vol']), 200)
            rows.append({
                'crop': crop, 'state': state, 'market': market,
                'date': d.strftime('%Y-%m-%d'),
                'minPrice': round(modal * 0.92, 2),
                'maxPrice': round(modal * 1.08, 2),
                'modalPrice': round(modal, 2),
            })

df = pd.DataFrame(rows)
df.to_csv('data/price_history.csv', index=False)
print(f"Generated {len(df):,} rows | {df['crop'].nunique()} crops | {df['market'].nunique()} markets")
print(df.groupby('crop')['modalPrice'].describe()[['mean', 'min', 'max']])