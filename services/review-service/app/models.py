from sqlalchemy import CheckConstraint, Column, DateTime, Integer, Text, UniqueConstraint, func

from .db import Base


class Review(Base):
    __tablename__ = "reviews"

    review_id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, nullable=False, index=True)
    book_id = Column(Integer, nullable=False, index=True)
    buyer_id = Column(Integer, nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("buyer_id", "order_id", "book_id", name="uq_buyer_order_book_review"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="check_review_rating_range"),
    )
