from __future__ import annotations

import time
from langgraph.config import get_stream_writer

from app.agent.state import AgentState, QueryResult
from app.common.logging import get_logger
from app.db.databricks import DatabricksClient

logger = get_logger(__name__)


def _safe_stream_writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def execute_sql_node(state: AgentState) -> dict:
    if not state.validated_sql:
        raise ValueError("validated_sql is required")

    writer = _safe_stream_writer()
    writer({
        "type": "step_start",
        "step": "execute_sql",
        "message": "Đang chạy query",
        "payload": {"validated_sql": state.validated_sql},
    })

    db = DatabricksClient()
    try:
        started_at = time.perf_counter()
        df = db.query(state.validated_sql)
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)

        result = QueryResult(
            columns=list(df.columns),
            rows=df.head(50).to_dict(orient="records"),
            row_count=len(df),
            execution_ms=elapsed_ms,
        )

        writer({
            "type": "step_end",
            "step": "execute_sql",
            "message": "Đã hoàn thành execute_sql",
            "payload": {
                "row_count": result.row_count,
                "execution_ms": result.execution_ms,
                "columns": result.columns,
            },
        })
        return {
            "query_result": result,
            "execution_error": None,
        }
    except Exception as exc:
        error_msg = str(exc)
        logger.error(
            "SQL execution failed | session_id=%s | error=%s | sql=%s",
            state.session_id,
            error_msg,
            state.validated_sql,
            exc_info=True,
        )
        writer({
            "type": "step_error",
            "step": "execute_sql",
            "message": "Lỗi khi chạy query",
            "payload": {
                "error": error_msg,
                "sql": state.validated_sql,
                "repair_attempts": state.repair_attempts,
            },
        })
        return {
            "execution_error": error_msg,
        }
    finally:
        db.close()
