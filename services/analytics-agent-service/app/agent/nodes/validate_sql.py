from __future__ import annotations

from langgraph.config import get_stream_writer

from app.agent.state import AgentState
from app.security.sql_guard import validate_sql


def _safe_stream_writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def validate_sql_node(state: AgentState) -> dict:
    if not state.generated_sql:
        raise ValueError("generated_sql is required")

    writer = _safe_stream_writer()
    writer({
        "type": "step_start",
        "step": "validate_sql",
        "message": "Đang kiểm tra an toàn SQL",
    })

    try:
        allowed_tables = set(state.relevant_schema.keys())
        validated = validate_sql(state.generated_sql, allowed_tables=allowed_tables)
        writer({
            "type": "step_end",
            "step": "validate_sql",
            "message": "Đã hoàn thành validate_sql",
            "payload": {"validated_sql": validated},
        })
        return {"validated_sql": validated}
    except Exception as exc:
        writer({
            "type": "step_error",
            "step": "validate_sql",
            "message": "Lỗi khi xác thực SQL",
            "payload": {"error": str(exc)},
        })
        raise
