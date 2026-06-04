"""Shared helpers for FastAPI service."""


def to_qdrant_point_id(point_id: int) -> int:
    """Must match Databricks storage_*_qdrant (id = user_id / book_id)."""
    return int(point_id)
