from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, UserRole
from ..schemas import (
    UserResponse,
    UpdateMeRequest,
    UpdateMyAccountNumberRequest,
    UpdateUserRoleRequest,
    UpdateUserByAdminRequest,
    UserListResponse,
    MessageResponse,
)
from ..dependencies import get_current_user, require_roles

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    data: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.email is not None:
        existing_email = db.query(User).filter(
            User.email == data.email.lower(),
            User.user_id != current_user.user_id
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists")
        current_user.email = data.email.lower()

    if data.full_name is not None:
        current_user.full_name = data.full_name

    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/account-number", response_model=UserResponse)
def update_my_account_number(
    data: UpdateMyAccountNumberRequest,
    current_user: User = Depends(require_roles(UserRole.buyer, UserRole.seller)),
    db: Session = Depends(get_db),
):
    existing_account = db.query(User).filter(
        User.account_number == data.account_number,
        User.user_id != current_user.user_id,
    ).first()
    if existing_account:
        raise HTTPException(status_code=400, detail="Account number already exists")

    current_user.account_number = data.account_number
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("", response_model=UserListResponse)
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
    q: str | None = Query(default=None),
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    is_hidden: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    query = db.query(User)

    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                User.username.ilike(search),
                User.email.ilike(search),
                User.full_name.ilike(search),
            )
        )

    if role is not None:
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if is_hidden is not None:
        query = query.filter(User.is_hidden == is_hidden)

    total = query.count()
    users = (
        query.order_by(User.user_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": users,
    }


@router.patch("/{user_id}/role", response_model=MessageResponse)
def update_user_role(
    user_id: int,
    data: UpdateUserRoleRequest,
    current_user: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = data.role
    db.commit()
    return {"message": f"User role updated to {data.role.value}"}


@router.patch("/{user_id}", response_model=UserResponse)
def update_user_by_admin(
    user_id: int,
    data: UpdateUserByAdminRequest,
    current_user: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.email is not None:
        existing_email = db.query(User).filter(
            User.email == data.email.lower(),
            User.user_id != user.user_id,
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists")
        user.email = data.email.lower()

    if data.full_name is not None:
        user.full_name = data.full_name

    if data.role is not None:
        user.role = data.role

    if data.account_number is not None:
        existing_account = db.query(User).filter(
            User.account_number == data.account_number,
            User.user_id != user.user_id,
        ).first()
        if existing_account:
            raise HTTPException(status_code=400, detail="Account number already exists")
        user.account_number = data.account_number

    if data.balance is not None:
        user.balance = data.balance

    if data.is_active is not None:
        user.is_active = data.is_active

    if data.is_hidden is not None:
        user.is_hidden = data.is_hidden

    if user.user_id == current_user.user_id and not user.is_active:
        raise HTTPException(status_code=400, detail="Admin cannot deactivate themselves")

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=MessageResponse)
def hide_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Admin cannot hide themselves")

    user.is_hidden = True
    user.is_active = False
    db.commit()
    return {"message": "User hidden successfully"}