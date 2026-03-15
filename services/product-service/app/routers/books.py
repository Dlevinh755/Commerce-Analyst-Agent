import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, Query, status, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from ..db import get_db
from ..models import Book
from ..schemas import (
    BookCreate,
    BookUpdate,
    AdminBookUpdate,
    BookResponse,
    BookDetailResponse,
    PaginatedBooksResponse,
    MessageResponse,
    ImageUploadResponse,
)
from ..deps import get_book_or_404, resolve_category
from ..common.auth_jwt import require_roles

router = APIRouter(prefix="/books", tags=["Books"])

UPLOADS_DIR = Path("/app/uploads")
PUBLIC_PRODUCTS_BASE_URL = os.getenv("PUBLIC_PRODUCTS_BASE_URL", "http://localhost/api/v1/products")


@router.get("", response_model=PaginatedBooksResponse)
def list_books(
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    author: str | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    seller_id: int | None = Query(default=None),
    in_stock: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    query = db.query(Book).options(joinedload(Book.category))
    query = query.filter(Book.is_active.is_(True), Book.is_hidden.is_(False))

    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                Book.title.ilike(search),
                Book.author.ilike(search),
                Book.description.ilike(search),
            )
        )

    if category_id is not None:
        query = query.filter(Book.category_id == category_id)

    if author:
        query = query.filter(Book.author.ilike(f"%{author}%"))

    if min_price is not None:
        query = query.filter(Book.price >= min_price)

    if max_price is not None:
        query = query.filter(Book.price <= max_price)

    if seller_id is not None:
        query = query.filter(Book.seller_id == seller_id)

    if in_stock is True:
        query = query.filter(Book.stock_quantity > 0)
    elif in_stock is False:
        query = query.filter(Book.stock_quantity == 0)

    total = query.count()
    items = (
        query.order_by(Book.book_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": items,
    }


@router.get("/admin/list", response_model=PaginatedBooksResponse)
def list_books_for_admin(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
    q: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    author: str | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    seller_id: int | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    is_hidden: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    query = db.query(Book).options(joinedload(Book.category))

    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                Book.title.ilike(search),
                Book.author.ilike(search),
                Book.description.ilike(search),
            )
        )

    if category_id is not None:
        query = query.filter(Book.category_id == category_id)

    if author:
        query = query.filter(Book.author.ilike(f"%{author}%"))

    if min_price is not None:
        query = query.filter(Book.price >= min_price)

    if max_price is not None:
        query = query.filter(Book.price <= max_price)

    if seller_id is not None:
        query = query.filter(Book.seller_id == seller_id)

    if is_active is not None:
        query = query.filter(Book.is_active == is_active)

    if is_hidden is not None:
        query = query.filter(Book.is_hidden == is_hidden)

    total = query.count()
    items = (
        query.order_by(Book.book_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": items,
    }


@router.get("/{book_id}", response_model=BookDetailResponse)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = (
        db.query(Book)
        .options(joinedload(Book.category))
        .filter(Book.book_id == book_id)
        .first()
    )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.post("", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
def create_book(
    data: BookCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    category = resolve_category(db, data.category_id, data.category_name)

    seller_id = int(payload["sub"])
    seller_username = payload.get("username")

    book = Book(
        seller_id=seller_id,
        seller_username=seller_username,
        category_id=category.category_id if category else None,
        title=data.title,
        author=data.author,
        description=data.description,
        price=data.price,
        stock_quantity=data.stock_quantity,
        image_url=data.image_url,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@router.patch("/{book_id}", response_model=BookResponse)
def update_book(
    book_id: int,
    data: BookUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    book = get_book_or_404(db, book_id)
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    if requester_role != "admin" and book.seller_id != requester_id:
        raise HTTPException(status_code=403, detail="You can only update your own books")

    if data.category_id is not None or data.category_name is not None:
        category = resolve_category(db, data.category_id, data.category_name)
        book.category_id = category.category_id if category else None

    if data.title is not None:
        book.title = data.title
    if data.author is not None:
        book.author = data.author
    if data.description is not None:
        book.description = data.description
    if data.price is not None:
        book.price = data.price
    if data.stock_quantity is not None:
        book.stock_quantity = data.stock_quantity
    if data.image_url is not None:
        book.image_url = data.image_url

    db.commit()
    db.refresh(book)
    return book


@router.patch("/admin/{book_id}", response_model=BookResponse)
def update_book_as_admin(
    book_id: int,
    data: AdminBookUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
):
    book = get_book_or_404(db, book_id)

    if data.category_id is not None or data.category_name is not None:
        category = resolve_category(db, data.category_id, data.category_name)
        book.category_id = category.category_id if category else None

    if data.title is not None:
        book.title = data.title
    if data.author is not None:
        book.author = data.author
    if data.description is not None:
        book.description = data.description
    if data.price is not None:
        book.price = data.price
    if data.stock_quantity is not None:
        book.stock_quantity = data.stock_quantity
    if data.image_url is not None:
        book.image_url = data.image_url

    if data.seller_id is not None:
        book.seller_id = data.seller_id
    if data.seller_username is not None:
        book.seller_username = data.seller_username

    if data.is_active is not None:
        book.is_active = data.is_active
    if data.is_hidden is not None:
        book.is_hidden = data.is_hidden

    db.commit()
    db.refresh(book)
    return book


@router.delete("/{book_id}", response_model=MessageResponse)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    book = get_book_or_404(db, book_id)
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    if requester_role != "admin" and book.seller_id != requester_id:
        raise HTTPException(status_code=403, detail="You can only delete your own books")

    book.is_hidden = True
    book.is_active = False
    db.commit()
    return {"message": "Book hidden successfully"}


@router.post("/upload-image", response_model=ImageUploadResponse)
async def upload_book_image(
    image: UploadFile = File(...),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    extension = Path(image.filename or "").suffix.lower() or ".jpg"
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    filename = f"{uuid.uuid4().hex}{extension}"
    output_path = UPLOADS_DIR / filename
    content = await image.read()

    max_size_bytes = 5 * 1024 * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

    output_path.write_bytes(content)

    return {"image_url": f"{PUBLIC_PRODUCTS_BASE_URL}/uploads/{filename}"}


@router.get("/me/list", response_model=list[BookResponse])
def list_my_books(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    query = db.query(Book)
    if requester_role != "admin":
        query = query.filter(Book.seller_id == requester_id)

    return query.order_by(Book.book_id.desc()).all()