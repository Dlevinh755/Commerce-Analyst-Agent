import logging
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import (
    Book,
    CancellationStatus,
    CartItem,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentStatus,
    User,
)
from ..kafka_producer import publish_order_created, publish_order_shipped, publish_order_delivered
from ..schemas import (
    CancelOrderRequest,
    CheckoutRequest,
    UpdateOrderStatusRequest,
    OrderResponse,
    OrderListResponse,
    MessageResponse,
)
from ..deps import get_order_or_404
from ..common.auth_jwt import require_roles

router = APIRouter(prefix="/orders", tags=["Orders"])
logger = logging.getLogger("order-service.checkout")


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_cancellation_status(value: str | None) -> CancellationStatus:
    try:
        return CancellationStatus(str(value or CancellationStatus.none.value))
    except ValueError:
        return CancellationStatus.none


def get_payment_for_order(db: Session, order_id: int, lock: bool = False) -> Payment | None:
    query = db.query(Payment).filter(Payment.order_id == order_id)
    if lock:
        query = query.with_for_update()
    return query.first()


def restore_order_stock(db: Session, order: Order) -> None:
    for item in order.items:
        book = (
            db.query(Book)
            .filter(Book.book_id == item.book_id)
            .with_for_update()
            .first()
        )
        if book:
            book.stock_quantity += item.quantity


def mark_payment_completed_on_delivery(order: Order, payment: Payment | None) -> None:
    if not payment:
        return

    payment_method = str(payment.payment_method or "").strip().upper()
    if payment.payment_status == PaymentStatus.refunded:
        raise HTTPException(status_code=400, detail="Refunded payment cannot complete this order")

    if payment_method != "VNPAY" and payment.payment_status == PaymentStatus.pending:
        payment.payment_status = PaymentStatus.completed
        if not payment.transaction_code:
            payment.transaction_code = f"COD-DELIVERED-{order.order_id}"


def refund_payment_to_buyer(db: Session, order: Order, payment: Payment | None) -> bool:
    if not payment or payment.payment_status != PaymentStatus.completed:
        return False

    buyer = (
        db.query(User)
        .filter(User.user_id == order.buyer_id)
        .with_for_update()
        .first()
    )
    if not buyer:
        raise HTTPException(status_code=400, detail="Buyer account not found for refund")

    buyer.balance = Decimal(buyer.balance) + Decimal(payment.amount)
    payment.payment_status = PaymentStatus.refunded
    return True


def finalize_order_cancellation(
    db: Session,
    order: Order,
    payment: Payment | None,
    cancellation_status: CancellationStatus,
) -> bool:
    restore_order_stock(db, order)
    refunded = refund_payment_to_buyer(db, order, payment)
    order.status = OrderStatus.cancelled
    order.cancellation_status = cancellation_status.value
    order.cancellation_reviewed_at = utc_now_naive()
    return refunded


def finalize_order_delivery(db: Session, order: Order) -> None:
    seller_amounts: dict[int, Decimal] = {}
    for item in order.items:
        seller_id = item.book.seller_id
        line_amount = Decimal(item.unit_price) * item.quantity
        seller_amounts[seller_id] = seller_amounts.get(seller_id, Decimal("0")) + line_amount

    if not seller_amounts:
        raise HTTPException(status_code=400, detail="Order has no payable items")

    sellers = (
        db.query(User)
        .filter(User.user_id.in_(list(seller_amounts.keys())))
        .with_for_update()
        .all()
    )
    seller_by_id = {seller.user_id: seller for seller in sellers}

    missing_sellers = sorted(set(seller_amounts.keys()) - set(seller_by_id.keys()))
    if missing_sellers:
        raise HTTPException(
            status_code=400,
            detail=f"Seller accounts not found for seller_id(s): {missing_sellers}",
        )

    sellers_without_account = [
        seller_id
        for seller_id, seller in seller_by_id.items()
        if not seller.account_number
    ]
    if sellers_without_account:
        raise HTTPException(
            status_code=400,
            detail=f"Seller bank account missing for seller_id(s): {sorted(sellers_without_account)}",
        )

    for seller_id, amount in seller_amounts.items():
        seller = seller_by_id[seller_id]
        seller.balance = Decimal(seller.balance) + amount

    order.status = OrderStatus.delivered
    order.delivered_at = utc_now_naive()
    # Kafka event published after DB commit by caller
    _order_ref_for_kafka = order


def serialize_order(order: Order):
    items = []
    for item in order.items:
        unit_price = Decimal(item.unit_price)
        subtotal = unit_price * item.quantity
        items.append(
            {
                "order_item_id": item.order_item_id,
                "book_id": item.book_id,
                "quantity": item.quantity,
                "unit_price": unit_price,
                "subtotal": subtotal,
                "book": item.book,
            }
        )

    return {
        "order_id": order.order_id,
        "buyer_id": order.buyer_id,
        "order_date": order.order_date,
        "delivered_at": order.delivered_at,
        "total_amount": Decimal(order.total_amount),
        "shipping_address": order.shipping_address,
        "status": order.status,
        "payment_method": order.payment.payment_method if getattr(order, "payment", None) else None,
        "payment_status": order.payment.payment_status if getattr(order, "payment", None) else None,
        "transaction_code": order.payment.transaction_code if getattr(order, "payment", None) else None,
        "cancellation_status": normalize_cancellation_status(getattr(order, "cancellation_status", None)),
        "cancellation_requested_at": order.cancellation_requested_at,
        "cancellation_reason": order.cancellation_reason,
        "cancellation_reviewed_at": order.cancellation_reviewed_at,
        "items": items,
    }


@router.post("/checkout", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def checkout(
    data: CheckoutRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])
    logger.info("checkout:start buyer_id=%s", buyer_id)

    cart_items = (
        db.query(CartItem)
        .options(joinedload(CartItem.book))
        .filter(CartItem.buyer_id == buyer_id)
        .all()
    )
    logger.info("checkout:cart-loaded buyer_id=%s items=%s", buyer_id, len(cart_items))

    if not cart_items:
        logger.warning("checkout:empty-cart buyer_id=%s", buyer_id)
        raise HTTPException(status_code=400, detail="Cart is empty")

    locked_books = {}
    total_amount = Decimal("0")

    try:
        for cart_item in cart_items:
            book = (
                db.query(Book)
                .filter(Book.book_id == cart_item.book_id)
                .with_for_update()
                .first()
            )

            if not book:
                logger.warning(
                    "checkout:book-not-found buyer_id=%s book_id=%s",
                    buyer_id,
                    cart_item.book_id,
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Book with id {cart_item.book_id} not found",
                )

            if book.stock_quantity < cart_item.quantity:
                logger.warning(
                    "checkout:insufficient-stock buyer_id=%s book_id=%s need=%s stock=%s",
                    buyer_id,
                    book.book_id,
                    cart_item.quantity,
                    book.stock_quantity,
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Book '{book.title}' does not have enough stock. Available: {book.stock_quantity}",
                )

            locked_books[book.book_id] = book
            total_amount += Decimal(book.price) * cart_item.quantity

        order = Order(
            buyer_id=buyer_id,
            shipping_address=data.shipping_address,
            total_amount=total_amount,
            status=OrderStatus.pending,
        )
        db.add(order)
        db.flush()

        for cart_item in cart_items:
            book = locked_books[cart_item.book_id]
            order_item = OrderItem(
                order_id=order.order_id,
                book_id=book.book_id,
                quantity=cart_item.quantity,
                unit_price=book.price,
            )
            db.add(order_item)
            book.stock_quantity -= cart_item.quantity

        db.query(CartItem).filter(CartItem.buyer_id == buyer_id).delete()
        db.commit()
        logger.info("checkout:success buyer_id=%s order_id=%s total=%s", buyer_id, order.order_id, total_amount)

    except HTTPException:
        db.rollback()
        logger.exception("checkout:http-exception buyer_id=%s", buyer_id)
        raise
    except Exception:
        db.rollback()
        logger.exception("checkout:unexpected-error buyer_id=%s", buyer_id)
        raise HTTPException(status_code=500, detail="Checkout failed")

    created_order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order.order_id)
        .first()
    )
    publish_order_created(created_order)
    return serialize_order(created_order)


@router.get("/my", response_model=OrderListResponse)
def list_my_orders(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    buyer_id = int(payload["sub"])

    base_query = db.query(Order).filter(Order.buyer_id == buyer_id)
    total = base_query.count()

    orders = (
        base_query.options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .order_by(Order.order_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [serialize_order(order) for order in orders],
    }


@router.get("/seller/my", response_model=OrderListResponse)
def list_orders_for_my_books(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    query = db.query(Order)

    if requester_role != "admin":
        query = (
            query.join(Order.items)
            .join(OrderItem.book)
            .filter(Book.seller_id == requester_id)
            .distinct()
        )

    total = query.with_entities(Order.order_id).distinct().count()

    orders = (
        query.options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .order_by(Order.order_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [serialize_order(order) for order in orders],
    }


@router.get("/{order_id}", response_model=OrderResponse)
def get_order_detail(
    order_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer", "seller", "admin")),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if requester_role == "admin":
        return serialize_order(order)

    if requester_role == "buyer":
        if order.buyer_id != requester_id:
            raise HTTPException(status_code=403, detail="You can only view your own orders")
        return serialize_order(order)

    seller_book_ids = [item.book.seller_id for item in order.items]
    if requester_id not in seller_book_ids:
        raise HTTPException(status_code=403, detail="You can only view orders containing your books")

    return serialize_order(order)


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    data: UpdateOrderStatusRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == OrderStatus.cancelled and data.status != OrderStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cancelled order cannot be reactivated")

    try:
        if data.status == OrderStatus.delivered and order.status != OrderStatus.delivered:
            payment = get_payment_for_order(db, order.order_id, lock=True)
            mark_payment_completed_on_delivery(order, payment)
            finalize_order_delivery(db, order)
        else:
            order.status = data.status
        db.commit()
        db.refresh(order)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update order status")

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    return serialize_order(order)


@router.post("/{order_id}/cancel", response_model=MessageResponse)
def cancel_my_order(
    order_id: int,
    data: CancelOrderRequest | None = None,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.buyer_id != buyer_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own orders")

    cancellation_status = normalize_cancellation_status(order.cancellation_status)

    if order.status == OrderStatus.cancelled:
        raise HTTPException(status_code=400, detail="Order has already been cancelled")

    if order.status == OrderStatus.delivered:
        raise HTTPException(status_code=400, detail="Delivered order cannot be cancelled")

    if order.status == OrderStatus.shipped:
        if cancellation_status == CancellationStatus.pending:
            raise HTTPException(status_code=400, detail="Cancellation request is already pending seller approval")

        try:
            order.cancellation_status = CancellationStatus.pending.value
            order.cancellation_requested_at = utc_now_naive()
            order.cancellation_reason = data.reason.strip() if data and data.reason else None
            order.cancellation_reviewed_at = None
            db.commit()
        except Exception:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to submit cancellation request")

        return {"message": "Cancellation request sent to seller"}

    if order.status not in [OrderStatus.pending, OrderStatus.processing]:
        raise HTTPException(
            status_code=400,
            detail="Only pending or processing orders can be cancelled",
        )

    try:
        payment = get_payment_for_order(db, order.order_id, lock=True)
        refunded = finalize_order_cancellation(db, order, payment, CancellationStatus.approved)
        order.cancellation_requested_at = order.cancellation_requested_at or utc_now_naive()
        order.cancellation_reason = data.reason.strip() if data and data.reason else order.cancellation_reason
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to cancel order")

    return {"message": "Order cancelled and refunded successfully" if refunded else "Order cancelled successfully"}


@router.post("/{order_id}/cancel/approve", response_model=OrderResponse)
def approve_cancellation_request(
    order_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != OrderStatus.shipped:
        raise HTTPException(status_code=400, detail="Only shipped orders can be approved for cancellation")

    if normalize_cancellation_status(order.cancellation_status) != CancellationStatus.pending:
        raise HTTPException(status_code=400, detail="Order does not have a pending cancellation request")

    if requester_role != "admin":
        seller_ids = {item.book.seller_id for item in order.items}
        if requester_id not in seller_ids:
            raise HTTPException(status_code=403, detail="You can only review cancellation requests for your own orders")
        if len(seller_ids) > 1:
            raise HTTPException(
                status_code=400,
                detail="This order contains books from multiple sellers and requires admin approval",
            )

    try:
        payment = get_payment_for_order(db, order.order_id, lock=True)
        finalize_order_cancellation(db, order, payment, CancellationStatus.approved)
        db.commit()
        db.refresh(order)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to approve cancellation request")

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    return serialize_order(order)


@router.post("/{order_id}/cancel/reject", response_model=OrderResponse)
def reject_cancellation_request(
    order_id: int,
    data: CancelOrderRequest | None = None,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != OrderStatus.shipped:
        raise HTTPException(status_code=400, detail="Only shipped orders can reject a cancellation request")

    if normalize_cancellation_status(order.cancellation_status) != CancellationStatus.pending:
        raise HTTPException(status_code=400, detail="Order does not have a pending cancellation request")

    if requester_role != "admin":
        seller_ids = {item.book.seller_id for item in order.items}
        if requester_id not in seller_ids:
            raise HTTPException(status_code=403, detail="You can only review cancellation requests for your own orders")
        if len(seller_ids) > 1:
            raise HTTPException(
                status_code=400,
                detail="This order contains books from multiple sellers and requires admin approval",
            )

    try:
        order.cancellation_status = CancellationStatus.rejected.value
        order.cancellation_reviewed_at = utc_now_naive()
        if data and data.reason:
            order.cancellation_reason = data.reason.strip()
        db.commit()
        db.refresh(order)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to reject cancellation request")

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    return serialize_order(order)


@router.post("/{order_id}/confirm-received", response_model=OrderResponse)
def confirm_received_by_buyer(
    order_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.buyer_id != buyer_id:
        raise HTTPException(status_code=403, detail="You can only confirm your own orders")

    if order.status == OrderStatus.delivered:
        raise HTTPException(status_code=400, detail="Order has already been confirmed as delivered")

    if order.status != OrderStatus.shipped:
        raise HTTPException(status_code=400, detail="Only shipped orders can be confirmed as received")

    if normalize_cancellation_status(order.cancellation_status) == CancellationStatus.pending:
        raise HTTPException(status_code=400, detail="Order has a pending cancellation request")

    try:
        payment = get_payment_for_order(db, order.order_id, lock=True)
        mark_payment_completed_on_delivery(order, payment)
        finalize_order_delivery(db, order)
        db.commit()
        db.refresh(order)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to confirm order received")

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    publish_order_delivered(order)
    return serialize_order(order)


@router.post("/{order_id}/mark-shipped", response_model=OrderResponse)
def mark_order_as_shipped_by_seller(
    order_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .filter(Order.order_id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == OrderStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cancelled order cannot be shipped")

    if order.status == OrderStatus.delivered:
        raise HTTPException(status_code=400, detail="Delivered order cannot be shipped")

    if order.status == OrderStatus.shipped:
        raise HTTPException(status_code=400, detail="Order has already been marked as shipped")

    if requester_role != "admin":
        seller_ids = {item.book.seller_id for item in order.items}
        if requester_id not in seller_ids:
            raise HTTPException(
                status_code=403,
                detail="You can only update orders containing your books",
            )

        if len(seller_ids) > 1:
            raise HTTPException(
                status_code=400,
                detail="This order contains books from multiple sellers and cannot be marked shipped by one seller",
            )

    try:
        order.status = OrderStatus.shipped
        db.commit()
        db.refresh(order)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update order status")

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book))
        .filter(Order.order_id == order_id)
        .first()
    )
    publish_order_shipped(order)
    return serialize_order(order)


@router.get("", response_model=OrderListResponse)
def list_all_orders(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    status_filter: OrderStatus | None = Query(default=None),
):
    query = db.query(Order)

    if status_filter is not None:
        query = query.filter(Order.status == status_filter)

    total = query.count()
    orders = (
        query.options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.payment))
        .order_by(Order.order_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [serialize_order(order) for order in orders],
    }