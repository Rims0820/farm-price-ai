import pandas as pd

TEST_MONTHS = 12


def get_split_date(df, test_months=TEST_MONTHS):
    """Test set = the last `test_months` months of rows that have a target.
    Works for any dataset (synthetic or real) and keeps working as new data arrives."""
    last = df["date"].max()
    return (last - pd.DateOffset(months=test_months - 1)).replace(day=1)
