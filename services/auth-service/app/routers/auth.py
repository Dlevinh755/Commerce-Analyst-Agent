from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..db import get_db
from ..models import User, UserRole, RefreshToken
from ..schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    AuthResponse,
    RefreshTokenRequest,
    LogoutRequest,
    VerifyResponse,
    MessageResponse,
    ChangePasswordRequest,
)
from ..security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_refresh_token_expiry,
)
from ..dependencies import get_current_user, require_roles

router = APIRouter(prefix="/auth", tags=["Auth"])


def build_auth_response(user: User, refresh_token: str, access_token: str):
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(
        or_(User.username == user_in.username, User.email == user_in.email)
    ).first()

    if existing_user:
        if existing_user.username == user_in.username:
            raise HTTPException(status_code=400, detail="Username already exists")
        raise HTTPException(status_code=400, detail="Email already exists")

    requested_role = user_in.role or UserRole.buyer
    if requested_role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin registration is not allowed",
        )

    new_user = User(
        username=user_in.username,
        password_hash=hash_password(user_in.password),
        email=user_in.email.lower(),
        full_name=user_in.full_name,
        role=requested_role,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=AuthResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active or user.is_hidden:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)

    access_token = create_access_token(user.user_id, user.username, role_value)
    refresh_token = create_refresh_token(user.user_id, user.username, role_value)

    refresh_token_row = RefreshToken(
        user_id=user.user_id,
        token=refresh_token,
        expires_at=get_refresh_token_expiry(),
        is_revoked=False,
    )
    db.add(refresh_token_row)
    db.commit()

    return build_auth_response(user, refresh_token, access_token)


@router.post("/refresh", response_model=AuthResponse)
def refresh_token(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    token_in_db = db.query(RefreshToken).filter(RefreshToken.token == data.refresh_token).first()
    if not token_in_db:
        raise HTTPException(status_code=401, detail="Refresh token not found")

    if token_in_db.is_revoked:
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active or user.is_hidden:
        raise HTTPException(status_code=403, detail="User account is inactive")

    token_in_db.is_revoked = True

    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    new_access_token = create_access_token(user.user_id, user.username, role_value)
    new_refresh_token = create_refresh_token(user.user_id, user.username, role_value)

    new_refresh_row = RefreshToken(
        user_id=user.user_id,
        token=new_refresh_token,
        expires_at=get_refresh_token_expiry(),
        is_revoked=False,
    )
    db.add(new_refresh_row)
    db.commit()

    return build_auth_response(user, new_refresh_token, new_access_token)


@router.post("/logout", response_model=MessageResponse)
def logout(data: LogoutRequest, db: Session = Depends(get_db)):
    token_in_db = db.query(RefreshToken).filter(RefreshToken.token == data.refresh_token).first()
    if token_in_db:
        token_in_db.is_revoked = True
        db.commit()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/verify", response_model=VerifyResponse)
def verify(current_user: User = Depends(get_current_user)):
    return {"valid": True, "user": current_user}


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    current_user.password_hash = hash_password(data.new_password)
    db.commit()

    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.user_id).update(
        {"is_revoked": True}
    )
    db.commit()

    return {"message": "Password changed successfully. Please login again."}


@router.get("/admin-only", response_model=UserResponse)
def admin_only(current_user: User = Depends(require_roles(UserRole.admin))):
    return current_user


@router.get("/seller-or-admin", response_model=UserResponse)
def seller_or_admin(
    current_user: User = Depends(require_roles(UserRole.seller, UserRole.admin))
):
    return current_user