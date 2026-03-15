from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from .models import OrderStatus


class CheckoutRequest(BaseModel):
    shipping_address: str = Field(..., min_length=5)


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
    total_amount: Decimal
    shipping_address: str
    status: OrderStatus
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