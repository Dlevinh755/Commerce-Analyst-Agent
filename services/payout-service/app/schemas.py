from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from .models import PayoutStatus


class CreatePayoutRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)


class ReviewPayoutRequest(BaseModel):
    admin_note: str | None = Field(default=None, max_length=500)


class PayoutUserResponse(BaseModel):
    user_id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    role: str
    balance: Decimal | None = None

    class Config:
        from_attributes = True


class PayoutResponse(BaseModel):
    payout_id: int
    requester_id: int
    requester_role: str
    account_number: str
    amount: Decimal
    fee_rate: Decimal
    fee_amount: Decimal
    total_debit: Decimal
    status: PayoutStatus
    admin_id: int | None = None
    admin_note: str | None = None
    requested_at: datetime | None = None
    reviewed_at: datetime | None = None
    requester: PayoutUserResponse | None = None
    admin: PayoutUserResponse | None = None

    class Config:
        from_attributes = True


class PayoutListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[PayoutResponse]


class MessageResponse(BaseModel):
    message: str
