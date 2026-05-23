import enum

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from .db import Base


class PayoutStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False)
    email = Column(String(100), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, index=True)
    account_number = Column(String(50), nullable=True, index=True)
    balance = Column(Numeric(14, 2), nullable=False, default=0)

    payout_requests = relationship(
        "PayoutRequest",
        back_populates="requester",
        foreign_keys="PayoutRequest.requester_id",
    )


class PayoutRequest(Base):
    __tablename__ = "payout_requests"

    payout_id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    requester_role = Column(String(20), nullable=False, index=True)
    account_number = Column(String(50), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    fee_rate = Column(Numeric(7, 4), nullable=False)
    fee_amount = Column(Numeric(14, 2), nullable=False)
    total_debit = Column(Numeric(14, 2), nullable=False)
    status = Column(Enum(PayoutStatus, name="payout_status"), nullable=False, default=PayoutStatus.pending, index=True)
    admin_id = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    admin_note = Column(Text, nullable=True)
    requested_at = Column(DateTime, server_default=func.current_timestamp(), nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    requester = relationship("User", foreign_keys=[requester_id], back_populates="payout_requests")
    admin = relationship("User", foreign_keys=[admin_id])

    __table_args__ = (
        CheckConstraint("amount > 0", name="check_payout_amount_positive"),
        CheckConstraint("fee_rate >= 0", name="check_payout_fee_rate_non_negative"),
        CheckConstraint("fee_amount >= 0", name="check_payout_fee_amount_non_negative"),
        CheckConstraint("total_debit > 0", name="check_payout_total_debit_positive"),
    )
