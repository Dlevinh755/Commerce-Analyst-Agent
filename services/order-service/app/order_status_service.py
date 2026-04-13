from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .models import Order, OrderStatus, SellerOrder, SellerOrderStatus


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def aggregate_order_status(seller_statuses: list[SellerOrderStatus]) -> OrderStatus:
    if not seller_statuses:
        return OrderStatus.pending

    unique_statuses = set(seller_statuses)
    if len(unique_statuses) == 1:
        only = next(iter(unique_statuses))
        return OrderStatus(only.value)

    if SellerOrderStatus.delivered in unique_statuses or SellerOrderStatus.returned in unique_statuses:
        return OrderStatus.partially_delivered

    if SellerOrderStatus.shipped in unique_statuses:
        return OrderStatus.partially_shipped

    if SellerOrderStatus.cancelled in unique_statuses:
        return OrderStatus.partially_cancelled

    if SellerOrderStatus.ready_to_ship in unique_statuses:
        return OrderStatus.processing

    if SellerOrderStatus.processing in unique_statuses:
        return OrderStatus.processing

    return OrderStatus.pending


def recalculate_order_status(db: Session, order_id: int) -> Order:
    order = (
        db.query(Order)
        .filter(Order.order_id == order_id)
        .with_for_update()
        .first()
    )
    if not order:
        raise ValueError("Order not found")

    seller_orders = (
        db.query(SellerOrder)
        .filter(SellerOrder.order_id == order_id)
        .with_for_update()
        .all()
    )

    aggregated = aggregate_order_status([seller_order.status for seller_order in seller_orders])

    if order.status != aggregated:
        order.status = aggregated

    if aggregated == OrderStatus.delivered and order.delivered_at is None:
        order.delivered_at = utc_now_naive()

    if aggregated != OrderStatus.delivered and order.delivered_at is not None:
        order.delivered_at = None

    return order
