import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Numeric,
    ForeignKey,
    CheckConstraint,
    Enum,
    Text,
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


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, nullable=False, index=True)
    order_date = Column(DateTime, server_default=func.current_timestamp())
    total_amount = Column(Numeric(10, 2), nullable=False)
    shipping_address = Column(Text, nullable=False)
    status = Column(Enum(OrderStatus, name="order_status"), nullable=False, default=OrderStatus.pending)

    payment = relationship("Payment", back_populates="order", uselist=False)

    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="check_order_total_non_negative_payment"),
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
        CheckConstraint("amount >= 0", name="check_payment_amount_non_negative"),
        UniqueConstraint("order_id", name="uq_payment_order_id"),
    )