from datetime import datetime
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
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str | None = None
    role: str | None = None
    exp: int | None = None