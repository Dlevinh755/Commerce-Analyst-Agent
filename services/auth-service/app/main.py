import os
import json
from decimal import Decimal
from fastapi import FastAPI
from sqlalchemy import or_, text
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


def _is_dev_seed_enabled() -> bool:
    return os.getenv("DEV_AUTO_SEED", "false").strip().lower() == "true"


def _load_dev_seed_data() -> dict:
    if not _is_dev_seed_enabled():
        return {}

    seed_file = os.getenv("DEV_SEED_FILE", "/app/dev-seeds.json").strip() or "/app/dev-seeds.json"
    if not os.path.exists(seed_file):
        return {}

    try:
        with open(seed_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception as exc:
        print(f"[auth-service] Could not load seed file {seed_file}: {exc}")
        return {}


def _apply_seed_users(seed_data: dict) -> None:
    buyers = seed_data.get("buyers") if isinstance(seed_data.get("buyers"), list) else []
    sellers = seed_data.get("sellers") if isinstance(seed_data.get("sellers"), list) else []
    all_entries: list[tuple[dict, UserRole]] = [
        *((entry, UserRole.buyer) for entry in buyers if isinstance(entry, dict)),
        *((entry, UserRole.seller) for entry in sellers if isinstance(entry, dict)),
    ]

    if not all_entries:
        return

    db = SessionLocal()
    try:
        for entry, role in all_entries:
            username = str(entry.get("username", "")).strip()
            email = str(entry.get("email", "")).strip().lower()
            password = str(entry.get("password", "")).strip()

            if not username or not email or not password:
                continue

            full_name = str(entry.get("full_name", "")).strip() or username
            account_number_raw = entry.get("account_number")
            account_number = None
            if account_number_raw is not None:
                account_number_str = str(account_number_raw).strip()
                account_number = account_number_str or None

            try:
                balance = Decimal(str(entry.get("balance", "0")))
            except Exception:
                balance = Decimal("0")

            is_active = bool(entry.get("is_active", True))
            is_hidden = bool(entry.get("is_hidden", False))

            existing = db.query(User).filter(
                or_(User.username == username, User.email == email)
            ).first()

            if existing:
                existing.email = email
                existing.full_name = full_name
                existing.role = role
                existing.password_hash = hash_password(password)
                existing.account_number = account_number
                existing.balance = balance
                existing.is_active = is_active
                existing.is_hidden = is_hidden
            else:
                db.add(
                    User(
                        username=username,
                        email=email,
                        full_name=full_name,
                        role=role,
                        password_hash=hash_password(password),
                        account_number=account_number,
                        balance=balance,
                        is_active=is_active,
                        is_hidden=is_hidden,
                    )
                )

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


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

            admin_password_hash = hash_password(admin_password)
            if existing_admin.password_hash != admin_password_hash:
                existing_admin.password_hash = admin_password_hash
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
with engine.begin() as connection:
    connection.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
                    CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
                END IF;
            END
            $$;
            """
        )
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50)")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100)")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100)")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    )
    connection.execute(
        text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'password'
                ) THEN
                    EXECUTE 'UPDATE users SET password_hash = password WHERE password_hash IS NULL';
                END IF;
            END
            $$;
            """
        )
    )
    connection.execute(
        text("UPDATE users SET username = COALESCE(username, 'user_' || user_id::text) WHERE username IS NULL")
    )
    connection.execute(
        text("UPDATE users SET email = COALESCE(email, username || '@local.dev') WHERE email IS NULL")
    )
    connection.execute(
        text("UPDATE users SET full_name = COALESCE(full_name, username) WHERE full_name IS NULL")
    )
    connection.execute(
        text("UPDATE users SET role = 'buyer' WHERE role IS NULL")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(50)")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(14,2) NOT NULL DEFAULT 0")
    )
    connection.execute(
        text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_account_number ON users(account_number) WHERE account_number IS NOT NULL")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE")
    )
    connection.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE")
    )
seed_admin_user()
_apply_seed_users(_load_dev_seed_data())

app.include_router(auth.router)
app.include_router(users.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "auth"}