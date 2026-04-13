"""Seed reviews into MongoDB from dev-seeds.json.

Resolves username-based references to actual IDs by calling
auth-service, product-service, and order-service HTTP APIs.
"""

import json
import os
import time
from datetime import datetime, timezone

import httpx

from .db import reviews_collection

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://commerce-auth-service:8000")
ORDER_SERVICE_URL = os.getenv("ORDER_SERVICE_URL", "http://order_service:8003")
PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://product-service:8001")
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "")

_HTTP_TIMEOUT = 10.0
_MAX_RETRIES = 15
_RETRY_DELAY = 3


def _is_dev_seed_enabled() -> bool:
    return os.getenv("DEV_AUTO_SEED", "false").strip().lower() == "true"


def _load_dev_seed_data() -> dict:
    if not _is_dev_seed_enabled():
        return {}

    seed_file = os.getenv("DEV_SEED_FILE", "/app/dev-seeds.json").strip() or "/app/dev-seeds.json"
    if not os.path.exists(seed_file):
        print(f"[review-service] Seed file not found: {seed_file}")
        return {}

    try:
        with open(seed_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception as exc:
        print(f"[review-service] Could not load seed file {seed_file}: {exc}")
        return {}


def _login_buyer(username: str, password: str) -> dict | None:
    """Login as a buyer via auth-service and return the token response."""
    url = f"{AUTH_SERVICE_URL}/auth/login"
    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            resp = client.post(url, json={"username": username, "password": password})
            if resp.status_code == 200:
                return resp.json()
    except Exception as exc:
        print(f"[review-service] Login failed for '{username}': {exc}")
    return None


def _resolve_user_by_username(username: str, buyer_tokens: dict) -> int | None:
    """Get user_id from cached login response."""
    token_data = buyer_tokens.get(username)
    if token_data and "user" in token_data:
        user = token_data["user"]
        return int(user.get("user_id") or user.get("id") or 0) or None
    return None


def _resolve_book_by_title(seller_username: str, title: str) -> int | None:
    """Search product-service for a book by seller_username + title."""
    url = f"{PRODUCT_SERVICE_URL}/books"
    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            resp = client.get(url, params={"q": title, "page": 1, "page_size": 50})
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
                for item in items:
                    if (
                        str(item.get("seller_username", "")).strip() == seller_username
                        and str(item.get("title", "")).strip() == title
                    ):
                        return int(item.get("book_id", 0)) or None
    except Exception as exc:
        print(f"[review-service] Book resolve failed for '{title}': {exc}")
    return None


def _get_orders_for_buyer(access_token: str) -> list[dict]:
    """Get all orders for a buyer using their access token."""
    url = f"{ORDER_SERVICE_URL}/orders/my"
    all_orders = []
    page = 1
    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            while True:
                resp = client.get(
                    url,
                    params={"page": page, "page_size": 100},
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if resp.status_code != 200:
                    break
                data = resp.json()
                items = data.get("items", [])
                all_orders.extend(items)
                if len(items) < 100:
                    break
                page += 1
    except Exception as exc:
        print(f"[review-service] Orders fetch failed: {exc}")
    return all_orders


def _wait_for_services() -> bool:
    """Wait for dependent services to be healthy before seeding."""
    services = [
        ("auth-service", f"{AUTH_SERVICE_URL}/health"),
        ("product-service", f"{PRODUCT_SERVICE_URL}/health"),
        ("order-service", f"{ORDER_SERVICE_URL}/health"),
    ]

    for name, url in services:
        for attempt in range(_MAX_RETRIES):
            try:
                with httpx.Client(timeout=5.0) as client:
                    resp = client.get(url)
                    if resp.status_code == 200:
                        print(f"[review-service] ✓ {name} is healthy")
                        break
            except Exception:
                pass

            if attempt < _MAX_RETRIES - 1:
                print(f"[review-service] Waiting for {name}... (attempt {attempt + 1}/{_MAX_RETRIES})")
                time.sleep(_RETRY_DELAY)
        else:
            print(f"[review-service] ✗ {name} is not available after {_MAX_RETRIES} attempts")
            return False

    return True


def _sync_book_rating_stats(book_id: int) -> None:
    """Sync rating stats for a specific book to product-service."""
    pipeline = [
        {"$match": {"book_id": book_id}},
        {
            "$group": {
                "_id": "$book_id",
                "rating_count": {"$sum": 1},
                "avg_rating": {"$avg": "$rating"},
            }
        },
    ]
    result = list(reviews_collection.aggregate(pipeline))

    rating_count = int(result[0]["rating_count"]) if result else 0
    avg_rating = float(result[0]["avg_rating"]) if result else 0.0

    if not INTERNAL_SERVICE_SECRET:
        return

    url = f"{PRODUCT_SERVICE_URL}/books/internal/{book_id}/review-stats"
    payload = {"rating_count": rating_count, "avg_rating": round(avg_rating, 2)}

    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            client.patch(
                url,
                headers={"X-Internal-Secret": INTERNAL_SERVICE_SECRET},
                json=payload,
            )
    except Exception as exc:
        print(f"[review-service] Stats sync failed for book {book_id}: {exc}")


def apply_seed_reviews(seed_data: dict) -> None:
    """Main seed function: resolve references and insert reviews into MongoDB."""
    seed_reviews = seed_data.get("reviews")
    if not isinstance(seed_reviews, list) or not seed_reviews:
        print("[review-service] No reviews found in seed data.")
        return

    # Check if reviews are already seeded
    existing_count = reviews_collection.count_documents({})
    if existing_count > 0:
        print(f"[review-service] Reviews collection already has {existing_count} documents. Skipping seed.")
        return

    print(f"[review-service] Seeding {len(seed_reviews)} reviews...")

    # Wait for upstream services
    if not _wait_for_services():
        print("[review-service] ✗ Cannot seed reviews: upstream services not available.")
        return

    # Step 1: Login all unique buyers to get their tokens and user_ids
    buyers = seed_data.get("buyers", [])
    buyer_password_map = {}
    for b in buyers:
        if isinstance(b, dict):
            buyer_password_map[str(b.get("username", "")).strip()] = str(b.get("password", "")).strip()

    unique_buyer_usernames = sorted({
        str(r.get("buyer_username", "")).strip()
        for r in seed_reviews
        if str(r.get("buyer_username", "")).strip()
    })

    print(f"[review-service] Logging in {len(unique_buyer_usernames)} unique buyers...")
    buyer_tokens: dict[str, dict] = {}
    for username in unique_buyer_usernames:
        password = buyer_password_map.get(username, "Buyer@123")
        token_data = _login_buyer(username, password)
        if token_data:
            buyer_tokens[username] = token_data
        else:
            print(f"[review-service] ⚠ Could not login buyer '{username}'")

    # Step 2: Cache buyer orders
    print("[review-service] Fetching buyer orders...")
    buyer_orders_cache: dict[str, list[dict]] = {}
    for username, token_data in buyer_tokens.items():
        access_token = token_data.get("access_token", "")
        if access_token:
            orders = _get_orders_for_buyer(access_token)
            buyer_orders_cache[username] = orders

    # Step 3: Cache book lookups
    book_id_cache: dict[tuple[str, str], int | None] = {}

    # Step 4: Insert reviews
    inserted = 0
    skipped = 0
    failed = 0

    for review_entry in seed_reviews:
        if not isinstance(review_entry, dict):
            continue

        buyer_username = str(review_entry.get("buyer_username", "")).strip()
        seller_username = str(review_entry.get("seller_username", "")).strip()
        product_title = str(review_entry.get("product_title", "")).strip()
        order_index = review_entry.get("order_index", 0)
        rating = int(review_entry.get("rating", 3))
        comment = review_entry.get("comment")

        if not buyer_username or not seller_username or not product_title:
            skipped += 1
            continue

        # Resolve buyer_id
        buyer_id = _resolve_user_by_username(buyer_username, buyer_tokens)
        if not buyer_id:
            skipped += 1
            continue

        # Resolve book_id (with cache)
        cache_key = (seller_username, product_title)
        if cache_key not in book_id_cache:
            book_id_cache[cache_key] = _resolve_book_by_title(seller_username, product_title)
        book_id = book_id_cache[cache_key]
        if not book_id:
            skipped += 1
            continue

        # Resolve order_id from cached orders
        buyer_orders = buyer_orders_cache.get(buyer_username, [])
        order_id = None
        if 0 <= order_index < len(buyer_orders):
            order_id = buyer_orders[order_index].get("order_id")

        # If can't resolve by index, find a delivered order containing this book
        if order_id is None:
            for order in buyer_orders:
                status = str(order.get("status", "")).lower()
                if status in ("delivered", "partially_delivered"):
                    for item in order.get("items", []):
                        if int(item.get("book_id", 0)) == book_id:
                            order_id = order.get("order_id")
                            break
                    if order_id:
                        break

        if order_id is None:
            skipped += 1
            continue

        # Check for existing review
        existing = reviews_collection.find_one({
            "buyer_id": buyer_id,
            "order_id": order_id,
            "book_id": book_id,
        })

        if existing:
            skipped += 1
            continue

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        try:
            reviews_collection.insert_one({
                "buyer_id": buyer_id,
                "order_id": order_id,
                "book_id": book_id,
                "rating": rating,
                "comment": comment.strip() if comment else None,
                "created_at": now,
                "updated_at": now,
            })
            inserted += 1
        except Exception as exc:
            print(f"[review-service] Insert failed: {exc}")
            failed += 1

    print(f"[review-service] ✓ Reviews seed complete: {inserted} inserted, {skipped} skipped, {failed} failed")

    # Step 5: Sync rating stats for all affected books
    if inserted > 0:
        affected_books = sorted(
            {v for v in book_id_cache.values() if v is not None}
        )
        print(f"[review-service] Syncing rating stats for {len(affected_books)} books...")
        for book_id in affected_books:
            _sync_book_rating_stats(book_id)
        print("[review-service] ✓ Rating stats synced.")


def run_seed() -> None:
    """Entry point: load seed data and apply reviews."""
    seed_data = _load_dev_seed_data()
    if not seed_data:
        return
    apply_seed_reviews(seed_data)
