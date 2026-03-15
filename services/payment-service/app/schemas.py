from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from .models import OrderStatus, PaymentStatus


class CreatePaymentRequest(BaseModel):
    order_id: int
    payment_method: str = Field(..., min_length=2, max_length=50)


class UpdatePaymentStatusRequest(BaseModel):
    payment_status: PaymentStatus
    transaction_code: str | None = Field(default=None, max_length=100)


class RefundPaymentRequest(BaseModel):
    transaction_code: str | None = Field(default=None, max_length=100)


class OrderBriefResponse(BaseModel):
    order_id: int
    buyer_id: int
    order_date: datetime | None = None
    total_amount: Decimal
    shipping_address: str
    status: OrderStatus

    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    payment_id: int
    order_id: int
    payment_method: str
    payment_status: PaymentStatus
    amount: Decimal
    transaction_code: str | None = None
    created_at: datetime | None = None
    order: OrderBriefResponse | None = None

    class Config:
        from_attributes = True


class PaymentListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[PaymentResponse]


class MessageResponse(BaseModel):
    message: str