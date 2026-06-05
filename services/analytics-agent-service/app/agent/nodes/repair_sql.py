from __future__ import annotations

import json

from langgraph.config import get_stream_writer

from app.agent.state import AgentState, SqlRepairDraft
from app.common.logging import get_logger
from app.llm.gemini_client import GeminiClient
from app.llm.model_router import ModelRouter
from app.metadata.loader import load_catalog

logger = get_logger(__name__)


def _safe_stream_writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _format_query_rules(catalog: dict) -> str:
    query_rules = catalog.get("query_rules", {})
    if not query_rules:
        return "- Không có query_rules nào trong catalog."
    return json.dumps(query_rules, ensure_ascii=False, indent=2)


def _format_date_handling(catalog: dict, relevant_schema: dict[str, dict]) -> str:
    date_handling = catalog.get("date_handling", {})
    relevant_facts = [table_name for table_name in relevant_schema if table_name in date_handling]
    scoped_rules = {table_name: date_handling[table_name] for table_name in relevant_facts}
    if not scoped_rules:
        return "- Không có date_handling rule áp dụng cho relevant_schema."
    return json.dumps(scoped_rules, ensure_ascii=False, indent=2)


def _build_prompt(state: AgentState) -> str:
    if state.analysis_plan is None:
        raise ValueError("analysis_plan is required")
    if not state.validated_sql:
        raise ValueError("validated_sql is required")
    if not state.execution_error:
        raise ValueError("execution_error is required")

    catalog = load_catalog()
    query_rules_text = _format_query_rules(catalog)
    date_rules_text = _format_date_handling(catalog, state.relevant_schema)

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
- Không thêm metric, filter, join hoặc business rule mới nếu AnalysisPlan không yêu cầu.
- Trả về JSON đúng schema SqlRepairDraft.

Query rules từ catalog.yaml:
{query_rules_text}

Date handling từ catalog.yaml cho các bảng liên quan:
{date_rules_text}

Repair rules:
- Ưu tiên sửa tối thiểu để query chạy được; không viết lại toàn bộ SQL nếu không cần.
- Phải giữ nguyên business semantics từ AnalysisPlan, bao gồm metric, source table, join, filter và limit.
- Nếu AnalysisPlan hoặc SQL hiện tại đang dùng expression thời gian theo catalog, không thay sang expression khác nếu không bắt buộc.
- Nếu cột là BIGINT epoch theo catalog, sửa bằng expression convert đúng từ catalog; không dùng CAST trực tiếp sang DATE/TIMESTAMP nếu catalog cấm.
- Nếu cột là TIMESTAMP thực sự, không được thêm logic convert epoch không cần thiết.
- Không tự bỏ default_filter hoặc status filter chỉ vì phỏng đoán nghiệp vụ; chỉ sửa khi error cho thấy filter đó sai về mặt schema hoặc cú pháp.

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
