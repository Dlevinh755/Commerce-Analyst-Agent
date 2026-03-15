from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Numeric,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship
from .db import Base


class Book(Base):
    __tablename__ = "books"

    book_id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, nullable=False, index=True)
    category_id = Column(Integer, nullable=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    author = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=0)
    image_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())

    cart_items = relationship("CartItem", back_populates="book")

    __table_args__ = (
        CheckConstraint("price >= 0", name="check_book_price_non_negative_cart"),
        CheckConstraint("stock_quantity >= 0", name="check_book_stock_non_negative_cart"),
    )


class CartItem(Base):
    __tablename__ = "cart"

    cart_id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.book_id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)

    book = relationship("Book", back_populates="cart_items")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_cart_quantity_positive"),
        UniqueConstraint("buyer_id", "book_id", name="uq_cart_buyer_book"),
    )