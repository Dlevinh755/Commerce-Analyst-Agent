from fastapi import FastAPI
from sqlalchemy import text
from .db import Base, engine, SessionLocal
from .routers import orders
from .models import (
    CancellationStatus,
    Order,
    OrderItem,
    OrderItemStatus,
    OrderStatus,
    SellerOrder,
    SellerOrderStatus,
)
import os
import json
from datetime import datetime, timezone
from decimal import Decimal

app = FastAPI(
    title="Order Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Init Kafka topic (non-blocking — failures are logged and skipped)
try:
    from .kafka_producer import init_kafka_topic
    init_kafka_topic()
except Exception as _kafka_err:
    print(f"[order-service] Kafka init skipped: {_kafka_err}")

Base.metadata.create_all(bind=engine)
with engine.begin() as connection:
    connection.execute(text("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_to_ship'"))
    connection.execute(text("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_shipped'"))
    connection.execute(text("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_delivered'"))
    connection.execute(text("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_cancelled'"))
    connection.execute(text("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returned'"))
    connection.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_order_status') THEN
                    CREATE TYPE seller_order_status AS ENUM (
                        'pending',
                        'processing',
                        'ready_to_ship',
                        'shipped',
                        'delivered',
                        'cancelled',
                        'returned'
                    );
                END IF;
            END
            $$;
            """
        )
    )
    connection.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_item_status') THEN
                    CREATE TYPE order_item_status AS ENUM (
                        'pending',
                        'processing',
                        'ready_to_ship',
                        'shipped',
                        'delivered',
                        'cancelled',
                        'returned'
                    );
                END IF;
            END
            $$;
            """
        )
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(50)")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(14,2) NOT NULL DEFAULT 0")
    )
    connection.execute(
        text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL")
    )
    connection.execute(
        text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_status VARCHAR(20) NOT NULL DEFAULT 'none'"
        )
    )
    connection.execute(
        text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP NULL")
    )
    connection.execute(
        text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL")
    )
    connection.execute(
        text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reviewed_at TIMESTAMP NULL")
    )
    connection.execute(
        text(
            "UPDATE orders SET cancellation_status = :status WHERE cancellation_status IS NULL"
        ),
        {"status": CancellationStatus.none.value},
    )
    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS seller_orders (
                seller_order_id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
                seller_id INTEGER NOT NULL,
                status seller_order_status NOT NULL DEFAULT 'pending',
                cancellation_status VARCHAR(20) NOT NULL DEFAULT 'none',
                cancellation_requested_at TIMESTAMP NULL,
                cancellation_reason TEXT NULL,
                cancellation_reviewed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_seller_order_order_seller UNIQUE (order_id, seller_id)
            )
            """
        )
    )
    connection.execute(
        text("ALTER TABLE seller_orders ADD COLUMN IF NOT EXISTS cancellation_status VARCHAR(20) NOT NULL DEFAULT 'none'")
    )
    connection.execute(
        text("ALTER TABLE seller_orders ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP NULL")
    )
    connection.execute(
        text("ALTER TABLE seller_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL")
    )
    connection.execute(
        text("ALTER TABLE seller_orders ADD COLUMN IF NOT EXISTS cancellation_reviewed_at TIMESTAMP NULL")
    )
    connection.execute(
        text("UPDATE seller_orders SET cancellation_status = :status WHERE cancellation_status IS NULL"),
        {"status": CancellationStatus.none.value},
    )
    connection.execute(
        text(
            """
            UPDATE seller_orders so
            SET
                cancellation_status = :pending,
                cancellation_requested_at = o.cancellation_requested_at,
                cancellation_reason = o.cancellation_reason,
                cancellation_reviewed_at = NULL
            FROM orders o
            WHERE so.order_id = o.order_id
              AND o.cancellation_status = :pending
              AND so.status = 'shipped'
              AND so.cancellation_status = :none
            """
        ),
        {
            "pending": CancellationStatus.pending.value,
            "none": CancellationStatus.none.value,
        },
    )
    connection.execute(
        text("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_order_id INTEGER NULL")
    )
    connection.execute(
        text("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_id INTEGER NULL")
    )
    connection.execute(
        text(
            "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS status order_item_status NOT NULL DEFAULT 'pending'"
        )
    )
    connection.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'fk_order_items_seller_order_id'
                ) THEN
                    ALTER TABLE order_items
                    ADD CONSTRAINT fk_order_items_seller_order_id
                    FOREIGN KEY (seller_order_id)
                    REFERENCES seller_orders(seller_order_id)
                    ON DELETE SET NULL;
                END IF;
            END
            $$;
            """
        )
    )
    connection.execute(
        text(
            """
            INSERT INTO seller_orders (order_id, seller_id, status, cancellation_status)
            SELECT
                oi.order_id,
                COALESCE(oi.seller_id, b.seller_id) AS seller_id,
                CASE
                    WHEN o.status = 'shipped' THEN 'shipped'::seller_order_status
                    WHEN o.status = 'delivered' THEN 'delivered'::seller_order_status
                    WHEN o.status = 'cancelled' THEN 'cancelled'::seller_order_status
                    WHEN o.status = 'processing' THEN 'processing'::seller_order_status
                    ELSE 'pending'::seller_order_status
                END AS status,
                'none' AS cancellation_status
            FROM order_items oi
            JOIN books b ON b.book_id = oi.book_id
            JOIN orders o ON o.order_id = oi.order_id
            WHERE COALESCE(oi.seller_id, b.seller_id) IS NOT NULL
            GROUP BY oi.order_id, COALESCE(oi.seller_id, b.seller_id), o.status
            ON CONFLICT (order_id, seller_id) DO NOTHING
            """
        )
    )
    connection.execute(
        text(
            """
            UPDATE order_items oi
            SET seller_id = b.seller_id
            FROM books b
            WHERE oi.book_id = b.book_id AND oi.seller_id IS NULL
            """
        )
    )
    connection.execute(
        text(
            """
            UPDATE order_items oi
            SET seller_order_id = so.seller_order_id
            FROM seller_orders so
            WHERE so.order_id = oi.order_id
              AND so.seller_id = oi.seller_id
              AND oi.seller_order_id IS NULL
            """
        )
    )

app.include_router(orders.router)
app.include_router(orders.marketplace_router)


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
        print(f"[order-service] Could not load seed file: {exc}")
        return {}


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_seed_datetime(value) -> datetime | None:
    if value in (None, "") or not isinstance(value, str):
        return None
    try:
        normalized = value.strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _apply_seed_orders(seed_data: dict) -> None:
    seed_orders = seed_data.get("orders")
    if not isinstance(seed_orders, list) or not seed_orders:
        print("[order-service] No orders found in seed data.")
        return

    print(f"[order-service] Seeding {len(seed_orders)} orders...")
    db = SessionLocal()
    try:
        for entry in seed_orders:
            if not isinstance(entry, dict):
                continue

            buyer_username = str(entry.get("buyer_username", "")).strip()
            shipping_address = str(entry.get("shipping_address", "")).strip()
            status_str = str(entry.get("status", "pending")).strip()
            order_date = _parse_seed_datetime(entry.get("order_date"))
            delivered_at = _parse_seed_datetime(entry.get("delivered_at"))
            items_data = entry.get("items", [])

            if not buyer_username or not shipping_address or not isinstance(items_data, list):
                continue

            buyer_row = db.execute(
                text("SELECT user_id FROM users WHERE username = :u LIMIT 1"),
                {"u": buyer_username},
            ).mappings().first()
            if not buyer_row:
                print(f"[order-service] Seed skip: buyer '{buyer_username}' not found")
                continue

            buyer_id = buyer_row["user_id"]

            # Resolve books for each item
            resolved_items = []
            for item in items_data:
                if not isinstance(item, dict):
                    continue
                seller_username = str(item.get("seller_username", "")).strip()
                product_title = str(item.get("product_title", "")).strip()
                quantity = int(item.get("quantity", 1))

                book_row = db.execute(
                    text(
                        """
                        SELECT b.book_id, b.price, b.stock_quantity, b.seller_id
                        FROM books b
                        JOIN users u ON b.seller_id = u.user_id
                        WHERE u.username = :seller AND b.title = :title
                        LIMIT 1
                        """
                    ),
                    {"seller": seller_username, "title": product_title},
                ).mappings().first()

                if not book_row:
                    print(f"[order-service] Seed skip item: book '{product_title}' by '{seller_username}' not found")
                    continue

                resolved_items.append({
                    "book_id": book_row["book_id"],
                    "unit_price": Decimal(str(book_row["price"])),
                    "quantity": quantity,
                    "seller_id": book_row["seller_id"],
                })

            if not resolved_items:
                continue

            try:
                status_val = OrderStatus(status_str)
            except ValueError:
                status_val = OrderStatus.pending

            if status_val == OrderStatus.delivered and delivered_at is None:
                delivered_at = _utc_now_naive()

            # Check for duplicate: same buyer + address + same set of book_ids
            book_ids = sorted(str(i["book_id"]) for i in resolved_items)
            existing = db.execute(
                text(
                    """
                    SELECT o.order_id
                    FROM orders o
                    JOIN order_items oi ON o.order_id = oi.order_id
                    WHERE o.buyer_id = :buyer_id AND o.shipping_address = :addr
                    GROUP BY o.order_id
                    HAVING array_agg(oi.book_id::text ORDER BY oi.book_id::text) = :book_ids
                    LIMIT 1
                    """
                ),
                {
                    "buyer_id": buyer_id,
                    "addr": shipping_address,
                    "book_ids": book_ids,
                },
            ).mappings().first()

            if existing:
                existing_order = db.get(Order, existing["order_id"])
                if existing_order is not None:
                    if existing_order.status != status_val:
                        existing_order.status = status_val
                    if order_date is not None and existing_order.order_date != order_date:
                        existing_order.order_date = order_date
                    if (
                        status_val == OrderStatus.delivered
                        and delivered_at is not None
                        and existing_order.delivered_at != delivered_at
                    ):
                        existing_order.delivered_at = delivered_at
                    elif status_val == OrderStatus.delivered and existing_order.delivered_at is None:
                        existing_order.delivered_at = delivered_at or _utc_now_naive()
                continue  # already seeded

            total_amount = sum(i["unit_price"] * i["quantity"] for i in resolved_items)

            order = Order(
                buyer_id=buyer_id,
                shipping_address=shipping_address,
                total_amount=total_amount,
                status=status_val,
                order_date=order_date,
                delivered_at=delivered_at,
            )
            db.add(order)
            db.flush()

            seller_status = {
                OrderStatus.pending: SellerOrderStatus.pending,
                OrderStatus.processing: SellerOrderStatus.processing,
                OrderStatus.ready_to_ship: SellerOrderStatus.ready_to_ship,
                OrderStatus.shipped: SellerOrderStatus.shipped,
                OrderStatus.partially_shipped: SellerOrderStatus.shipped,
                OrderStatus.delivered: SellerOrderStatus.delivered,
                OrderStatus.partially_delivered: SellerOrderStatus.delivered,
                OrderStatus.cancelled: SellerOrderStatus.cancelled,
                OrderStatus.partially_cancelled: SellerOrderStatus.cancelled,
                OrderStatus.returned: SellerOrderStatus.returned,
            }.get(status_val, SellerOrderStatus.pending)

            item_status = OrderItemStatus(seller_status.value)
            seller_order_by_seller: dict[int, SellerOrder] = {}

            for item in resolved_items:
                seller_order = seller_order_by_seller.get(item["seller_id"])
                if seller_order is None:
                    seller_order = SellerOrder(
                        order_id=order.order_id,
                        seller_id=item["seller_id"],
                        status=seller_status,
                    )
                    db.add(seller_order)
                    db.flush()
                    seller_order_by_seller[item["seller_id"]] = seller_order

                db.add(OrderItem(
                    order_id=order.order_id,
                    seller_order_id=seller_order.seller_order_id,
                    seller_id=item["seller_id"],
                    book_id=item["book_id"],
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                    status=item_status,
                ))

        db.commit()
        print("[order-service] Seed orders applied.")
    except Exception as exc:
        db.rollback()
        print(f"[order-service] Seed orders error: {exc}")
    finally:
        db.close()


_apply_seed_orders(_load_dev_seed_data())



@app.get("/health")
def health_check():
    return {"status": "ok", "service": "order"}
