from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from .models import UserRole


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=100)
    role: UserRole = UserRole.buyer


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    full_name: str
    role: UserRole
    account_number: str | None = None
    balance: Decimal
    is_active: bool
    is_hidden: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class VerifyResponse(BaseModel):
    valid: bool
    user: UserResponse


class MessageResponse(BaseModel):
    message: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


class UpdateMeRequest(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)


class UpdateMyAccountNumberRequest(BaseModel):
    account_number: str = Field(..., min_length=6, max_length=50)


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


class UpdateUserByAdminRequest(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[UserRole] = None
    account_number: Optional[str] = Field(None, min_length=6, max_length=50)
    balance: Optional[Decimal] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    is_hidden: Optional[bool] = None


class UserListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[UserResponse]


class TokenPayload(BaseModel):
    sub: str | None = None
    role: str | None = None
    exp: int | None = None