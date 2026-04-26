from __future__ import annotations

import json
from langgraph.config import get_stream_writer

from app.agent.state import AgentState, SqlRepairDraft
from app.llm.gemini_client import GeminiClient
from app.llm.model_router import ModelRouter
from app.common.logging import get_logger

logger = get_logger(__name__)


def _safe_stream_writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _build_prompt(state: AgentState) -> str:
    if state.analysis_plan is None:
        raise ValueError("analysis_plan is required")
    if not state.validated_sql:
        raise ValueError("validated_sql is required")
    if not state.execution_error:
        raise ValueError("execution_error is required")

    return f"""
Bạn là chuyên gia sửa lỗi Databricks SQL.

Nhiệm vụ:
- Sửa câu SQL bị lỗi dựa trên error message.
- Chỉ trả về SQL đã sửa, không đổi mục tiêu phân tích.
- Phải bám sát AnalysisPlan.
- Chỉ dùng bảng/cột có trong relevant_schema.
- Chỉ viết SELECT hoặc WITH ... SELECT.
- Không dùng INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, MERGE.
- Nếu lỗi do tên cột/bảng, hãy đối chiếu relevant_schema để sửa.
- Nếu lỗi do syntax Databricks SQL, sửa về đúng Databricks SQL.
- Không thêm filter/metric mới nếu AnalysisPlan không yêu cầu.
- Trả về JSON đúng schema SqlRepairDraft.
Repair rules:
- Nếu cột thời gian trong schema là timestamp, KHÔNG được dùng FROM_UNIXTIME.
- Chỉ dùng FROM_UNIXTIME khi schema ghi rõ cột là int/bigint epoch timestamp.
- Nếu SQL bị rỗng do filter status không được user yêu cầu, hãy bỏ filter đó.
- Không tự thêm order_overall_status = 'delivered' cho metric orders.

Original question:
{state.question}

AnalysisPlan:
{state.analysis_plan.model_dump_json(indent=2)}

Relevant schema:
{json.dumps(state.relevant_schema, ensure_ascii=False, indent=2)}

Failed SQL:
{state.validated_sql}

Database error:
{state.execution_error}

Output:
{{
  "sql": "SELECT ...",
  "explanation": "Mô tả ngắn lỗi đã sửa"
}}
""".strip()


def repair_sql_node(state: AgentState) -> dict:
    writer = _safe_stream_writer()

    writer({
        "type": "step_start",
        "step": "repair_sql",
        "message": "Đang sửa SQL bị lỗi",
        "payload": {
            "repair_attempts": state.repair_attempts + 1,
        },
    })

    try:
        client = GeminiClient()

        draft = client.generate_structured(
            model=ModelRouter.for_lightweight_repair(),
            prompt=_build_prompt(state),
            schema=SqlRepairDraft,
        )

        repaired_sql = draft.sql.strip()

        if not repaired_sql:
            raise ValueError("Repair model returned empty SQL")

        logger.info(
            "SQL repaired | session_id=%s | attempts=%s | sql_length=%s",
            state.session_id,
            state.repair_attempts + 1,
            len(repaired_sql),
        )

        writer({
            "type": "step_end",
            "step": "repair_sql",
            "message": "Đã sửa SQL",
            "payload": {
                "sql": repaired_sql,
                "explanation": draft.explanation,
                "repair_attempts": state.repair_attempts + 1,
            },
        })

        return {
            "generated_sql": repaired_sql,
            "validated_sql": None,
            "execution_error": None,
            "repair_attempts": state.repair_attempts + 1,
        }

    except Exception as e:
        writer({
            "type": "step_error",
            "step": "repair_sql",
            "message": "Không thể sửa SQL",
            "payload": {"error": str(e)},
        })
        raise
