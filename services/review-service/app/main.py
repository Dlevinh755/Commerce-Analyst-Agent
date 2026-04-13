import threading

from fastapi import FastAPI

from .db import ensure_indexes
from .routers import reviews

app = FastAPI(
    title="Review Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

ensure_indexes()

app.include_router(reviews.router)


def _run_seed_in_background() -> None:
    """Run review seeding in a background thread to avoid blocking startup."""
    try:
        from .seed import run_seed
        run_seed()
    except Exception as exc:
        print(f"[review-service] Seed error: {exc}")


# Start seed in background thread so health checks remain responsive
_seed_thread = threading.Thread(target=_run_seed_in_background, daemon=True)
_seed_thread.start()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "review"}
