"""API routes for the recommendation service."""

from fastapi import APIRouter, HTTPException, Query

from .recommend_service import get_recommendations

router = APIRouter()


@router.get("/recommend/{user_id}")
def recommend(user_id: int, top_k: int | None = Query(default=None, ge=1, le=100)):
    try:
        return get_recommendations(user_id, top_k=top_k)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/recommendations/{user_id}")
def recommendations(
    user_id: int, top_k: int | None = Query(default=None, ge=1, le=100)
):
    try:
        return get_recommendations(user_id, top_k=top_k)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
