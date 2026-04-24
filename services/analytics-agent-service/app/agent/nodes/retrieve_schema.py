from __future__ import annotations

from langgraph.config import get_stream_writer

from app.agent.schema_index import SchemaIndex
from app.agent.state import AgentState


def _safe_stream_writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def retrieve_schema_node(state: AgentState) -> dict:
    if state.parsed_intent is None:
        raise ValueError("parsed_intent is required before retrieve_schema")

    writer = _safe_stream_writer()
    writer({
        "type": "step_start",
        "step": "retrieve_schema",
        "message": "Đang chọn schema liên quan",
    })

    try:
        index = SchemaIndex()
        selected = index.retrieve_for_intent(
            metric=state.parsed_intent.metric,
            dimensions=state.parsed_intent.dimensions,
            source_hint=state.parsed_intent.source_hint,
        )
        writer({
            "type": "step_end",
            "step": "retrieve_schema",
            "message": "Đã hoàn thành retrieve_schema",
            "payload": {"tables": list(selected.keys())},
        })
        return {"relevant_schema": selected}
    except Exception as exc:
        writer({
            "type": "step_error",
            "step": "retrieve_schema",
            "message": "Lỗi khi chọn schema liên quan",
            "payload": {"error": str(exc)},
        })
        raise
