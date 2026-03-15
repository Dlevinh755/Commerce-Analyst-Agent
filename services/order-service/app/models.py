import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Numeric,
    Boolean,
    ForeignKey,
    CheckConstraint,
    Enum,
    func,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .db import Base


class OrderStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    refunded = "refunded"


class CancellationStatus(str, enum.Enum):
    none = "none"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


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

    order_items = relationship("OrderItem", back_populates="book")
    cart_items = relationship("CartItem", back_populates="book")

    __table_args__ = (
        CheckConstraint("price >= 0", name="check_book_price_non_negative_order"),
        CheckConstraint("stock_quantity >= 0", name="check_book_stock_non_negative_order"),
    )


class CartItem(Base):
    __tablename__ = "cart"

    cart_id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.book_id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)

    book = relationship("Book", back_populates="cart_items")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_cart_quantity_positive_order"),
    )


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, nullable=False, index=True)
    order_date = Column(DateTime, server_default=func.current_timestamp())
    total_amount = Column(Numeric(10, 2), nullable=False)
    shipping_address = Column(Text, nullable=False)
    status = Column(Enum(OrderStatus, name="order_status"), nullable=False, default=OrderStatus.pending)
    delivered_at = Column(DateTime, nullable=True)
    cancellation_status = Column(String(20), nullable=False, default=CancellationStatus.none.value)
    cancellation_requested_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    cancellation_reviewed_at = Column(DateTime, nullable=True)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="order", uselist=False)

    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="check_order_total_non_negative"),
    )


class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False, index=True)
    payment_method = Column(String(50), nullable=False)
    payment_status = Column(
        Enum(PaymentStatus, name="payment_status"),
        nullable=False,
        default=PaymentStatus.pending,
    )
    amount = Column(Numeric(10, 2), nullable=False)
    transaction_code = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())

    order = relationship("Order", back_populates="payment")

    __table_args__ = (
        CheckConstraint("amount >= 0", name="check_payment_amount_non_negative_order"),
        UniqueConstraint("order_id", name="uq_payment_order_id_order_service"),
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.book_id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    book = relationship("Book", back_populates="order_items")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_order_item_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="check_order_item_unit_price_non_negative"),
    )


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False)
    role = Column(String(20), nullable=False, index=True)
    account_number = Column(String(50), nullable=True, index=True)
    balance = Column(Numeric(14, 2), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    is_hidden = Column(Boolean, nullable=False, default=False)