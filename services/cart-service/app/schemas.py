from decimal import Decimal
from pydantic import BaseModel, Field


class AddToCartRequest(BaseModel):
    book_id: int
    quantity: int = Field(..., gt=0)


class UpdateCartItemRequest(BaseModel):
    quantity: int = Field(..., gt=0)


class CartBookInfo(BaseModel):
    book_id: int
    title: str
    author: str
    price: Decimal
    stock_quantity: int
    image_url: str | None = None

    class Config:
        from_attributes = True


class CartItemResponse(BaseModel):
    cart_id: int
    buyer_id: int
    book_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    book: CartBookInfo

    class Config:
        from_attributes = True


class CartSummaryResponse(BaseModel):
    total_items: int
    total_quantity: int
    total_amount: Decimal
    items: list[CartItemResponse]


class MessageResponse(BaseModel):
    message: str