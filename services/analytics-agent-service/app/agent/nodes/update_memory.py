from __future__ import annotations

from langgraph.config import get_stream_writer

from app.agent.state import AgentState, ChatTurn, ConversationMemory


def _safe_stream_writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def update_memory_node(state: AgentState) -> dict:
    writer = _safe_stream_writer()
    writer({
        "type": "step_start",
        "step": "update_memory",
        "message": "Đang cập nhật memory hội thoại",
    })

    try:
        memory: ConversationMemory = state.memory

        new_history = list(state.chat_history)
        new_history.append(ChatTurn(role="user", content=state.question))
        if state.final_answer:
            new_history.append(ChatTurn(role="assistant", content=state.final_answer))
        new_history = new_history[-10:]

        if state.parsed_intent is not None:
            intent = state.parsed_intent
            memory.last_metric = intent.metric
            memory.last_dimensions = list(intent.dimensions)
            memory.last_time_range = intent.time_range
            memory.last_time_grain = intent.time_grain
            memory.last_filters = list(intent.filters)
            memory.last_compare_to = intent.compare_to
            memory.last_source_hint = intent.source_hint

        memory.last_user_questions = (memory.last_user_questions + [state.question])[-5:]
        memory.last_relevant_tables = list(state.relevant_schema.keys())[-10:]
        memory.last_sql = state.validated_sql

        if state.final_answer:
            memory.last_analysis_summary = state.final_answer[:1200]

        writer({
            "type": "step_end",
            "step": "update_memory",
            "message": "Đã hoàn thành update_memory",
            "payload": {
                "last_metric": memory.last_metric,
                "last_dimensions": memory.last_dimensions,
                "last_time_range": memory.last_time_range,
                "last_relevant_tables": memory.last_relevant_tables,
            },
        })
        return {
            "memory": memory,
            "chat_history": new_history,
        }
    except Exception as exc:
        writer({
            "type": "step_error",
            "step": "update_memory",
            "message": "Lỗi khi cập nhật memory",
            "payload": {"error": str(exc)},
        })
        raise
