from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..common.auth_jwt import require_roles
from ..db import get_db
from ..models import PayoutRequest, PayoutStatus, User
from ..schemas import CreatePayoutRequest, PayoutListResponse, PayoutResponse, ReviewPayoutRequest

router = APIRouter(prefix="/payouts", tags=["Payouts"])

FEE_RATES = {
    "seller": Decimal("0.05"),
    "buyer": Decimal("0.02"),
}
MONEY_QUANT = Decimal("1")


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def quantize_money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def calculate_fee(role: str, amount: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    fee_rate = FEE_RATES.get(str(role or "").lower())
    if fee_rate is None:
        raise HTTPException(status_code=400, detail="Only buyer and seller can request payouts")

    amount_vnd = quantize_money(amount)
    fee_amount = quantize_money(amount_vnd * fee_rate)
    total_debit = quantize_money(amount_vnd + fee_amount)
    return fee_rate, fee_amount, total_debit


def get_user_or_404(db: Session, user_id: int, lock: bool = False) -> User:
    query = db.query(User).filter(User.user_id == user_id)
    if lock:
        query = query.with_for_update()
    user = query.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_payout_or_404(db: Session, payout_id: int, lock: bool = False) -> PayoutRequest:
    query = db.query(PayoutRequest).filter(PayoutRequest.payout_id == payout_id)
    if lock:
        query = query.with_for_update()
    payout = query.first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout request not found")
    return payout


@router.post("", response_model=PayoutResponse, status_code=status.HTTP_201_CREATED)
def create_payout(
    data: CreatePayoutRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer", "seller")),
):
    requester_id = int(payload["sub"])
    requester_role = str(payload.get("role") or "").lower()
    requester = get_user_or_404(db, requester_id)

    if requester_role not in FEE_RATES:
        raise HTTPException(status_code=403, detail="Only buyer and seller can request payouts")
    if not requester.account_number:
        raise HTTPException(status_code=400, detail="Please update your account number before requesting a payout")

    fee_rate, fee_amount, total_debit = calculate_fee(requester_role, data.amount)
    if total_debit > Decimal(requester.balance):
        raise HTTPException(status_code=400, detail="Amount plus fee exceeds your current balance")

    payout = PayoutRequest(
        requester_id=requester.user_id,
        requester_role=requester_role,
        account_number=requester.account_number,
        amount=quantize_money(data.amount),
        fee_rate=fee_rate,
        fee_amount=fee_amount,
        total_debit=total_debit,
        status=PayoutStatus.pending,
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return payout


@router.get("/my", response_model=PayoutListResponse)
def list_my_payouts(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("buyer", "seller")),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    requester_id = int(payload["sub"])
    query = db.query(PayoutRequest).filter(PayoutRequest.requester_id == requester_id)
    total = query.count()
    items = (
        query.order_by(PayoutRequest.payout_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"page": page, "page_size": page_size, "total": total, "items": items}


@router.get("", response_model=PayoutListResponse)
def list_payouts(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
    status_filter: PayoutStatus | None = Query(default=None, alias="status"),
    requester_role: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    query = db.query(PayoutRequest).options(
        joinedload(PayoutRequest.requester),
        joinedload(PayoutRequest.admin),
    )
    if status_filter is not None:
        query = query.filter(PayoutRequest.status == status_filter)
    if requester_role:
        query = query.filter(PayoutRequest.requester_role == requester_role.lower())

    total = query.count()
    items = (
        query.order_by(PayoutRequest.payout_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"page": page, "page_size": page_size, "total": total, "items": items}


@router.post("/{payout_id}/approve", response_model=PayoutResponse)
def approve_payout(
    payout_id: int,
    data: ReviewPayoutRequest | None = None,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
):
    admin_id = int(payload["sub"])
    try:
        payout = get_payout_or_404(db, payout_id, lock=True)
        if payout.status != PayoutStatus.pending:
            raise HTTPException(status_code=400, detail="Only pending payout requests can be approved")
        if payout.requester_id == admin_id:
            raise HTTPException(status_code=400, detail="Admin cannot approve their own payout request")

        user_ids = sorted({payout.requester_id, admin_id})
        users = (
            db.query(User)
            .filter(User.user_id.in_(user_ids))
            .with_for_update()
            .all()
        )
        user_by_id = {user.user_id: user for user in users}
        requester = user_by_id.get(payout.requester_id)
        admin = user_by_id.get(admin_id)
        if requester is None:
            raise HTTPException(status_code=400, detail="Requester account not found")
        if admin is None:
            raise HTTPException(status_code=400, detail="Admin account not found")

        if Decimal(requester.balance) < Decimal(payout.total_debit):
            raise HTTPException(status_code=400, detail="Requester balance is no longer sufficient")

        requester.balance = quantize_money(Decimal(requester.balance) - Decimal(payout.total_debit))
        admin.balance = quantize_money(Decimal(admin.balance) + Decimal(payout.fee_amount))
        payout.status = PayoutStatus.approved
        payout.admin_id = admin_id
        payout.admin_note = data.admin_note.strip() if data and data.admin_note else None
        payout.reviewed_at = utc_now_naive()

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to approve payout request")

    payout = (
        db.query(PayoutRequest)
        .options(joinedload(PayoutRequest.requester), joinedload(PayoutRequest.admin))
        .filter(PayoutRequest.payout_id == payout_id)
        .first()
    )
    return payout


@router.post("/{payout_id}/reject", response_model=PayoutResponse)
def reject_payout(
    payout_id: int,
    data: ReviewPayoutRequest | None = None,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("admin")),
):
    admin_id = int(payload["sub"])
    try:
        payout = get_payout_or_404(db, payout_id, lock=True)
        if payout.status != PayoutStatus.pending:
            raise HTTPException(status_code=400, detail="Only pending payout requests can be rejected")

        payout.status = PayoutStatus.rejected
        payout.admin_id = admin_id
        payout.admin_note = data.admin_note.strip() if data and data.admin_note else None
        payout.reviewed_at = utc_now_naive()
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to reject payout request")

    payout = (
        db.query(PayoutRequest)
        .options(joinedload(PayoutRequest.requester), joinedload(PayoutRequest.admin))
        .filter(PayoutRequest.payout_id == payout_id)
        .first()
    )
    return payout
