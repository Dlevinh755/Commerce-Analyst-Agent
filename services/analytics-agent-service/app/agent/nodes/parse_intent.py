from __future__ import annotations

from langgraph.config import get_stream_writer

from app.agent.state import AgentState, ParsedIntent
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
    history_text = "\n".join(
        f"{m.role}: {m.content}" for m in state.chat_history[-8:]
    )

    memory = state.memory.model_dump()
    return f"""
Bạn là bộ phân tích intent cho AI Data Query Agent.

Mục tiêu:
- Hiểu câu hỏi hiện tại.
- Nếu câu hiện tại là follow-up, phải kế thừa context phân tích từ previous memory.
- Không làm mất context cũ trừ khi user nói rõ muốn thay đổi.
- Chỉ trả về JSON đúng schema.

Nguyên tắc merge context:
1. Nếu user hỏi ngắn như "theo seller", "top 5", "so với tháng trước", "chỉ lấy delivered",
   => coi là follow-up.
2. Follow-up phải kế thừa metric/time_range/time_grain/filters/source_hint từ previous memory nếu user không ghi đè.
3. Nếu user nêu metric mới rõ ràng, dùng metric mới.
4. Nếu user nêu dimension mới, thay hoặc bổ sung dimension tùy ngữ nghĩa câu hỏi.
5. Nếu user nói "so với tháng trước", giữ metric và dimension hiện tại, chỉ thêm compare_to.
6. Nếu user nói "top 10 thôi", giữ intent cũ và thêm ranking.
7. Nếu user hỏi đầy đủ độc lập, đặt is_followup = false.

Các metric hợp lệ:
- revenue
- orders
- items_sold
- avg_order_value
- cart_quantity

Một số source_hint hợp lệ:
- fact_sales
- fact_cart
- fact_reviews

Previous structured memory:
{memory}

Recent chat history:
{history_text}

Current user question:
{state.question}
""".strip()


def _intent_payload(parsed: ParsedIntent) -> dict:
    return {
        "metric": parsed.metric,
        "dimensions": parsed.dimensions,
        "time_range": parsed.time_range,
        "time_grain": parsed.time_grain,
        "filters": parsed.filters,
        "is_followup": parsed.is_followup,
        "source_hint": parsed.source_hint,
        "compare_to": parsed.compare_to,
        "limit": parsed.limit,
    }


def parse_intent_node(state: AgentState) -> dict:
    logger.debug("Parsing intent | session_id=%s | question=%s", state.session_id, state.question[:100])
    writer = _safe_stream_writer()
    writer({
        "type": "step_start",
        "step": "parse_intent",
        "message": "Đang phân tích ý định câu hỏi",
    })
    try:
        client = GeminiClient()
        model = ModelRouter.for_parse_intent()
        parsed = client.generate_structured(
            model=model,
            prompt=_build_prompt(state),
            schema=ParsedIntent,
        )
        logger.debug(
            "Intent parsed | session_id=%s | metric=%s | is_followup=%s",
            state.session_id,
            parsed.metric,
            parsed.is_followup,
        )
        writer({
            "type": "step_end",
            "step": "parse_intent",
            "message": "Đã hoàn thành parse_intent",
            "payload": _intent_payload(parsed),
        })
        return {"parsed_intent": parsed}
    except Exception as exc:
        logger.error(
            "Intent parsing failed | session_id=%s | error=%s",
            state.session_id,
            str(exc),
            exc_info=True,
        )
        writer({
            "type": "step_error",
            "step": "parse_intent",
            "message": "Lỗi khi phân tích ý định câu hỏi",
            "payload": {"error": str(exc)},
        })
        raise
