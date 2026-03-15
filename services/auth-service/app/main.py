import os
from fastapi import FastAPI
from sqlalchemy import or_
from .db import Base, SessionLocal, engine
from .models import User, UserRole
from .security import hash_password
from .routers import auth, users

app = FastAPI(
    title="Auth Service",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

def _first_env(*keys: str) -> str:
    for key in keys:
        value = os.getenv(key)
        if value and value.strip():
            return value.strip()
    return ""


def seed_admin_user() -> None:
    admin_username = _first_env("AUTH_ADMIN_USERNAME", "ADMIN_USERNAME")
    admin_password = _first_env("AUTH_ADMIN_PASSWORD", "ADMIN_PASSWORD")
    admin_email = _first_env("AUTH_ADMIN_EMAIL", "ADMIN_EMAIL")
    admin_full_name = _first_env("AUTH_ADMIN_FULL_NAME", "ADMIN_FULL_NAME") or "System Admin"

    if not admin_username or not admin_password or not admin_email:
        return

    db = SessionLocal()
    try:
        existing_admin = db.query(User).filter(
            or_(User.username == admin_username, User.email == admin_email.lower())
        ).first()

        if existing_admin:
            changed = False
            if existing_admin.role != UserRole.admin:
                existing_admin.role = UserRole.admin
                changed = True

            if existing_admin.full_name != admin_full_name:
                existing_admin.full_name = admin_full_name
                changed = True

            if changed:
                db.commit()
            return

        admin_user = User(
            username=admin_username,
            password_hash=hash_password(admin_password),
            email=admin_email.lower(),
            full_name=admin_full_name,
            role=UserRole.admin,
        )
        db.add(admin_user)
        db.commit()
    finally:
        db.close()


Base.metadata.create_all(bind=engine)
seed_admin_user()

app.include_router(auth.router)
app.include_router(users.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "auth"}