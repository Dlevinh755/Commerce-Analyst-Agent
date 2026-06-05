import os

from fastapi import FastAPI
from sqlalchemy import text

from .db import Base, SessionLocal, engine
from .routers import cart

app = FastAPI(
    title="Cart Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)

app.include_router(cart.router)


def _is_dev_seed_enabled() -> bool:
    return os.getenv("DEV_AUTO_SEED", "false").strip().lower() == "true"


def _apply_seed_cart() -> None:
    if not _is_dev_seed_enabled():
        return
    db = SessionLocal()
    try:
        # First, try to load from dev-seeds.json
        seed_file = os.getenv("DEV_SEED_FILE", "/app/dev-seeds.json").strip() or "/app/dev-seeds.json"
        seeded_from_json = False
        if os.path.exists(seed_file):
            try:
                import json
                with open(seed_file, "r", encoding="utf-8") as f:
                    seed_data = json.load(f)
                seed_carts = seed_data.get("carts")
                if isinstance(seed_carts, list) and seed_carts:
                    print(f"[cart-service] Seeding {len(seed_carts)} carts from json...")
                    for entry in seed_carts:
                        if not isinstance(entry, dict):
                            continue
                        buyer_username = str(entry.get("buyer_username", "")).strip()
                        product_title = str(entry.get("product_title", "")).strip()
                        seller_username = str(entry.get("seller_username", "")).strip()
                        quantity = int(entry.get("quantity", 1))

                        if not buyer_username or not product_title or not seller_username:
                            continue

                        buyer_row = db.execute(
                            text("SELECT user_id FROM users WHERE username = :u LIMIT 1"),
                            {"u": buyer_username}
                        ).mappings().first()

                        book_row = db.execute(
                            text(
                                """
                                SELECT b.book_id FROM books b
                                JOIN users u ON b.seller_id = u.user_id
                                WHERE u.username = :s AND b.title = :t LIMIT 1
                                """
                            ),
                            {"s": seller_username, "t": product_title}
                        ).mappings().first()

                        if buyer_row and book_row:
                            db.execute(
                                text(
                                    """
                                    INSERT INTO cart (buyer_id, book_id, quantity)
                                    VALUES (:b_id, :bk_id, :qty)
                                    ON CONFLICT (buyer_id, book_id) DO NOTHING
                                    """
                                ),
                                {
                                    "b_id": buyer_row["user_id"],
                                    "bk_id": book_row["book_id"],
                                    "qty": quantity
                                }
                            )
                    db.commit()
                    seeded_from_json = True
            except Exception as json_exc:
                print(f"[cart-service] Warning: JSON cart seed failed, falling back to SQL: {json_exc}")

        if not seeded_from_json:
            # Fallback to the original SQL-based pending orders cart generation
            db.execute(
                text(
                    """
                    INSERT INTO cart (buyer_id, book_id, quantity)
                    SELECT DISTINCT o.buyer_id, oi.book_id, 1
                    FROM orders o
                    JOIN order_items oi ON o.order_id = oi.order_id
                    WHERE o.status = 'pending'
                    LIMIT 500
                    ON CONFLICT (buyer_id, book_id) DO NOTHING
                    """
                )
            )
            db.commit()
            
        result = db.execute(text("SELECT COUNT(*) FROM cart")).scalar()
        print(f"[cart-service] ✓ Cart items seeded. Total: {result}")
    except Exception as exc:
        db.rollback()
        print(f"[cart-service] ✗ Error seeding cart: {exc}")
        raise
    finally:
        db.close()


_apply_seed_cart()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "cart"}