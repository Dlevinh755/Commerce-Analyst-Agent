from fastapi import FastAPI
from app.api.routes_health import router as health_router
from app.api.routes_agent import router as agent_router

app = FastAPI(
    title="Analyst Service",
    version="0.1.0",
    description="Analyst Service for DataAgent Commerce",
)

app.include_router(health_router, tags=["health"])
app.include_router(agent_router, prefix="/v1", tags=["agent"])