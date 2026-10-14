import os

pre_existing = "MONGO_URI" in os.environ
from dotenv import load_dotenv
load_dotenv()
from pymongo import MongoClient

uri = os.getenv("MONGO_URI", "")
print("MONGO_URI already set in this terminal before reading .env:", pre_existing,
      "<-- this overrides the .env file!" if pre_existing else "")
print("cluster host:", uri.split("@")[-1].split("/")[0] if "@" in uri else "?")
try:
    db = MongoClient(uri, serverSelectionTimeoutMS=8000).get_database()
except Exception as e:
    raise SystemExit(f"Could not pick a database: {e}\nThe URI needs a database name, e.g. .../farmprice?retryWrites=true")
print("database name:", db.name)
print("collections:", db.list_collection_names())
col = db["pricehistories"]
print("rows:", col.count_documents({}))
print("by source:", {str(r["_id"]): r["n"] for r in col.aggregate([{"$group": {"_id": "$source", "n": {"$sum": 1}}}])})
print("markets:", sorted(col.distinct("market")))