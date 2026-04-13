import os

from pymongo import ASCENDING, DESCENDING, MongoClient

MONGO_USER = os.getenv("MONGO_USER", "admin")
MONGO_PASS = os.getenv("MONGO_PASS", "password123")
MONGO_HOST = os.getenv("MONGO_HOST", "mongo-db")
MONGO_PORT = int(os.getenv("MONGO_PORT", "27017"))
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "review_db")

MONGO_URI = os.getenv(
    "MONGO_URI",
    f"mongodb://{MONGO_USER}:{MONGO_PASS}@{MONGO_HOST}:{MONGO_PORT}",
)

_client = MongoClient(MONGO_URI)
_db = _client[MONGO_DB_NAME]
reviews_collection = _db["reviews"]


def ensure_indexes() -> None:
    reviews_collection.create_index(
        [("buyer_id", ASCENDING), ("order_id", ASCENDING), ("book_id", ASCENDING)],
        unique=True,
        name="uq_buyer_order_book_review",
    )
    reviews_collection.create_index([("book_id", ASCENDING), ("created_at", DESCENDING)], name="idx_book_created_at")
    reviews_collection.create_index([("order_id", ASCENDING), ("buyer_id", ASCENDING)], name="idx_order_buyer")
