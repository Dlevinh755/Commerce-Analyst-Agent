from fastapi import FastAPI

from .db import Base, engine
from . import models
from .routers import reviews

app = FastAPI(
    title="Review Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)

app.include_router(reviews.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "review"}
