from __future__ import annotations

import json

from langgraph.config import get_stream_writer

from app.agent.state import AgentState, SqlDraft
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
    if not state.relevant_schema:
        raise ValueError("relevant_schema is required")

    catalog = load_catalog()
    query_rules_text = _format_query_rules(catalog)
    date_rules_text = _format_date_handling(catalog, state.relevant_schema)

    return f"""
Bạn là chuyên gia viết Databricks SQL.

Nhiệm vụ:
- Chỉ dịch AnalysisPlan thành 1 câu Databricks SQL.
- KHÔNG tự thay đổi metric, fact_table, join, filter ngoài AnalysisPlan.
- Chỉ dùng bảng/cột có trong relevant_schema.
- Chỉ viết SELECT hoặc WITH ... SELECT.
- Không dùng INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, MERGE.
- Phải bám sát metrics, joins, filters, group_by, order_by và limit có trong AnalysisPlan.
- Trả về JSON đúng schema SqlDraft.

Query rules từ catalog.yaml:
{query_rules_text}

Date handling từ catalog.yaml cho các bảng liên quan:
{date_rules_text}

SQL generation rules:
- Ưu tiên dùng expression đã có sẵn trong AnalysisPlan.metrics, AnalysisPlan.group_by, AnalysisPlan.order_by và AnalysisPlan.filters thay vì tự phát minh expression mới.
- Nếu catalog có date_handling cho fact table đang dùng, phải bám theo expression trong catalog.
- Không được dùng DATE/YEAR/DATE_TRUNC trực tiếp lên cột BIGINT epoch nếu catalog yêu cầu convert trước.
- Không được dùng CAST(col AS DATE) hoặc CAST(col AS TIMESTAMP) trực tiếp cho cột BIGINT epoch nếu catalog không cho phép.
- Nếu plan.limit có giá trị thì phải áp dụng LIMIT đúng bằng giá trị đó.
- Nếu query không aggregate và plan.limit là null, áp dụng LIMIT theo query_rules.always_limit_non_aggregate nếu có.
- Alias cột nên rõ ràng, dễ đọc và khớp semantics của AnalysisPlan.

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
