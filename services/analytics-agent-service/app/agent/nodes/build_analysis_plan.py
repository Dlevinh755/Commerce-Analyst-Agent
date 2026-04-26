from __future__ import annotations

import json
from langgraph.config import get_stream_writer
from app.agent.state import AgentState, AnalysisPlan
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
    if state.parsed_intent is None:
        raise ValueError("parsed_intent is required")
    if not state.relevant_schema:
        raise ValueError("relevant_schema is required")
    memory_json = (
        state.memory.model_dump_json(indent=2)
        if hasattr(state, "memory") and state.memory is not None
        else "{}"
    )

    return f"""
Bạn là chuyên gia lập kế hoạch phân tích dữ liệu cho AI Data Query Agent.

Nhiệm vụ:
- Tạo AnalysisPlan cuối cùng từ question, parsed_intent, previous memory và relevant_schema.
- KHÔNG viết SQL ở bước này.
- Chỉ dùng bảng/cột có trong relevant_schema.
- Nếu câu hỏi là follow-up, phải kế thừa ngữ cảnh từ previous memory.
- Nếu user chỉ nói "top 5", "theo seller", "so với tháng trước", phải giữ metric/time_range/filter cũ nếu không bị ghi đè.

Business metrics:
- revenue = SUM(line_total), source fact_sales
- orders = COUNT(DISTINCT order_id), source fact_sales
- items_sold = SUM(quantity), source fact_sales
- avg_order_value = SUM(line_total) / COUNT(DISTINCT order_id), source fact_sales
- cart_quantity = SUM(quantity), source fact_cart

Join rules:
- fact_sales.book_id = dim_books.book_id
- fact_sales.seller_id = dim_users.user_id
- fact_sales.buyer_id = dim_users.user_id
- fact_cart.book_id = dim_books.book_id
- fact_cart.buyer_id = dim_users.user_id

Date rules for Databricks:
- Dùng order_date cho fact_sales.
- Dùng added_at cho fact_cart.
- Dùng snapshot_date cho fact_reviews.
- Nếu cột thời gian đang là BIGINT/epoch thì phải hiểu đó là epoch time, không dùng trực tiếp như TIMESTAMP.
- Khi cần convert BIGINT epoch sang TIMESTAMP, dùng:
  CAST(FROM_UNIXTIME(CASE WHEN ABS(CAST(col AS BIGINT)) >= 1000000000000 THEN CAST(CAST(col AS BIGINT) / 1000 AS BIGINT) ELSE CAST(col AS BIGINT) END) AS TIMESTAMP)
- Nếu group theo ngày: DATE(order_date)
- Nếu group theo tháng: DATE_TRUNC('month', order_date)
- Nếu group theo năm: YEAR(order_date)

Status rules:
- Nếu tính doanh thu mặc định, dùng filter: order_overall_status = 'delivered'.
- Nếu user hỏi tất cả đơn hàng, không tự thêm delivered filter.
- Nếu user hỏi đơn hàng tồn tại / tổng số đơn hàng, metric là orders.

Ranking rules:
- Nếu top/bottom N, thêm order_by và limit.
- Nếu user nói "top 5 thôi", kế thừa metric/dimension cũ và set limit = 5.

Comparison rules:
- Nếu user hỏi "so với tháng trước", bật comparison.enabled = true, compare_to = "last_month".
- Nếu chưa cần comparison, để enabled=false hoặc null.

Status rules:
- Chỉ thêm filter order_overall_status = 'delivered' khi user hỏi doanh thu, doanh số hoàn tất, delivered, đã hoàn tất.
- Nếu user hỏi số lượng đơn hàng, tổng đơn hàng, đơn hàng qua năm/tháng/ngày thì KHÔNG tự thêm delivered filter.

Date rules:
- order_date trong fact_sales là timestamp.
- KHÔNG dùng FROM_UNIXTIME(order_date).
- Dùng YEAR(order_date) để group theo năm.
- Dùng DATE(order_date) để group theo ngày.
- Dùng DATE_TRUNC('month', order_date) để group theo tháng.

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
