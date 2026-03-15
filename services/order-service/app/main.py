from fastapi import FastAPI
from .db import Base, engine
from .routers import orders

app = FastAPI(
    title="Order Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)

app.include_router(orders.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "order"}