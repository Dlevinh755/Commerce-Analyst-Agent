from __future__ import annotations

from typing import Any, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

class SqlRepairDraft(BaseModel):
    sql: str
    explanation: str | None = None

class ComparisonSpec(BaseModel):
    enabled: bool = False
    compare_to: Optional[str] = None
    granularity: Optional[str] = None

class JoinSpec(BaseModel):
    table: str
    join_type: Literal["inner", "left", "right", "full"] = "left"
    on: str


class MetricSpec(BaseModel):
    name: str
    expression: str
    alias: str


class ChatTurn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    role: Literal["user", "assistant"]
    content: str


class ParsedIntent(BaseModel):
    model_config = ConfigDict(extra='forbid')
    is_followup: bool = False
    metric: Optional[str] = None
    dimensions: list[str] = Field(default_factory=list)
    time_range: Optional[str] = None
    time_grain: Optional[str] = None
    filters: list[str] = Field(default_factory=list)
    ranking_type: Optional[str] = None   # top / bottom
    ranking_value: Optional[int] = None
    compare_to: Optional[str] = None
    source_hint: Optional[str] = None
    override_mode: str | None = None   # inherit / append / replace
    needs_comparison: bool = False
    comparison_granularity: str | None = None
    limit: int | None = None
    sort_by: str | None = None
    sort_order: str | None = None


class AnalysisPlan(BaseModel):
    model_config = ConfigDict(extra='forbid')
    goal: str

    fact_table: str
    joins: list[JoinSpec] = Field(default_factory=list, description="List of join clauses")
    
    dimensions: list[str] = Field(default_factory=list)
    metrics: list[MetricSpec] = Field(default_factory=list, description="List of metrics/aggregations")
    filters: list[str] = Field(default_factory=list)
    
    order_by: list[str] = Field(default_factory=list)
    limit: Optional[int] = None
    group_by: list[str] = Field(default_factory=list)
    
    comparison: Optional[ComparisonSpec] = None
    notes: list[str] = Field(default_factory=list)

class SqlDraft(BaseModel):
    model_config = ConfigDict(extra='forbid')
    sql: str


class QueryResult(BaseModel):
    model_config = ConfigDict(extra='forbid')
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list, description="List of result rows as JSON objects")
    row_count: int = 0
    execution_ms: Optional[int] = None



class ConversationMemory(BaseModel):
    model_config = ConfigDict(extra='forbid')
    last_user_questions: list[str] = Field(default_factory=list)
    last_metric: Optional[str] = None
    last_dimensions: list[str] = Field(default_factory=list)
    last_time_range: Optional[str] = None
    last_time_grain: Optional[str] = None
    last_filters: list[str] = Field(default_factory=list)
    last_compare_to: Optional[str] = None
    last_source_hint: Optional[str] = None
    last_relevant_tables: list[str] = Field(default_factory=list)
    last_sql: Optional[str] = None
    last_analysis_summary: Optional[str] = None


class AgentState(BaseModel):
    model_config = ConfigDict(extra='forbid')
    session_id: str
    question: str

    chat_history: list[ChatTurn] = Field(default_factory=list)
    memory: ConversationMemory = Field(default_factory=ConversationMemory)

    parsed_intent: Optional[ParsedIntent] = None
    relevant_schema: dict[str, Any] = Field(default_factory=dict)
    analysis_plan: Optional[AnalysisPlan] = None

    generated_sql: Optional[str] = None
    validated_sql: Optional[str] = None

    query_result: Optional[QueryResult] = None
    final_answer: Optional[str] = None

    execution_error: str | None = None
    repair_attempts: int = 0
    max_repair_attempts: int = 2

    error: Optional[str] = None