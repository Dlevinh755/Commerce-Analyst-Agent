from datetime import datetime

from pydantic import BaseModel, Field


class UpsertReviewRequest(BaseModel):
    order_id: int = Field(..., ge=1)
    book_id: int = Field(..., ge=1)
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewResponse(BaseModel):
    review_id: str
    order_id: int
    book_id: int
    buyer_id: int
    rating: int
    comment: str | None = None
    created_at: datetime
    updated_at: datetime


class ReviewListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[ReviewResponse]


class ReviewSummaryResponse(BaseModel):
    book_id: int
    rating_count: int
    avg_rating: float


class MessageResponse(BaseModel):
    message: str
