from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, UserRole
from ..schemas import UserRegister, UserLogin, UserResponse, Token
from ..security import hash_password, verify_password, create_access_token
from ..dependencies import get_current_user, require_roles

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản mới",
    responses={
        201: {"description": "Tạo tài khoản thành công"},
        400: {"description": "Username hoặc email đã tồn tại"},
    },
)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    """
    Tạo tài khoản người dùng mới.

    - **username**: 3–50 ký tự, phải duy nhất
    - **password**: 6–100 ký tự
    - **email**: địa chỉ email hợp lệ, phải duy nhất
    - **full_name**: họ tên đầy đủ
    - **role**: `buyer` (mặc định) | `seller` | `admin`
    """
    existing_username = db.query(User).filter(User.username == user_in.username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists")

    existing_email = db.query(User).filter(User.email == user_in.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = User(
        username=user_in.username,
        password_hash=hash_password(user_in.password),
        email=user_in.email,
        full_name=user_in.full_name,
        role=user_in.role,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post(
    "/login",
    response_model=Token,
    summary="Đăng nhập & lấy JWT token",
    responses={
        200: {"description": "Đăng nhập thành công, trả về access token"},
        401: {"description": "Sai username hoặc password"},
    },
)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Xác thực người dùng và trả về JWT Bearer Token.

    Token có thời hạn, dùng để gọi các API yêu cầu xác thực.
    Copy `access_token` từ response và điền vào **Authorize** 🔒 với format: `Bearer <token>`
    """
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    access_token = create_access_token(
        data={
            "sub": str(user.user_id),
            "username": user.username,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Lấy thông tin người dùng hiện tại",
    responses={
        200: {"description": "Thông tin tài khoản đang đăng nhập"},
        401: {"description": "Token không hợp lệ hoặc đã hết hạn"},
    },
)
def me(current_user: User = Depends(get_current_user)):
    """
    Trả về thông tin của người dùng đang đăng nhập dựa trên JWT token.

    **Yêu cầu:** Header `Authorization: Bearer <token>`
    """
    return current_user


@router.get(
    "/admin-only",
    response_model=UserResponse,
    summary="Endpoint chỉ dành cho Admin",
    responses={
        200: {"description": "Thông tin admin đang đăng nhập"},
        401: {"description": "Token không hợp lệ hoặc đã hết hạn"},
        403: {"description": "Không đủ quyền — yêu cầu role admin"},
    },
)
def admin_only(current_user: User = Depends(require_roles(UserRole.admin))):
    """
    Chỉ người dùng có role **admin** mới được truy cập.

    **Yêu cầu:** Header `Authorization: Bearer <token>` với token của tài khoản admin.
    """
    return current_user


@router.get(
    "/seller-or-admin",
    response_model=UserResponse,
    summary="Endpoint dành cho Seller hoặc Admin",
    responses={
        200: {"description": "Thông tin người dùng đang đăng nhập"},
        401: {"description": "Token không hợp lệ hoặc đã hết hạn"},
        403: {"description": "Không đủ quyền — yêu cầu role seller hoặc admin"},
    },
)
def seller_or_admin(
    current_user: User = Depends(require_roles(UserRole.seller, UserRole.admin))
):
    """
    Chỉ người dùng có role **seller** hoặc **admin** mới được truy cập.

    **Yêu cầu:** Header `Authorization: Bearer <token>` với token của tài khoản seller/admin.
    """
    return current_user