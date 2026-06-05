from __future__ import annotations

import json

from langgraph.config import get_stream_writer

from app.agent.state import AgentState, AnalysisPlan
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


def _format_business_metrics(catalog: dict) -> str:
    metrics = catalog.get("business_metrics", [])
    if not metrics:
        return "- Không có business metric nào được định nghĩa trong catalog."

    lines: list[str] = []
    for metric in metrics:
        default_filter = metric.get("default_filter")
        filter_text = f", default_filter={default_filter}" if default_filter else ""
        description = metric.get("description")
        description_text = f", description={description}" if description else ""
        lines.append(
            f"- {metric['name']}: formula={metric['formula']}, "
            f"source_table={metric['source_table']}{filter_text}{description_text}"
        )
    return "\n".join(lines)


def _format_join_rules(relevant_schema: dict[str, dict]) -> str:
    lines: list[str] = []
    for table_name, table in relevant_schema.items():
        for foreign_key in table.get("foreign_keys", []):
            lines.append(f"- {table_name}.{foreign_key}")
    return "\n".join(lines) if lines else "- Không có join rule rõ ràng trong relevant_schema."


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


def _with_direction(expression: str, direction: str) -> str:
    expr = expression.strip()
    upper_expr = expr.upper()
    if upper_expr.endswith(" ASC") or upper_expr.endswith(" DESC"):
        return expr
    return f"{expr} {direction}"


def _looks_like_time_expression(expression: str) -> bool:
    normalized = expression.strip().lower()
    time_hints = (
        "date(",
        "date_trunc(",
        "year(",
        "month(",
        "quarter(",
        "week",
        "day",
        "date",
        "time",
        "timestamp",
        "order_date",
        "added_at",
        "snapshot_date",
    )
    return any(hint in normalized for hint in time_hints)


def _normalize_plan_ordering(state: AgentState, plan: AnalysisPlan) -> AnalysisPlan:
    if plan.order_by:
        return plan

    parsed_intent = state.parsed_intent
    if parsed_intent is None:
        return plan

    metric_aliases = [metric.alias or metric.name for metric in plan.metrics if metric.alias or metric.name]
    time_group_by = [expr for expr in plan.group_by if _looks_like_time_expression(expr)]
    metric_sort_direction = "DESC"
    if parsed_intent.ranking_type == "bottom" or (parsed_intent.sort_order or "").lower() == "asc":
        metric_sort_direction = "ASC"

    order_by: list[str] = []

    if parsed_intent.sort_by:
        requested_sort = parsed_intent.sort_by
        matched_metric_alias = next(
            (alias for alias in metric_aliases if alias.lower() == requested_sort.lower()),
            None,
        )
        direction = "ASC" if (parsed_intent.sort_order or "").lower() == "asc" else "DESC"
        order_by = [_with_direction(matched_metric_alias or requested_sort, direction)]
    elif time_group_by and parsed_intent.ranking_type not in {"top", "bottom"}:
        order_by = [_with_direction(expr, "ASC") for expr in time_group_by]
        remaining_group_by = [expr for expr in plan.group_by if expr not in time_group_by]
        order_by.extend(_with_direction(expr, "ASC") for expr in remaining_group_by)
        if metric_aliases:
            order_by.append(_with_direction(metric_aliases[0], "DESC"))
    elif metric_aliases:
        order_by = [_with_direction(metric_aliases[0], metric_sort_direction)]
    elif plan.group_by:
        order_by = [_with_direction(expr, "ASC") for expr in plan.group_by]
    elif plan.dimensions:
        order_by = [_with_direction(dimension, "ASC") for dimension in plan.dimensions]

    if not order_by:
        return plan

    return plan.model_copy(update={"order_by": order_by})


def _build_prompt(state: AgentState) -> str:
    if state.parsed_intent is None:
        raise ValueError("parsed_intent is required")
    if not state.relevant_schema:
        raise ValueError("relevant_schema is required")

    catalog = load_catalog()
    memory_json = (
        state.memory.model_dump_json(indent=2)
        if hasattr(state, "memory") and state.memory is not None
        else "{}"
    )
    business_metrics_text = _format_business_metrics(catalog)
    join_rules_text = _format_join_rules(state.relevant_schema)
    query_rules_text = _format_query_rules(catalog)
    date_rules_text = _format_date_handling(catalog, state.relevant_schema)

    return f"""
Bạn là chuyên gia lập kế hoạch phân tích dữ liệu cho AI Data Query Agent.

Mục tiêu:
- Tạo AnalysisPlan cuối cùng từ question, parsed_intent, previous memory và relevant_schema.
- KHÔNG viết SQL hoàn chỉnh ở bước này.
- Chỉ dùng bảng, cột, metric và join có thể suy ra từ relevant_schema.
- Không được bịa thêm bảng, cột, metric hoặc business rule ngoài dữ liệu đã cho.

Nguyên tắc chung:
- Nếu parsed_intent.is_followup = true, phải kế thừa ngữ cảnh từ previous memory cho các phần user không ghi đè.
- Nếu user chỉ nói ngắn như "top 5", "theo seller", "so với tháng trước", giữ metric, time_range, time_grain, filters và source cũ nếu không có chỉ dẫn mới.
- Nếu user hỏi độc lập và đầy đủ, ưu tiên parsed_intent hiện tại hơn memory cũ.
- Nếu user không nói điều kiện thời gian, hiểu là toàn bộ dữ liệu; không cần thêm filter thời gian giả định.
- Chỉ lập kế hoạch. Không giải thích dài dòng. Không trả prose ngoài JSON.

Business metrics từ catalog.yaml:
{business_metrics_text}

Quy tắc dùng metric từ catalog:
- Nếu parsed_intent.metric khớp một metric trong catalog, phải dùng đúng source_table, formula và default_filter của metric đó để xây plan.
- Nếu metric có default_filter trong catalog, áp dụng default_filter khi user không ghi đè bằng status/filter khác.
- Nếu user nói rõ "tất cả", "all", hoặc nêu status khác với default_filter, ưu tiên yêu cầu của user thay vì default_filter.
- Không tự tạo metric name, formula hoặc default_filter mới ngoài catalog.

Join rules:
- Chỉ dùng các join suy ra từ relevant_schema và foreign key metadata sau:
{join_rules_text}
- Chỉ thêm join khi cần cột từ bảng đó.

Query rules từ catalog.yaml:
{query_rules_text}

Date handling từ catalog.yaml cho các bảng liên quan:
{date_rules_text}

Quy tắc thời gian:
- Nếu catalog có date_handling cho fact table đang dùng, phải bám theo các expression trong catalog thay vì tự suy diễn.
- Không được giả định cột BIGINT epoch là DATE/TIMESTAMP trực tiếp nếu catalog nói phải convert.

Ranking rules:
- Nếu user hỏi top/bottom N, thêm order_by và limit tương ứng.
- Nếu user nói "top 5 thôi" hoặc tương tự, kế thừa metric/dimension cũ rồi set limit phù hợp.
- Nếu group theo trục thời gian như ngày/tháng/năm và user không yêu cầu sort khác, mặc định order_by phải theo thời gian tăng dần.
- Nếu đang so sánh metric theo dimension không phải thời gian và user không yêu cầu sort khác, mặc định order_by nên là metric chính giảm dần để dễ đọc.

Comparison rules:
- Nếu user hỏi "so với tháng trước", bật comparison.enabled = true và compare_to = "last_month".
- Nếu parsed_intent.needs_comparison = true, phản ánh điều đó vào comparison.
- Nếu không có nhu cầu so sánh, để comparison = null hoặc enabled = false.

Hướng dẫn điền output AnalysisPlan:
- goal: mô tả ngắn gọn mục tiêu phân tích.
- fact_table: 1 bảng fact chính.
- joins: danh sách join cần thiết, mỗi join gồm table, join_type, on.
- dimensions: các chiều cần hiển thị hoặc group.
- metrics: danh sách metric cần tính, mỗi metric gồm name, expression, alias. Nếu metric đến từ catalog thì name phải đúng với metric name trong catalog và expression phải bám công thức catalog.
- filters: chỉ chứa các điều kiện lọc logic của bài toán.
- group_by: chỉ gồm các expression cần group.
- order_by: chỉ gồm các expression sắp xếp cần thiết.
- limit: số dòng cần giới hạn nếu có.
- comparison: chỉ điền khi thật sự cần so sánh.
- notes: ghi các giả định quan trọng hoặc cảnh báo nghiệp vụ nếu cần; nếu không cần thì để [].

Kiểm tra trước khi trả về:
- Mọi bảng/cột trong plan phải tồn tại trong relevant_schema.
- fact_table phải phù hợp với metric chính.
- Không tạo join thừa.
- Nếu parsed_intent.metric có trong catalog, plan phải nhất quán với source_table và default_filter của metric đó trừ khi user đã ghi đè rõ ràng.
- filters không được mâu thuẫn với parsed_intent hoặc memory.
- Nếu là follow-up, không làm rơi metric/dimension/time/filter cũ trừ khi user ghi đè rõ ràng.
- Nếu order_by chưa được user chỉ rõ:
  - biểu đồ chuỗi thời gian phải sort theo thời gian tăng dần;
  - bảng xếp hạng theo metric phải sort theo metric chính, mặc định là giảm dần.

Previous memory:
{memory_json}

Question:
{state.question}

Parsed intent:
{state.parsed_intent.model_dump_json(indent=2)}

Relevant schema:
{json.dumps(state.relevant_schema, ensure_ascii=False, indent=2)}

Trả về đúng JSON theo schema AnalysisPlan.
""".strip()

def _plan_preview(plan: AnalysisPlan) -> dict:
    return {
        "goal": plan.goal,
        "fact_table": plan.fact_table,
        "joins": [j.model_dump() for j in plan.joins],
        "dimensions": plan.dimensions,
        "metrics": [m.model_dump() for m in plan.metrics],
        "filters": plan.filters,
        "group_by": plan.group_by,
        "order_by": plan.order_by,
        "limit": plan.limit,
        "comparison": plan.comparison.model_dump() if plan.comparison else None,
    }

def build_analysis_plan_node(state: AgentState) -> dict:
    if state.parsed_intent is None:
        raise ValueError("parsed_intent is required")
    if not state.relevant_schema:
        raise ValueError("relevant_schema is required")

    writer = _safe_stream_writer()
    writer({
        "type": "step_start",
        "step": "build_analysis_plan",
        "message": "Đang lập kế hoạch phân tích",
    })
    try:
        logger.debug(
            "Building analysis plan | session_id=%s | question=%s",
            state.session_id,
            state.question,
        )

        client = GeminiClient()
        plan = client.generate_structured(
            model=ModelRouter.for_build_analysis_plan(),
            prompt=_build_prompt(state),
            schema=AnalysisPlan,
        )
        plan = _normalize_plan_ordering(state, plan)


        logger.info(
            "Analysis plan built | session_id=%s | fact_table=%s | metrics=%s | dimensions=%s",
            state.session_id,
            plan.fact_table,
            ",".join([m.name for m in plan.metrics]),
            ",".join(plan.dimensions),
        )

        writer({
            "type": "step_end",
            "step": "build_analysis_plan",
            "message": "Đã lập kế hoạch phân tích",
            "payload": _plan_preview(plan),
        })

        return {"analysis_plan": plan}

    except Exception as e:
        logger.error(
            "Build analysis plan failed | session_id=%s | error=%s",
            state.session_id,
            str(e),
            exc_info=True,
        )

        writer({
            "type": "step_error",
            "step": "build_analysis_plan",
            "message": "Lỗi khi lập kế hoạch phân tích",
            "payload": {"error": str(e)},
        })

        raise
