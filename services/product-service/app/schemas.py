from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None


class CategoryResponse(BaseModel):
    category_id: int
    name: str
    description: str | None = None

    class Config:
        from_attributes = True


class BookCreate(BaseModel):
    category_id: int | None = None
    category_name: str | None = Field(default=None, min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=255)
    author: str = Field(..., min_length=1, max_length=150)
    description: str | None = None
    price: Decimal = Field(..., ge=0)
    stock_quantity: int = Field(..., ge=0)
    image_url: str | None = None


class BookUpdate(BaseModel):
    category_id: int | None = None
    category_name: str | None = Field(default=None, min_length=1, max_length=100)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    author: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    stock_quantity: int | None = Field(default=None, ge=0)
    image_url: str | None = None


class AdminBookUpdate(BaseModel):
    category_id: int | None = None
    category_name: str | None = Field(default=None, min_length=1, max_length=100)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    author: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    stock_quantity: int | None = Field(default=None, ge=0)
    image_url: str | None = None
    seller_id: int | None = Field(default=None, ge=1)
    seller_username: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None
    is_hidden: bool | None = None


class BookResponse(BaseModel):
    book_id: int
    seller_id: int
    seller_username: str | None = None
    category_id: int | None = None
    title: str
    author: str
    description: str | None = None
    price: Decimal
    stock_quantity: int
    image_url: str | None = None
    is_active: bool
    is_hidden: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class BookDetailResponse(BookResponse):
    category: CategoryResponse | None = None


class MessageResponse(BaseModel):
    message: str


class ImageUploadResponse(BaseModel):
    image_url: str


class PaginatedBooksResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[BookDetailResponse]