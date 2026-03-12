import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum, func
from .db import Base


class UserRole(str, enum.Enum):
    buyer = "buyer"
    seller = "seller"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False, default=UserRole.buyer)
    created_at = Column(DateTime, server_default=func.current_timestamp())