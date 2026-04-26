from __future__ import annotations

from fastapi import FastAPI
from .config import settings
from .api.routes_query import router as query_router
from .common.logging import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)

app = FastAPI(
    title="AI Data Query Agent",
    version="0.1.0",
    root_path=settings.ANALYTICS_AGENT_ROOT_PATH,
)

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 AI Data Query Agent starting up...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 AI Data Query Agent shutting down...")

app.include_router(query_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
