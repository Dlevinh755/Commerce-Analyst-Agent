import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..common.auth_jwt import require_roles
from ..db import get_db
from ..models import Review
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


def _serialize_review(review: Review) -> dict:
    return {
        "review_id": str(review.review_id),
        "order_id": int(review.order_id),
        "book_id": int(review.book_id),
        "buyer_id": int(review.buyer_id),
        "rating": int(review.rating),
        "comment": review.comment,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
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


async def _sync_book_rating_stats(book_id: int, db: Session) -> None:
    rating_count, avg_rating = (
        db.query(func.count(Review.review_id), func.avg(Review.rating))
        .filter(Review.book_id == book_id)
        .one()
    )
    rating_count = int(rating_count or 0)
    avg_rating = float(avg_rating or 0.0)

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
    db: Session = Depends(get_db),
):
    total = db.query(Review).filter(Review.book_id == book_id).count()
    reviews = (
        db.query(Review)
        .filter(Review.book_id == book_id)
        .order_by(desc(Review.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [_serialize_review(item) for item in reviews],
    }


@router.get("/books/{book_id}/summary", response_model=ReviewSummaryResponse)
def get_review_summary(book_id: int, db: Session = Depends(get_db)):
    rating_count, avg_rating = (
        db.query(func.count(Review.review_id), func.avg(Review.rating))
        .filter(Review.book_id == book_id)
        .one()
    )

    if not rating_count:
        return {"book_id": book_id, "rating_count": 0, "avg_rating": 0.0}

    return {
        "book_id": book_id,
        "rating_count": int(rating_count),
        "avg_rating": round(float(avg_rating or 0.0), 2),
    }


@router.get("/orders/{order_id}/my", response_model=list[ReviewResponse])
def list_my_reviews_in_order(
    order_id: int,
    payload: dict = Depends(require_roles("buyer")),
    db: Session = Depends(get_db),
):
    buyer_id = int(payload["sub"])
    reviews = (
        db.query(Review)
        .filter(Review.order_id == order_id, Review.buyer_id == buyer_id)
        .order_by(desc(Review.created_at))
        .all()
    )
    return [_serialize_review(item) for item in reviews]


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def upsert_review(
    data: UpsertReviewRequest,
    authorization: str = Header(default=""),
    payload: dict = Depends(require_roles("buyer")),
    db: Session = Depends(get_db),
):
    buyer_id = int(payload["sub"])
    token = authorization.replace("Bearer", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    order = await _get_order_detail(data.order_id, token)
    _ensure_reviewable(order, buyer_id, data.book_id)

    now = utc_now_naive()
    existing = (
        db.query(Review)
        .filter(
            Review.buyer_id == buyer_id,
            Review.order_id == data.order_id,
            Review.book_id == data.book_id,
        )
        .one_or_none()
    )

    if existing:
        existing.rating = data.rating
        existing.comment = data.comment.strip() if data.comment else None
        existing.updated_at = now
        review = existing
    else:
        review = Review(
            buyer_id=buyer_id,
            order_id=data.order_id,
            book_id=data.book_id,
            rating=data.rating,
            comment=data.comment.strip() if data.comment else None,
            created_at=now,
            updated_at=now,
        )
        db.add(review)

    db.commit()
    db.refresh(review)

    await _sync_book_rating_stats(data.book_id, db)
    return _serialize_review(review)
