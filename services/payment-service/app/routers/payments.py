import os

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Payment, Order, PaymentStatus, OrderStatus
from ..schemas import (
    CreatePaymentRequest,
    UpdatePaymentStatusRequest,
    RefundPaymentRequest,
    PaymentResponse,
    PaymentListResponse,
    MessageResponse,
)
from ..deps import get_order_or_404, get_payment_or_404
from ..common.auth_jwt import require_roles

router = APIRouter(prefix="/payments", tags=["Payments"])


def _is_simulation_enabled() -> bool:
    return os.getenv("PAYMENT_ALLOW_SIMULATE", "false").strip().lower() == "true"


def serialize_payment(payment: Payment):
    return {
        "payment_id": payment.payment_id,
        "order_id": payment.order_id,
        "payment_method": payment.payment_method,
        "payment_status": payment.payment_status,
        "amount": payment.amount,
        "transaction_code": payment.transaction_code,
        "created_at": payment.created_at,
        "order": payment.order,
    }


def apply_order_status_from_payment(order: Order, payment_status: PaymentStatus):
    if payment_status == PaymentStatus.completed:
        if order.status in [OrderStatus.pending]:
            order.status = OrderStatus.processing
    elif payment_status == PaymentStatus.refunded:
        if order.status in [OrderStatus.pending, OrderStatus.processing]:
            order.status = OrderStatus.cancelled
    elif payment_status == PaymentStatus.failed:
        if order.status not in [OrderStatus.shipped, OrderStatus.delivered]:
            order.status = OrderStatus.pending


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    data: CreatePaymentRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer", "admin")),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    order = (
        db.query(Order)
        .options(joinedload(Order.payment))
        .filter(Order.order_id == data.order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if requester_role != "admin" and order.buyer_id != requester_id:
        raise HTTPException(status_code=403, detail="You can only pay for your own order")

    if order.status == OrderStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cancelled order cannot be paid")

    if order.payment:
        raise HTTPException(status_code=400, detail="Payment already exists for this order")

    payment_method = data.payment_method.strip().upper()
    initial_status = data.payment_status or PaymentStatus.pending

    if requester_role != "admin":
        if payment_method != "COD":
            raise HTTPException(
                status_code=403,
                detail="Only COD payment creation is allowed for buyers",
            )
        if data.payment_status is not None or data.transaction_code is not None:
            raise HTTPException(
                status_code=403,
                detail="Buyers cannot set payment status or transaction code directly",
            )
        initial_status = PaymentStatus.pending

    if payment_method == "VNPAY":
        if initial_status != PaymentStatus.completed:
            raise HTTPException(
                status_code=400,
                detail="VNPay payment can only be created after successful payment confirmation",
            )
        if not (data.transaction_code or "").strip():
            raise HTTPException(status_code=400, detail="VNPay transaction code is required")
    elif initial_status != PaymentStatus.pending:
        raise HTTPException(
            status_code=400,
            detail="Only VNPay can initialize a completed payment",
        )

    payment = Payment(
        order_id=order.order_id,
        payment_method=payment_method,
        payment_status=initial_status,
        amount=order.total_amount,
        transaction_code=(data.transaction_code or None),
    )
    db.add(payment)
    apply_order_status_from_payment(order, initial_status)
    db.commit()
    db.refresh(payment)

    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment.payment_id)
        .first()
    )
    return serialize_payment(payment)


@router.get("/my", response_model=PaymentListResponse)
def list_my_payments(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    buyer_id = int(payload["sub"])

    base_query = db.query(Payment).join(Payment.order).filter(Order.buyer_id == buyer_id)
    total = base_query.count()

    payments = (
        base_query.options(joinedload(Payment.order))
        .order_by(Payment.payment_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [serialize_payment(payment) for payment in payments],
    }


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment_detail(
    payment_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer", "admin")),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment_id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if requester_role != "admin" and payment.order.buyer_id != requester_id:
        raise HTTPException(status_code=403, detail="You can only view your own payments")

    return serialize_payment(payment)


@router.get("", response_model=PaymentListResponse)
def list_all_payments(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    payment_status: PaymentStatus | None = Query(default=None),
):
    query = db.query(Payment)

    if payment_status is not None:
        query = query.filter(Payment.payment_status == payment_status)

    total = query.count()
    payments = (
        query.options(joinedload(Payment.order))
        .order_by(Payment.payment_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [serialize_payment(payment) for payment in payments],
    }


@router.patch("/{payment_id}/status", response_model=PaymentResponse)
def update_payment_status(
    payment_id: int,
    data: UpdatePaymentStatusRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
):
    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment_id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.payment_status == PaymentStatus.refunded:
        raise HTTPException(status_code=400, detail="Refunded payment cannot be updated")

    if payment.payment_status == PaymentStatus.completed and data.payment_status == PaymentStatus.pending:
        raise HTTPException(status_code=400, detail="Completed payment cannot return to pending")

    payment.payment_status = data.payment_status
    if data.transaction_code is not None:
        payment.transaction_code = data.transaction_code

    apply_order_status_from_payment(payment.order, data.payment_status)

    db.commit()
    db.refresh(payment)

    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment.payment_id)
        .first()
    )
    return serialize_payment(payment)


@router.post("/{payment_id}/refund", response_model=PaymentResponse)
def refund_payment(
    payment_id: int,
    data: RefundPaymentRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
):
    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment_id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.payment_status != PaymentStatus.completed:
        raise HTTPException(status_code=400, detail="Only completed payment can be refunded")

    payment.payment_status = PaymentStatus.refunded
    if data.transaction_code is not None:
        payment.transaction_code = data.transaction_code

    apply_order_status_from_payment(payment.order, PaymentStatus.refunded)

    db.commit()
    db.refresh(payment)

    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment.payment_id)
        .first()
    )
    return serialize_payment(payment)


@router.post("/{payment_id}/simulate-success", response_model=PaymentResponse)
def simulate_payment_success(
    payment_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
):
    if not _is_simulation_enabled():
        raise HTTPException(status_code=404, detail="Endpoint not found")

    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment_id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.payment_status != PaymentStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending payment can be simulated")

    payment.payment_status = PaymentStatus.completed
    if not payment.transaction_code:
        payment.transaction_code = f"SIM-SUCCESS-{payment.payment_id}"

    apply_order_status_from_payment(payment.order, PaymentStatus.completed)

    db.commit()
    db.refresh(payment)

    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment.payment_id)
        .first()
    )
    return serialize_payment(payment)


@router.post("/{payment_id}/simulate-failed", response_model=PaymentResponse)
def simulate_payment_failed(
    payment_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
):
    if not _is_simulation_enabled():
        raise HTTPException(status_code=404, detail="Endpoint not found")

    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment_id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.payment_status != PaymentStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending payment can be simulated")

    payment.payment_status = PaymentStatus.failed
    if not payment.transaction_code:
        payment.transaction_code = f"SIM-FAILED-{payment.payment_id}"

    apply_order_status_from_payment(payment.order, PaymentStatus.failed)

    db.commit()
    db.refresh(payment)

    payment = (
        db.query(Payment)
        .options(joinedload(Payment.order))
        .filter(Payment.payment_id == payment.payment_id)
        .first()
    )
    return serialize_payment(payment)