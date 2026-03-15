from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import Category, Book


def get_category_or_404(db: Session, category_id: int):
    category = db.query(Category).filter(Category.category_id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def get_book_or_404(db: Session, book_id: int):
    book = db.query(Book).filter(Book.book_id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


def resolve_category(db: Session, category_id: int | None, category_name: str | None):
    if category_id is not None:
        return get_category_or_404(db, category_id)

    cleaned_name = (category_name or "").strip()
    if not cleaned_name:
        return None

    existing = (
        db.query(Category)
        .filter(func.lower(Category.name) == cleaned_name.lower())
        .first()
    )
    if existing:
        return existing

    created = Category(name=cleaned_name)
    db.add(created)
    db.flush()
    return created