from __future__ import annotations

import json
from langgraph.config import get_stream_writer

from app.agent.state import AgentState, SqlDraft
from app.common.logging import get_logger
from app.llm.gemini_client import GeminiClient
from app.llm.model_router import ModelRouter

logger = get_logger(__name__)


def _safe_stream_writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _build_prompt(state: AgentState) -> str:
    if state.analysis_plan is None:
        raise ValueError("analysis_plan is required")
    if not state.relevant_schema:
        raise ValueError("relevant_schema is required")

    return f"""
Bạn là chuyên gia viết Databricks SQL.

Nhiệm vụ:
- Chỉ dịch AnalysisPlan thành 1 câu Databricks SQL.
- KHÔNG tự thay đổi metric, fact_table, join, filter ngoài AnalysisPlan.
- Chỉ dùng bảng/cột có trong relevant_schema.
- Chỉ viết SELECT hoặc WITH ... SELECT.
- Không dùng INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, MERGE.
- Nếu query không aggregate hoặc có limit trong plan, áp dụng LIMIT.
- Trả về JSON đúng schema SqlDraft.

Databricks SQL rules:
- DATE(col) để lấy ngày.
- DATE_TRUNC('month', col) để gom theo tháng.
- CURRENT_DATE() cho ngày hiện tại.
- INTERVAL 30 DAYS cho khoảng thời gian.
- Alias cột nên rõ ràng, dễ đọc.
- Nếu cột thời gian trong schema/runtime là BIGINT epoch, phải convert trước khi dùng hàm thời gian hoặc filter thời gian:
  CAST(FROM_UNIXTIME(CASE WHEN ABS(CAST(col AS BIGINT)) >= 1000000000000 THEN CAST(CAST(col AS BIGINT) / 1000 AS BIGINT) ELSE CAST(col AS BIGINT) END) AS TIMESTAMP)
- Không được gọi DATE_TRUNC/DATE/YEAR/... trực tiếp lên cột BIGINT.
- Không được viết CAST(col AS DATE) hoặc CAST(col AS TIMESTAMP) trực tiếp nếu col là BIGINT epoch.
- Nếu cần lấy ngày từ BIGINT epoch, dùng DATE(CAST(FROM_UNIXTIME(... ) AS TIMESTAMP)).

Question:
{state.question}

AnalysisPlan:
{state.analysis_plan.model_dump_json(indent=2)}

Relevant schema:
{json.dumps(state.relevant_schema, ensure_ascii=False, indent=2)}

Yêu cầu output:
{{
  "sql": "SELECT ..."
}}
""".strip()


def _get_join_tables(state: AgentState) -> list[str]:
    if state.analysis_plan is None:
        return []
    return [join.table for join in state.analysis_plan.joins]


def generate_sql_node(state: AgentState) -> dict:
    if state.analysis_plan is None:
        raise ValueError("analysis_plan is required")

    writer = _safe_stream_writer()
    writer({
        "type": "step_start",
        "step": "generate_sql",
        "message": "Đang sinh SQL",
    })

    try:
        logger.debug(
            "Generating SQL | session_id=%s | plan_goal=%s",
            state.session_id,
            state.analysis_plan.goal,
        )

        client = GeminiClient()
        draft = client.generate_structured(
            model=ModelRouter.for_generate_sql(),
            prompt=_build_prompt(state),
            schema=SqlDraft,
        )

        sql = draft.sql.strip()
        if not sql:
            raise ValueError("Gemini returned empty SQL")

        logger.info(
            "SQL generated | session_id=%s | sql_length=%s | fact_table=%s | join_tables=%s",
            state.session_id,
            len(sql),
            state.analysis_plan.fact_table,
            ",".join(_get_join_tables(state)),
        )

        writer({
            "type": "step_end",
            "step": "generate_sql",
            "message": "Đã hoàn thành generate_sql",
            "payload": {"sql": sql},
        })
        return {"generated_sql": sql}
    except Exception as exc:
        logger.error(
            "SQL generation failed | session_id=%s | error=%s",
            state.session_id,
            str(exc),
            exc_info=True,
        )
        writer({
            "type": "step_error",
            "step": "generate_sql",
            "message": "Lỗi khi sinh SQL",
            "payload": {"error": str(exc)},
        })
        raise
