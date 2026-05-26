import json
import os

from fastapi import FastAPI
from sqlalchemy import text

from .db import Base, SessionLocal, engine
from . import models
from .routers import reviews

app = FastAPI(
    title="Review Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)

app.include_router(reviews.router)


def _is_dev_seed_enabled() -> bool:
    return os.getenv("DEV_AUTO_SEED", "false").strip().lower() == "true"


def _load_dev_seed_data() -> dict:
    if not _is_dev_seed_enabled():
        return {}
    seed_file = os.getenv("DEV_SEED_FILE", "/app/dev-seeds.json").strip() or "/app/dev-seeds.json"
    if not os.path.exists(seed_file):
        return {}
    try:
        with open(seed_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception as exc:
        print(f"[review-service] Could not load seed file {seed_file}: {exc}")
        return {}


def _apply_seed_reviews(seed_data: dict) -> None:
    reviews_data = seed_data.get("reviews")
    if not isinstance(reviews_data, list) or not reviews_data:
        print("[review-service] No reviews found in seed data.")
        return

    print(f"[review-service] Seeding {len(reviews_data)} reviews...")
    db = SessionLocal()
    inserted = 0
    skipped = 0
    try:
        for entry in reviews_data:
            if not isinstance(entry, dict):
                continue

            buyer_username = str(entry.get("buyer_username", "")).strip()
            seller_username = str(entry.get("seller_username", "")).strip()
            product_title = str(entry.get("product_title", "")).strip()
            rating = entry.get("rating")
            comment_raw = entry.get("comment")
            comment = str(comment_raw).strip() if comment_raw is not None else None

            if not buyer_username or not seller_username or not product_title or rating is None:
                skipped += 1
                continue

            # Resolve buyer_id
            buyer_row = db.execute(
                text("SELECT user_id FROM users WHERE username = :u LIMIT 1"),
                {"u": buyer_username},
            ).mappings().first()
            if not buyer_row:
                skipped += 1
                continue
            buyer_id = buyer_row["user_id"]

            # Resolve book_id via seller username + title
            book_row = db.execute(
                text(
                    """
                    SELECT b.book_id
                    FROM books b
                    JOIN users u ON b.seller_id = u.user_id
                    WHERE u.username = :seller AND b.title = :title
                    LIMIT 1
                    """
                ),
                {"seller": seller_username, "title": product_title},
            ).mappings().first()
            if not book_row:
                skipped += 1
                continue
            book_id = book_row["book_id"]

            # Resolve order_id: find an order for this buyer that contains this book
            order_row = db.execute(
                text(
                    """
                    SELECT o.order_id
                    FROM orders o
                    JOIN order_items oi ON o.order_id = oi.order_id
                    WHERE o.buyer_id = :buyer_id AND oi.book_id = :book_id
                    LIMIT 1
                    """
                ),
                {"buyer_id": buyer_id, "book_id": book_id},
            ).mappings().first()
            if not order_row:
                skipped += 1
                continue
            order_id = order_row["order_id"]

            db.execute(
                text(
                    """
                    INSERT INTO reviews (order_id, book_id, buyer_id, rating, comment)
                    VALUES (:order_id, :book_id, :buyer_id, :rating, :comment)
                    ON CONFLICT ON CONSTRAINT uq_buyer_order_book_review DO NOTHING
                    """
                ),
                {
                    "order_id": order_id,
                    "book_id": book_id,
                    "buyer_id": buyer_id,
                    "rating": int(rating),
                    "comment": comment,
                },
            )
            inserted += 1

        db.commit()
        print(f"[review-service] ✓ {inserted} reviews seeded ({skipped} skipped).")
    except Exception as exc:
        db.rollback()
        print(f"[review-service] ✗ Error seeding reviews: {exc}")
        raise
    finally:
        db.close()


_apply_seed_reviews(_load_dev_seed_data())


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "review"}
