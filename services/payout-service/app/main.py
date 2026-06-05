import logging
import os
import json
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import FastAPI

from .db import Base, engine, SessionLocal
from .routers import payouts
from .models import PayoutRequest, PayoutStatus, User

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

app = FastAPI(
    title="Payout Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)


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
        print(f"[payout-service] Could not load seed file: {exc}")
        return {}


def _parse_seed_datetime(value) -> datetime | None:
    if value in (None, "") or not isinstance(value, str):
        return None
    try:
        normalized = value.strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _apply_seed_payouts(seed_data: dict) -> None:
    seed_payouts = seed_data.get("payout_requests")
    if not isinstance(seed_payouts, list) or not seed_payouts:
        print("[payout-service] No payout_requests found in seed data.")
        return

    print(f"[payout-service] Seeding {len(seed_payouts)} payout requests...")
    db = SessionLocal()
    try:
        for entry in seed_payouts:
            if not isinstance(entry, dict):
                continue

            requester_username = str(entry.get("requester_username", "")).strip()
            requester_role = str(entry.get("requester_role", "")).strip().lower()
            account_number = str(entry.get("account_number", "")).strip()
            amount = Decimal(str(entry.get("amount", "0")))
            fee_rate = Decimal(str(entry.get("fee_rate", "0")))
            fee_amount = Decimal(str(entry.get("fee_amount", "0")))
            total_debit = Decimal(str(entry.get("total_debit", "0")))
            status_str = str(entry.get("status", "pending")).strip().lower()
            admin_username = entry.get("admin_username")
            admin_note = entry.get("admin_note")
            requested_at = _parse_seed_datetime(entry.get("requested_at"))
            reviewed_at = _parse_seed_datetime(entry.get("reviewed_at"))

            if not requester_username or not account_number or amount <= 0:
                continue

            # Look up requester user_id
            requester = db.query(User).filter(User.username == requester_username).first()
            if not requester:
                continue

            # Look up admin user_id if present
            admin_id = None
            if admin_username:
                admin_user = db.query(User).filter(User.username == admin_username).first()
                if admin_user:
                    admin_id = admin_user.user_id

            try:
                status_val = PayoutStatus(status_str)
            except ValueError:
                status_val = PayoutStatus.pending

            # Check for duplicate: same requester + amount + requested_at
            existing = db.query(PayoutRequest).filter(
                PayoutRequest.requester_id == requester.user_id,
                PayoutRequest.amount == amount,
                PayoutRequest.requested_at == requested_at
            ).first()

            if existing:
                continue

            pr = PayoutRequest(
                requester_id=requester.user_id,
                requester_role=requester_role,
                account_number=account_number,
                amount=amount,
                fee_rate=fee_rate,
                fee_amount=fee_amount,
                total_debit=total_debit,
                status=status_val,
                admin_id=admin_id,
                admin_note=admin_note,
                requested_at=requested_at or datetime.now(),
                reviewed_at=reviewed_at
            )
            db.add(pr)

        db.commit()
        print("[payout-service] Seed payout requests applied.")
    except Exception as exc:
        db.rollback()
        print(f"[payout-service] Seed payout requests error: {exc}")
    finally:
        db.close()


_apply_seed_payouts(_load_dev_seed_data())

app.include_router(payouts.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "payout"}
