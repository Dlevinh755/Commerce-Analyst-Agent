from fastapi import FastAPI
from .db import Base, engine
from .routers import cart

app = FastAPI(
    title="Cart Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)

app.include_router(cart.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "cart"}