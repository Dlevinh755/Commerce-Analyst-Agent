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


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "review"}
