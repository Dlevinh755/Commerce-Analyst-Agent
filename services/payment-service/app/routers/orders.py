from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import distinct

from ..db import get_db
from ..models import CartItem, Book, Order, OrderItem, OrderStatus
from ..schemas import (
    CheckoutRequest,
    UpdateOrderStatusRequest,
    OrderResponse,
    OrderListResponse,
    MessageResponse,
)
from ..deps import get_order_or_404
from ..common.auth_jwt import require_roles

router = APIRouter(prefix="/orders", tags=["Orders"])


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
        "total_amount": Decimal(order.total_amount),
        "shipping_address": order.shipping_address,
        "status": order.status,
        "items": items,
    }


@router.post("/checkout", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def checkout(
    data: CheckoutRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])

    cart_items = (
        db.query(CartItem)
        .options(joinedload(CartItem.book))
        .filter(CartItem.buyer_id == buyer_id)
        .all()
    )

    if not cart_items:
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
                raise HTTPException(
                    status_code=400,
                    detail=f"Book with id {cart_item.book_id} not found",
                )

            if book.stock_quantity < cart_item.quantity:
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

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Checkout failed")

    created_order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book))
        .filter(Order.order_id == order.order_id)
        .first()
    )
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
        base_query.options(joinedload(Order.items).joinedload(OrderItem.book))
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

    total = query.with_entities(distinct(Order.order_id)).count()

    orders = (
        query.options(joinedload(Order.items).joinedload(OrderItem.book))
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
        .options(joinedload(Order.items).joinedload(OrderItem.book))
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
        .options(joinedload(Order.items).joinedload(OrderItem.book))
        .filter(Order.order_id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == OrderStatus.cancelled and data.status != OrderStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cancelled order cannot be reactivated")

    order.status = data.status
    db.commit()
    db.refresh(order)

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book))
        .filter(Order.order_id == order_id)
        .first()
    )
    return serialize_order(order)


@router.post("/{order_id}/cancel", response_model=MessageResponse)
def cancel_my_order(
    order_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.book))
        .filter(Order.order_id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.buyer_id != buyer_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own orders")

    if order.status not in [OrderStatus.pending, OrderStatus.processing]:
        raise HTTPException(
            status_code=400,
            detail="Only pending or processing orders can be cancelled",
        )

    try:
        for item in order.items:
            book = (
                db.query(Book)
                .filter(Book.book_id == item.book_id)
                .with_for_update()
                .first()
            )
            if book:
                book.stock_quantity += item.quantity

        order.status = OrderStatus.cancelled
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to cancel order")

    return {"message": "Order cancelled successfully"}


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
        query.options(joinedload(Order.items).joinedload(OrderItem.book))
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