from fastapi import HTTPException
from sqlalchemy.orm import Session
from .models import Book, CartItem


def get_book_or_404(db: Session, book_id: int):
    book = db.query(Book).filter(Book.book_id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


def get_cart_item_or_404(db: Session, cart_id: int, buyer_id: int):
    item = db.query(CartItem).filter(
        CartItem.cart_id == cart_id,
        CartItem.buyer_id == buyer_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return item