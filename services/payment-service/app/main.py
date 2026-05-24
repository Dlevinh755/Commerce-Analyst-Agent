import logging
import os

from fastapi import FastAPI
from sqlalchemy import text

from .db import Base, SessionLocal, engine
from .routers import payments

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

app = FastAPI(
    title="Payment Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)

app.include_router(payments.router)


def _is_dev_seed_enabled() -> bool:
    return os.getenv("DEV_AUTO_SEED", "false").strip().lower() == "true"


def _apply_seed_payments() -> None:
    if not _is_dev_seed_enabled():
        return
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                INSERT INTO payments (order_id, payment_method, payment_status, amount, transaction_code, created_at)
                SELECT
                    o.order_id,
                    CASE (o.order_id % 3)
                        WHEN 0 THEN 'vnpay'
                        WHEN 1 THEN 'cod'
                        ELSE 'bank_transfer'
                    END AS payment_method,
                    CASE o.status
                        WHEN 'delivered' THEN 'completed'
                        WHEN 'cancelled' THEN 'refunded'
                        ELSE 'pending'
                    END::payment_status AS payment_status,
                    o.total_amount AS amount,
                    NULL AS transaction_code,
                    o.order_date AS created_at
                FROM orders o
                ON CONFLICT (order_id) DO NOTHING
                """
            )
        )
        db.commit()
        result = db.execute(text("SELECT COUNT(*) FROM payments")).scalar()
        print(f"[payment-service] ✓ Payments seeded. Total: {result}")
    except Exception as exc:
        db.rollback()
        print(f"[payment-service] ✗ Error seeding payments: {exc}")
        raise
    finally:
        db.close()


_apply_seed_payments()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "payment"}