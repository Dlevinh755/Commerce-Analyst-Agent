from datetime import datetime, timezone
from decimal import Decimal
from pydantic import BaseModel, Field
from .models import CancellationStatus, OrderStatus, PaymentStatus


class CheckoutRequest(BaseModel):
    shipping_address: str = Field(..., min_length=5)


class CancelOrderRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class UpdateOrderStatusRequest(BaseModel):
    status: OrderStatus


class OrderBookInfo(BaseModel):
    book_id: int
    seller_id: int
    title: str
    author: str
    image_url: str | None = None

    class Config:
        from_attributes = True


class OrderItemResponse(BaseModel):
    order_item_id: int
    book_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    book: OrderBookInfo

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    order_id: int
    buyer_id: int
    order_date: datetime | None = None
    delivered_at: datetime | None = None
    total_amount: Decimal
    shipping_address: str
    status: OrderStatus
    payment_method: str | None = None
    payment_status: PaymentStatus | None = None
    transaction_code: str | None = None
    cancellation_status: CancellationStatus = CancellationStatus.none
    cancellation_requested_at: datetime | None = None
    cancellation_reason: str | None = None
    cancellation_reviewed_at: datetime | None = None
    items: list[OrderItemResponse]

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[OrderResponse]


class MessageResponse(BaseModel):
    message: str