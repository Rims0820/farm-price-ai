# EDA Findings — Day 3

## Dataset
- ~2,000 monthly records across 5 crops × 5 markets, 2020–2026 (synthetic)

## Key observations
- All crops show a long-term upward price trend (~4%/year inflation baked into synthetic data)
- Each crop has a distinct seasonal peak month — confirms "month" must be a feature
- Onion and Tomato show highest volatility (coefficient of variation) — expect lower forecast accuracy for these
- Wheat and Rice are comparatively stable — good candidates for validating baseline model accuracy first
- [Add your own observations after reviewing the charts]

## Implications for feature engineering (Day 4)
- Include lag features: last 1, 3, 6 month prices
- Include month as a cyclical/categorical feature (not raw integer)
- Consider per-crop models given differing volatility patterns
- Rolling average (3-month) likely useful to smooth noise for volatile crops