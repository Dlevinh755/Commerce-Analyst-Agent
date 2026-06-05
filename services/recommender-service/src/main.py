"""FastAPI entry point — read-only recommendations from Qdrant."""

from fastapi import FastAPI

from .routes import router

app = FastAPI(
    title="Book Recommendation Service",
    description="Content-based book recommendations via Qdrant vectors",
    version="1.0.0",
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
