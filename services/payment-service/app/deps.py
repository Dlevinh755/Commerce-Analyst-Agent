from fastapi import HTTPException
from sqlalchemy.orm import Session
from .models import Order, Payment


def get_order_or_404(db: Session, order_id: int):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def get_payment_or_404(db: Session, payment_id: int):
    payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment