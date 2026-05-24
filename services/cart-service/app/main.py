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
        # Add cart items for buyers with pending orders (simulate in-progress shopping)
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