from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import CartItem
from ..schemas import (
    AddToCartRequest,
    UpdateCartItemRequest,
    CartItemResponse,
    CartSummaryResponse,
    MessageResponse,
)
from ..deps import get_book_or_404, get_cart_item_or_404
from ..common.auth_jwt import require_roles

router = APIRouter(prefix="/cart", tags=["Cart"])


def serialize_cart_item(item: CartItem):
    unit_price = Decimal(item.book.price)
    subtotal = unit_price * item.quantity

    return {
        "cart_id": item.cart_id,
        "buyer_id": item.buyer_id,
        "book_id": item.book_id,
        "quantity": item.quantity,
        "unit_price": unit_price,
        "subtotal": subtotal,
        "book": item.book,
    }


def build_cart_summary(items: list[CartItem]):
    serialized_items = [serialize_cart_item(item) for item in items]
    total_items = len(serialized_items)
    total_quantity = sum(item["quantity"] for item in serialized_items)
    total_amount = sum(item["subtotal"] for item in serialized_items)
    return {
        "total_items": total_items,
        "total_quantity": total_quantity,
        "total_amount": total_amount,
        "items": serialized_items,
    }


@router.get("", response_model=CartSummaryResponse)
def get_my_cart(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])
    items = (
        db.query(CartItem)
        .options(joinedload(CartItem.book))
        .filter(CartItem.buyer_id == buyer_id)
        .order_by(CartItem.cart_id.desc())
        .all()
    )
    return build_cart_summary(items)


@router.post("", response_model=CartItemResponse, status_code=status.HTTP_201_CREATED)
def add_to_cart(
    data: AddToCartRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])
    book = get_book_or_404(db, data.book_id)

    if book.stock_quantity <= 0:
        raise HTTPException(status_code=400, detail="Book is out of stock")

    existing_item = db.query(CartItem).filter(
        CartItem.buyer_id == buyer_id,
        CartItem.book_id == data.book_id
    ).first()

    desired_quantity = data.quantity
    if existing_item:
        desired_quantity = existing_item.quantity + data.quantity

    if desired_quantity > book.stock_quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Requested quantity exceeds stock. Available stock: {book.stock_quantity}",
        )

    if existing_item:
        existing_item.quantity = desired_quantity
        db.commit()
        db.refresh(existing_item)
        db.refresh(book)
        item = (
            db.query(CartItem)
            .options(joinedload(CartItem.book))
            .filter(CartItem.cart_id == existing_item.cart_id)
            .first()
        )
        return serialize_cart_item(item)

    item = CartItem(
        buyer_id=buyer_id,
        book_id=data.book_id,
        quantity=data.quantity,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    item = (
        db.query(CartItem)
        .options(joinedload(CartItem.book))
        .filter(CartItem.cart_id == item.cart_id)
        .first()
    )
    return serialize_cart_item(item)


@router.patch("/{cart_id}", response_model=CartItemResponse)
def update_cart_item(
    cart_id: int,
    data: UpdateCartItemRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])
    item = get_cart_item_or_404(db, cart_id, buyer_id)
    book = get_book_or_404(db, item.book_id)

    if data.quantity > book.stock_quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Requested quantity exceeds stock. Available stock: {book.stock_quantity}",
        )

    item.quantity = data.quantity
    db.commit()
    db.refresh(item)

    item = (
        db.query(CartItem)
        .options(joinedload(CartItem.book))
        .filter(CartItem.cart_id == item.cart_id)
        .first()
    )
    return serialize_cart_item(item)


@router.delete("/{cart_id}", response_model=MessageResponse)
def delete_cart_item(
    cart_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])
    item = get_cart_item_or_404(db, cart_id, buyer_id)
    db.delete(item)
    db.commit()
    return {"message": "Cart item deleted successfully"}


@router.delete("", response_model=MessageResponse)
def clear_my_cart(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer")),
):
    buyer_id = int(payload["sub"])
    db.query(CartItem).filter(CartItem.buyer_id == buyer_id).delete()
    db.commit()
    return {"message": "Cart cleared successfully"}