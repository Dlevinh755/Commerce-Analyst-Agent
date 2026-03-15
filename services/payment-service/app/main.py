from fastapi import FastAPI
from .db import Base, engine
from .routers import payments

app = FastAPI(
    title="Payment Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)

app.include_router(payments.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "payment"}