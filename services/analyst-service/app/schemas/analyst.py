from typing import Any, Literal
from pydantic import BaseModel, Field


class AnalystAskRequest(BaseModel):
    question: str = Field(..., min_length=3)
    tenant_id: str
    user_id: str
    provider: Literal["auto", "gemini", "self_host"] = "auto"
    include_sql: bool = True
    limit: int = 50


class AnalystAskResponse(BaseModel):
    provider_used: str
    question: str
    generated_sql: str | None = None
    explanation: str
    columns: list[str]
    rows: list[dict[str, Any]]
    execution_ms: int