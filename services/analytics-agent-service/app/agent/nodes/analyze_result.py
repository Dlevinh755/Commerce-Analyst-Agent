from __future__ import annotations

import json
from langgraph.config import get_stream_writer

from app.agent.state import AgentState
from app.llm.gemini_client import GeminiClient
from app.llm.model_router import ModelRouter


def _safe_stream_writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _json_default_serializer(value):
    if hasattr(value, "isoformat") and callable(value.isoformat):
        return value.isoformat()
    return str(value)


def _build_prompt(state: AgentState) -> str:
    preview = state.query_result.model_dump() if state.query_result else {}
    return f"""
Bạn là AI data analyst.

Nhiệm vụ:
- Trả lời ngắn gọn, rõ ràng bằng tiếng Việt.
- Dựa trên câu hỏi người dùng, SQL đã chạy và preview kết quả.
- Nếu dữ liệu ít hoặc rỗng thì nói rõ.
- Không bịa thêm dữ liệu không có trong preview.
- Nếu nhìn thấy xu hướng rõ ràng, có thể nêu 2-4 insight ngắn.
- Preview kết quả chỉ là dữ liệu mẫu agent đang gửi vào prompt; không được khẳng định các kết luận vượt quá những gì preview thể hiện.
- Nếu row_count lớn hơn số rows trong preview, nói theo hướng thận trọng và tránh khẳng định toàn bộ phân phối dữ liệu.
- Có thể gợi ý 1 follow-up phù hợp ở cuối, nhưng không bắt buộc.

User question:
{state.question}

Parsed intent:
{state.parsed_intent.model_dump_json(indent=2)}

Executed SQL:
{state.validated_sql}

Query result preview:
{json.dumps(preview, ensure_ascii=False, indent=2, default=_json_default_serializer)}
""".strip()


def analyze_result_node(state: AgentState) -> dict:
    writer = _safe_stream_writer()
    writer({
        "type": "step_start",
        "step": "analyze_result",
        "message": "Đang phân tích kết quả truy vấn",
    })

    if state.execution_error:
        final_answer = (
            "Mình chưa thể chạy truy vấn này thành công sau khi đã thử sửa SQL. "
            f"Lỗi cuối cùng là: {state.execution_error}"
        )
        writer({
            "type": "step_end",
            "step": "analyze_result",
            "message": "Đã hoàn thành analyze_result",
            "payload": {"summary_preview": final_answer[:240]},
        })
        return {"final_answer": final_answer}

    if state.query_result is None:
        writer({
            "type": "step_error",
            "step": "analyze_result",
            "message": "Lỗi khi phân tích kết quả truy vấn",
            "payload": {"error": "query_result is required"},
        })
        raise ValueError("query_result is required")

    try:
        client = GeminiClient()
        model = ModelRouter.for_analyze()
        answer = client.generate_text(
            model=model,
            prompt=_build_prompt(state),
        )
        writer({
            "type": "step_end",
            "step": "analyze_result",
            "message": "Đã hoàn thành analyze_result",
            "payload": {"summary_preview": answer[:240]},
        })
        return {"final_answer": answer}
    except Exception as exc:
        writer({
            "type": "step_error",
            "step": "analyze_result",
            "message": "Lỗi khi phân tích kết quả truy vấn",
            "payload": {"error": str(exc)},
        })
        raise
