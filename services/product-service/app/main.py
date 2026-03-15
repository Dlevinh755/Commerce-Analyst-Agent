from pathlib import Path
import json
import os
import time
from fastapi import FastAPI
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
from .db import Base, engine
from .routers import categories, books

app = FastAPI(
    title="Books Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)

with engine.begin() as connection:
    connection.execute(
        text("ALTER TABLE books ADD COLUMN IF NOT EXISTS seller_username VARCHAR(100)")
    )
    connection.execute(
        text("ALTER TABLE books ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE")
    )
    connection.execute(
        text("ALTER TABLE books ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE")
    )


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
        print(f"[product-service] Could not load seed file {seed_file}: {exc}")
        return {}


def _apply_seed_products(seed_data: dict) -> None:
    products = seed_data.get("products") if isinstance(seed_data.get("products"), list) else []
    if not products:
        return

    pending_products = [entry for entry in products if isinstance(entry, dict)]

    for _ in range(10):
        if not pending_products:
            return

        next_pending: list[dict] = []
        with engine.begin() as connection:
            for entry in pending_products:
                seller_username = str(entry.get("seller_username", "")).strip()
                title = str(entry.get("title", "")).strip()
                author = str(entry.get("author", "")).strip()

                if not seller_username or not title or not author:
                    continue

                seller_row = connection.execute(
                    text("SELECT user_id, username FROM users WHERE username = :username AND role = 'seller' LIMIT 1"),
                    {"username": seller_username},
                ).mappings().first()

                if not seller_row:
                    next_pending.append(entry)
                    continue

                category_name = str(entry.get("category_name", "General")).strip() or "General"
                category_row = connection.execute(
                    text("SELECT category_id FROM categories WHERE name = :name LIMIT 1"),
                    {"name": category_name},
                ).mappings().first()

                if category_row:
                    category_id = category_row["category_id"]
                else:
                    inserted_category = connection.execute(
                        text("INSERT INTO categories (name, description) VALUES (:name, :description) RETURNING category_id"),
                        {
                            "name": category_name,
                            "description": str(entry.get("category_description", "")).strip() or None,
                        },
                    ).mappings().first()
                    category_id = inserted_category["category_id"] if inserted_category else None

                description_raw = entry.get("description")
                description = str(description_raw).strip() if description_raw is not None else None
                image_url_raw = entry.get("image_url")
                image_url = str(image_url_raw).strip() if image_url_raw is not None else None
                try:
                    price = float(entry.get("price", 0))
                except Exception:
                    price = 0
                try:
                    stock_quantity = int(entry.get("stock_quantity", 0))
                except Exception:
                    stock_quantity = 0

                is_active = bool(entry.get("is_active", True))
                is_hidden = bool(entry.get("is_hidden", False))

                existing_book = connection.execute(
                    text(
                        """
                        SELECT book_id
                        FROM books
                        WHERE seller_id = :seller_id AND title = :title AND author = :author
                        LIMIT 1
                        """
                    ),
                    {
                        "seller_id": seller_row["user_id"],
                        "title": title,
                        "author": author,
                    },
                ).mappings().first()

                if existing_book:
                    connection.execute(
                        text(
                            """
                            UPDATE books
                            SET
                                seller_username = :seller_username,
                                category_id = :category_id,
                                description = :description,
                                price = :price,
                                stock_quantity = :stock_quantity,
                                image_url = :image_url,
                                is_active = :is_active,
                                is_hidden = :is_hidden
                            WHERE book_id = :book_id
                            """
                        ),
                        {
                            "book_id": existing_book["book_id"],
                            "seller_username": seller_row["username"],
                            "category_id": category_id,
                            "description": description,
                            "price": price,
                            "stock_quantity": stock_quantity,
                            "image_url": image_url,
                            "is_active": is_active,
                            "is_hidden": is_hidden,
                        },
                    )
                else:
                    connection.execute(
                        text(
                            """
                            INSERT INTO books (
                                seller_id,
                                seller_username,
                                category_id,
                                title,
                                author,
                                description,
                                price,
                                stock_quantity,
                                image_url,
                                is_active,
                                is_hidden
                            ) VALUES (
                                :seller_id,
                                :seller_username,
                                :category_id,
                                :title,
                                :author,
                                :description,
                                :price,
                                :stock_quantity,
                                :image_url,
                                :is_active,
                                :is_hidden
                            )
                            """
                        ),
                        {
                            "seller_id": seller_row["user_id"],
                            "seller_username": seller_row["username"],
                            "category_id": category_id,
                            "title": title,
                            "author": author,
                            "description": description,
                            "price": price,
                            "stock_quantity": stock_quantity,
                            "image_url": image_url,
                            "is_active": is_active,
                            "is_hidden": is_hidden,
                        },
                    )

        pending_products = next_pending
        if pending_products:
            time.sleep(1)

    if pending_products:
        missing_sellers = sorted(
            {
                str(item.get("seller_username", "")).strip()
                for item in pending_products
                if str(item.get("seller_username", "")).strip()
            }
        )
        print(f"[product-service] Could not seed some products because sellers were not found: {missing_sellers}")


_apply_seed_products(_load_dev_seed_data())

uploads_dir = Path("/app/uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(categories.router)
app.include_router(books.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "books"}