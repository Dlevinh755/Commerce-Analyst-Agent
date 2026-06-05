from __future__ import annotations

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    session_id: str = Field(..., description="Conversation/session identifier")
    question: str = Field(..., min_length=1)


class QueryResponse(BaseModel):
    session_id: str
    question: str
    validated_sql: str | None = None
    final_answer: str | None = None
    query_result: dict | None = None
    visualization: dict | None = None
    error: str | None = None
