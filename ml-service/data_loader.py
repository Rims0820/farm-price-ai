import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

def load_price_data():
    client = MongoClient(os.getenv("MONGO_URI"))
    db = client.get_database("farmprice")  # explicitly specify the database name
    collection = db["pricehistories"]

    cursor = collection.find({}, {"_id": 0})
    df = pd.DataFrame(list(cursor))

    if df.empty:
            client.close()
            raise ValueError("No price records found in farmprice.pricehistories. Run the server seed script first.")

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["crop", "market", "date"]).reset_index(drop=True)

    client.close()
    return df

if __name__ == "__main__":
    df = load_price_data()
    print(f"Loaded {len(df):,} rows")
    print(df.info())
    print(df.head())