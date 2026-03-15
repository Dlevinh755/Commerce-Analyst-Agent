from pathlib import Path
from fastapi import FastAPI
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
from .db import Base, engine
from .routers import categories, books

app = FastAPI(
    title="Books Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

Base.metadata.create_all(bind=engine)

with engine.begin() as connection:
    connection.execute(
        text("ALTER TABLE books ADD COLUMN IF NOT EXISTS seller_username VARCHAR(100)")
    )

uploads_dir = Path("/app/uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(categories.router)
app.include_router(books.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "books"}