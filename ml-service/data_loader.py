import os

import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()


def load_price_data():
    uri = os.getenv("MONGO_URI")
    if not uri:
        raise RuntimeError("MONGO_URI is not set (check ml-service/.env)")

    client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    db = client.get_database()   # the database named in MONGO_URI - the same one Express uses
    df = pd.DataFrame(list(db["pricehistories"].find({}, {"_id": 0})))
    client.close()

    if df.empty:
        raise RuntimeError(f"No price data found in database '{db.name}'")

    sources = df["source"].value_counts().to_dict() if "source" in df.columns else "unknown"
    print(f"[data_loader] database '{db.name}': {len(df):,} rows, "
          f"{df['market'].nunique()} markets, sources: {sources}")

    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values(["crop", "market", "date"]).reset_index(drop=True)


if __name__ == "__main__":
    d = load_price_data()
    print(d.head())