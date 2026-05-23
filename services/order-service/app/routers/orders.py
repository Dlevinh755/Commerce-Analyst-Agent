import logging
import os
from datetime import datetime, timezone
from decimal import Decimal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import (
    Book,
    CancellationStatus,
    CartItem,
    Order,
    OrderItem,
    OrderItemStatus,
    OrderStatus,
    Payment,
    PaymentStatus,
    SellerOrder,
    SellerOrderStatus,
    User,
)
from ..kafka_producer import publish_order_created, publish_order_shipped, publish_order_delivered
from ..order_status_service import recalculate_order_status
from ..schemas import (
    CancelOrderRequest,
    CheckoutRequest,
    UpdateOrderStatusRequest,
    UpdateOrderItemStatusRequest,
    UpdateSellerOrderStatusRequest,
    OrderResponse,
    OrderListResponse,
    MessageResponse,
    SellerOrderResponse,
)
from ..deps import get_order_or_404
from ..common.auth_jwt import require_roles

router = APIRouter(prefix="/orders", tags=["Orders"])
marketplace_router = APIRouter(tags=["Marketplace Orders"])
logger = logging.getLogger("order-service.checkout")

PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://product-service:8001")
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "")


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
        raise HTTPException(status_code=400, detail="Order payment is required before delivery confirmation")

    payment_method = str(payment.payment_method or "").strip().upper()
    if payment.payment_status == PaymentStatus.refunded:
        raise HTTPException(status_code=400, detail="Refunded payment cannot complete this order")
    if payment.payment_status == PaymentStatus.failed:
        raise HTTPException(status_code=400, detail="Failed payment cannot complete this order")

    if payment_method == "VNPAY" and payment.payment_status != PaymentStatus.completed:
        raise HTTPException(status_code=400, detail="VNPay payment must be completed before delivery confirmation")

    if payment_method != "VNPAY" and payment.payment_status == PaymentStatus.pending:
        payment.payment_status = PaymentStatus.completed
        if not payment.transaction_code:
            payment.transaction_code = f"COD-DELIVERED-{order.order_id}"


def ensure_order_can_be_shipped(order: Order, payment: Payment | None) -> None:
    if not payment:
        raise HTTPException(status_code=400, detail="Order payment is required before shipping")

    payment_method = str(payment.payment_method or "").strip().upper()
    if payment.payment_status in {PaymentStatus.failed, PaymentStatus.refunded}:
        raise HTTPException(status_code=400, detail="Failed or refunded payment cannot be shipped")

    if payment_method == "VNPAY" and payment.payment_status != PaymentStatus.completed:
        raise HTTPException(status_code=400, detail="VNPay order must be paid before shipping")


def refund_payment_to_buyer(db: Session, order: Order, payment: Payment | None) -> bool:
    if not payment or payment.payment_status != PaymentStatus.completed:
        return False

    payment_method = str(payment.payment_method or "").strip().upper()
    if payment_method != "VNPAY":
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
    for item in order.items:
        item.status = OrderItemStatus.cancelled
    for seller_order in order.seller_orders:
        seller_order.status = SellerOrderStatus.cancelled
    return refunded


def finalize_order_delivery(db: Session, order: Order) -> None:
    seller_amounts: dict[int, Decimal] = {}
    for item in order.items:
        seller_id = item.seller_id or (item.book.seller_id if item.book else None)
        if seller_id is None:
            raise HTTPException(status_code=400, detail="Order item seller is missing")
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

    for seller_id, amount in seller_amounts.items():
        seller = seller_by_id[seller_id]
        seller.balance = Decimal(seller.balance) + amount

    order.status = OrderStatus.delivered
    order.delivered_at = utc_now_naive()

    for item in order.items:
        if item.status != OrderItemStatus.delivered:
            item.status = OrderItemStatus.delivered

    for seller_order in order.seller_orders:
        if seller_order.status != SellerOrderStatus.delivered:
            seller_order.status = SellerOrderStatus.delivered


def sync_book_purchase_counts(order: Order) -> None:
    if not INTERNAL_SERVICE_SECRET:
        return

    try:
        with httpx.Client(timeout=5.0) as client:
            for item in order.items:
                response = client.patch(
                    f"{PRODUCT_SERVICE_URL}/books/internal/{item.book_id}/purchase-count/increment",
                    headers={"X-Internal-Secret": INTERNAL_SERVICE_SECRET},
                    json={"quantity": int(item.quantity)},
                )
                if response.status_code >= 400:
                    logger.warning(
                        "purchase_count_sync.failed order_id=%s book_id=%s status=%s detail=%s",
                        order.order_id,
                        item.book_id,
                        response.status_code,
                        response.text,
                    )
    except Exception as exc:
        logger.warning(
            "purchase_count_sync.exception order_id=%s error=%s",
            order.order_id,
            exc,
        )


def serialize_order(order: Order):
    order_status = OrderStatus(order.status.value if hasattr(order.status, "value") else order.status)
    override_child_status = None
    if order_status == OrderStatus.cancelled:
        override_child_status = OrderItemStatus.cancelled
    elif order_status == OrderStatus.delivered:
        override_child_status = OrderItemStatus.delivered
    elif order_status == OrderStatus.returned:
        override_child_status = OrderItemStatus.returned

    items = []
    for item in order.items:
        unit_price = Decimal(item.unit_price)
        subtotal = unit_price * item.quantity
        item_status = override_child_status or item.status
        items.append(
            {
                "order_item_id": item.order_item_id,
                "seller_order_id": item.seller_order_id,
                "seller_id": item.seller_id,
                "book_id": item.book_id,
                "quantity": item.quantity,
                "unit_price": unit_price,
                "status": item_status,
                "subtotal": subtotal,
                "book": item.book,
            }
        )

    seller_override_status = None
    if override_child_status is not None:
        seller_override_status = SellerOrderStatus(override_child_status.value)

    seller_orders = [
        {
            "seller_order_id": so.seller_order_id,
            "order_id": so.order_id,
            "seller_id": so.seller_id,
            "status": seller_override_status or so.status,
            "created_at": so.created_at,
            "updated_at": so.updated_at,
        }
        for so in sorted(order.seller_orders, key=lambda s: s.seller_order_id)
    ]

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
        "seller_orders": seller_orders,
        "items": items,
    }


def map_order_status_to_child_status(order_status: OrderStatus) -> SellerOrderStatus:
    if order_status in {OrderStatus.shipped, OrderStatus.partially_shipped}:
        return SellerOrderStatus.shipped
    if order_status in {OrderStatus.delivered, OrderStatus.partially_delivered}:
        return SellerOrderStatus.delivered
    if order_status in {OrderStatus.cancelled, OrderStatus.partially_cancelled}:
        return SellerOrderStatus.cancelled
    if order_status == OrderStatus.returned:
        return SellerOrderStatus.returned
    if order_status == OrderStatus.ready_to_ship:
        return SellerOrderStatus.ready_to_ship
    if order_status == OrderStatus.processing:
        return SellerOrderStatus.processing
    return SellerOrderStatus.pending


def ensure_seller_orders_initialized(db: Session, order: Order) -> None:
    if order.seller_orders and all(item.seller_order_id for item in order.items):
        return

    default_child_status = map_order_status_to_child_status(order.status)
    seller_order_by_seller: dict[int, SellerOrder] = {
        seller_order.seller_id: seller_order for seller_order in order.seller_orders
    }

    for item in order.items:
        seller_id = item.seller_id or (item.book.seller_id if item.book else None)
        if seller_id is None:
            raise HTTPException(status_code=400, detail="Order item seller is missing")

        item.seller_id = seller_id
        if item.status is None:
            item.status = OrderItemStatus(default_child_status.value)

        seller_order = seller_order_by_seller.get(seller_id)
        if seller_order is None:
            seller_order = SellerOrder(
                order_id=order.order_id,
                seller_id=seller_id,
                status=default_child_status,
            )
            db.add(seller_order)
            db.flush()
            seller_order_by_seller[seller_id] = seller_order

        if item.seller_order_id is None:
            item.seller_order_id = seller_order.seller_order_id


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

        seller_order_by_seller: dict[int, SellerOrder] = {}

        for cart_item in cart_items:
            book = locked_books[cart_item.book_id]

            seller_order = seller_order_by_seller.get(book.seller_id)
            if seller_order is None:
                seller_order = SellerOrder(
                    order_id=order.order_id,
                    seller_id=book.seller_id,
                    status=SellerOrderStatus.pending,
                )
                db.add(seller_order)
                db.flush()
                seller_order_by_seller[book.seller_id] = seller_order

            order_item = OrderItem(
                order_id=order.order_id,
                seller_order_id=seller_order.seller_order_id,
                seller_id=book.seller_id,
                book_id=book.book_id,
                quantity=cart_item.quantity,
                unit_price=book.price,
                status=OrderItemStatus.pending,
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
        .options(
            joinedload(Order.items).joinedload(OrderItem.book),
            joinedload(Order.seller_orders),
            joinedload(Order.payment),
        )
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

    delivered_transition = False
    try:
        if data.status == OrderStatus.delivered and order.status != OrderStatus.delivered:
            payment = get_payment_for_order(db, order.order_id, lock=True)
            mark_payment_completed_on_delivery(order, payment)
            finalize_order_delivery(db, order)
            delivered_transition = True
        else:
            order.status = data.status
        db.commit()
        db.refresh(order)
        if delivered_transition:
            sync_book_purchase_counts(order)
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

    if order.status in {OrderStatus.shipped, OrderStatus.partially_shipped}:
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

    if order.status not in [OrderStatus.pending, OrderStatus.processing, OrderStatus.ready_to_ship]:
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

    if order.status not in {OrderStatus.shipped, OrderStatus.partially_shipped}:
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

    if order.status not in {OrderStatus.shipped, OrderStatus.partially_shipped}:
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
        sync_book_purchase_counts(order)
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
        .options(
            joinedload(Order.items).joinedload(OrderItem.book),
            joinedload(Order.seller_orders),
            joinedload(Order.payment),
        )
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

    ensure_order_can_be_shipped(order, order.payment)
    ensure_seller_orders_initialized(db, order)

    if requester_role != "admin":
        seller_ids = {seller_order.seller_id for seller_order in order.seller_orders}
        if requester_id not in seller_ids:
            raise HTTPException(
                status_code=403,
                detail="You can only update orders containing your books",
            )

    try:
        target_seller_orders = order.seller_orders
        if requester_role != "admin":
            target_seller_orders = [
                seller_order for seller_order in order.seller_orders if seller_order.seller_id == requester_id
            ]

        for seller_order in target_seller_orders:
            if seller_order.status in {SellerOrderStatus.cancelled, SellerOrderStatus.returned}:
                continue
            seller_order.status = SellerOrderStatus.shipped
            for item in order.items:
                if item.seller_order_id == seller_order.seller_order_id:
                    item.status = OrderItemStatus.shipped

        recalculate_order_status(db, order.order_id)
        db.commit()
        db.refresh(order)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update order status")

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book), joinedload(Order.seller_orders))
        .filter(Order.order_id == order_id)
        .first()
    )
    publish_order_shipped(order)
    return serialize_order(order)


@marketplace_router.patch("/seller-orders/{seller_order_id}/status", response_model=SellerOrderResponse)
def update_seller_order_status(
    seller_order_id: int,
    data: UpdateSellerOrderStatusRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    # Backfill legacy orders on-demand if this seller order has not been materialized yet.
    if seller_order_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid seller order id")

    seller_order = (
        db.query(SellerOrder)
        .filter(SellerOrder.seller_order_id == seller_order_id)
        .with_for_update()
        .first()
    )
    if not seller_order:
        raise HTTPException(status_code=404, detail="Seller order not found")

    if requester_role != "admin" and seller_order.seller_id != requester_id:
        raise HTTPException(status_code=403, detail="You can only update your own seller orders")

    if seller_order.status == data.status:
        return seller_order

    if data.status == SellerOrderStatus.delivered:
        raise HTTPException(
            status_code=400,
            detail="Seller order delivery must be confirmed by the buyer",
        )

    try:
        seller_order.status = data.status

        items = (
            db.query(OrderItem)
            .filter(OrderItem.seller_order_id == seller_order.seller_order_id)
            .with_for_update()
            .all()
        )
        for item in items:
            item.status = OrderItemStatus(data.status.value)

        recalculate_order_status(db, seller_order.order_id)
        db.commit()
        db.refresh(seller_order)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update seller order status")

    return seller_order


@marketplace_router.patch("/order-items/{order_item_id}/status", response_model=MessageResponse)
def update_order_item_status(
    order_item_id: int,
    data: UpdateOrderItemStatusRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("seller", "admin")),
):
    requester_id = int(payload["sub"])
    requester_role = payload["role"]

    item = (
        db.query(OrderItem)
        .options(joinedload(OrderItem.book))
        .filter(OrderItem.order_item_id == order_item_id)
        .with_for_update()
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")

    seller_id = item.seller_id or (item.book.seller_id if item.book else None)
    if seller_id is None:
        raise HTTPException(status_code=400, detail="Order item seller is missing")

    if requester_role != "admin" and requester_id != seller_id:
        raise HTTPException(status_code=403, detail="You can only update your own order items")

    if data.status == OrderItemStatus.delivered:
        raise HTTPException(
            status_code=400,
            detail="Order item delivery must be confirmed by the buyer",
        )

    try:
        item.status = data.status
        if item.seller_order_id:
            sibling_items = (
                db.query(OrderItem)
                .filter(OrderItem.seller_order_id == item.seller_order_id)
                .with_for_update()
                .all()
            )
            if sibling_items:
                statuses = {sibling.status for sibling in sibling_items}
                if len(statuses) == 1:
                    seller_order = (
                        db.query(SellerOrder)
                        .filter(SellerOrder.seller_order_id == item.seller_order_id)
                        .with_for_update()
                        .first()
                    )
                    if seller_order:
                        seller_order.status = SellerOrderStatus(next(iter(statuses)).value)

        recalculate_order_status(db, item.order_id)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update order item status")

    return {"message": "Order item status updated"}


@marketplace_router.post("/orders/{order_id}/recalculate", response_model=OrderResponse)
def recalculate_order_status_endpoint(
    order_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
):
    try:
        recalculate_order_status(db, order_id)
        db.commit()
    except ValueError:
        db.rollback()
        raise HTTPException(status_code=404, detail="Order not found")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to recalculate order status")

    order = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.book),
            joinedload(Order.seller_orders),
            joinedload(Order.payment),
        )
        .filter(Order.order_id == order_id)
        .first()
    )
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
