import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pymongo import DESCENDING

from ..common.auth_jwt import require_roles
from ..db import reviews_collection
from ..schemas import (
    ReviewListResponse,
    ReviewResponse,
    ReviewSummaryResponse,
    UpsertReviewRequest,
)

router = APIRouter(prefix="/reviews", tags=["Reviews"])

ORDER_SERVICE_URL = os.getenv("ORDER_SERVICE_URL", "http://order_service:8003")
PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://product-service:8001")
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "")


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _serialize_review(document: dict) -> dict:
    return {
        "review_id": str(document.get("_id")),
        "order_id": int(document["order_id"]),
        "book_id": int(document["book_id"]),
        "buyer_id": int(document["buyer_id"]),
        "rating": int(document["rating"]),
        "comment": document.get("comment"),
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
    }


async def _get_order_detail(order_id: int, bearer_token: str) -> dict:
    url = f"{ORDER_SERVICE_URL}/orders/{order_id}"
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url, headers={"Authorization": f"Bearer {bearer_token}"})

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Order not found")
    if response.status_code in (401, 403):
        raise HTTPException(status_code=response.status_code, detail="Cannot access this order")
    if response.status_code >= 500:
        raise HTTPException(status_code=502, detail="Order service is unavailable")
    if response.status_code >= 400:
        detail = response.json().get("detail") if response.headers.get("content-type", "").startswith("application/json") else "Invalid order"
        raise HTTPException(status_code=400, detail=detail)

    return response.json()


def _ensure_reviewable(order: dict, buyer_id: int, book_id: int) -> None:
    order_buyer_id = int(order.get("buyer_id") or 0)
    if order_buyer_id != buyer_id:
        raise HTTPException(status_code=403, detail="You can only review your own order")

    order_status = str(order.get("status") or "").lower()
    if order_status not in {"delivered", "partially_delivered"}:
        raise HTTPException(status_code=400, detail="Only delivered orders can be reviewed")

    order_items = order.get("items") or []
    matched = None
    for item in order_items:
        if int(item.get("book_id") or 0) == book_id:
            matched = item
            break

    if matched is None:
        raise HTTPException(status_code=400, detail="Book does not belong to this order")

    item_status = str(matched.get("status") or "").lower()
    if item_status and item_status not in {"delivered", "returned"}:
        raise HTTPException(status_code=400, detail="This item is not eligible for review yet")


async def _sync_book_rating_stats(book_id: int) -> None:
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

    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.patch(
            url,
            headers={"X-Internal-Secret": INTERNAL_SERVICE_SECRET},
            json=payload,
        )
    if response.status_code >= 500:
        raise HTTPException(status_code=502, detail="Product service is unavailable for stats sync")


@router.get("/books/{book_id}", response_model=ReviewListResponse)
def list_reviews_by_book(
    book_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    query = {"book_id": book_id}
    total = reviews_collection.count_documents(query)

    documents = list(
        reviews_collection.find(query)
        .sort("created_at", DESCENDING)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [_serialize_review(item) for item in documents],
    }


@router.get("/books/{book_id}/summary", response_model=ReviewSummaryResponse)
def get_review_summary(book_id: int):
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

    if not result:
        return {"book_id": book_id, "rating_count": 0, "avg_rating": 0.0}

    item = result[0]
    return {
        "book_id": book_id,
        "rating_count": int(item["rating_count"]),
        "avg_rating": round(float(item["avg_rating"]), 2),
    }


@router.get("/orders/{order_id}/my", response_model=list[ReviewResponse])
def list_my_reviews_in_order(
    order_id: int,
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])
    documents = list(
        reviews_collection.find({"order_id": order_id, "buyer_id": buyer_id}).sort("created_at", DESCENDING)
    )
    return [_serialize_review(item) for item in documents]


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def upsert_review(
    data: UpsertReviewRequest,
    authorization: str = Header(default=""),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])
    token = authorization.replace("Bearer", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    order = await _get_order_detail(data.order_id, token)
    _ensure_reviewable(order, buyer_id, data.book_id)

    now = utc_now_naive()
    existing = reviews_collection.find_one(
        {"buyer_id": buyer_id, "order_id": data.order_id, "book_id": data.book_id}
    )

    if existing:
        reviews_collection.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "rating": data.rating,
                    "comment": data.comment.strip() if data.comment else None,
                    "updated_at": now,
                }
            },
        )
        document = reviews_collection.find_one({"_id": existing["_id"]})
    else:
        insert_result = reviews_collection.insert_one(
            {
                "buyer_id": buyer_id,
                "order_id": data.order_id,
                "book_id": data.book_id,
                "rating": data.rating,
                "comment": data.comment.strip() if data.comment else None,
                "created_at": now,
                "updated_at": now,
            }
        )
        document = reviews_collection.find_one({"_id": insert_result.inserted_id})

    await _sync_book_rating_stats(data.book_id)
    return _serialize_review(document)
