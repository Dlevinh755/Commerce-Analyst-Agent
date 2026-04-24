from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from app.agent.service import get_state, run_agent, stream_agent
from app.common.logging import get_logger
from app.api.sse import event_name_for_payload

logger = get_logger(__name__)


def _to_jsonable(value: Any) -> Any:
    if hasattr(value, "model_dump") and callable(value.model_dump):
        return value.model_dump()
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    return value


def _normalize_progress_event(event: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        "type": event.get("type", "progress"),
        "step": event.get("step"),
        "message": event.get("message") or str(event),
    }
    if "payload" in event and event.get("payload") is not None:
        normalized["payload"] = _to_jsonable(event["payload"])
    return normalized


def _build_completed_payload(session_id: str, question: str, values: dict[str, Any]) -> dict[str, Any]:
    return {
        "session_id": session_id,
        "question": question,
        "validated_sql": values.get("validated_sql"),
        "final_answer": values.get("final_answer"),
        "query_result": _to_jsonable(values.get("query_result")),
        "error": values.get("error"),
    }


async def run_query(session_id: str, question: str) -> dict[str, Any]:
    logger.info("API request: run_query | session_id=%s", session_id)
    try:
        result = await run_agent(session_id=session_id, question=question)
        logger.info("API response: run_query success | session_id=%s", session_id)
        return result
    except Exception as exc:
        logger.error("API error: run_query | session_id=%s | error=%s", session_id, str(exc))
        raise


async def stream_query(session_id: str, question: str) -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
    logger.info("API request: stream_query | session_id=%s", session_id)
    yield (
        "started",
        {
            "session_id": session_id,
            "question": question,
            "message": "Bắt đầu xử lý",
        },
    )

    try:
        async for event in stream_agent(session_id=session_id, question=question):
            normalized = _normalize_progress_event(event)
            yield (event_name_for_payload(normalized), normalized)

        values = await get_query_state_values(session_id)
        yield ("completed", _build_completed_payload(session_id, question, values))
    except Exception as exc:
        logger.error("API error: stream_query | session_id=%s | error=%s", session_id, str(exc))
        yield (
            "error",
            {
                "type": "step_error",
                "step": None,
                "message": "Lỗi trong quá trình stream agent",
                "payload": {"error": str(exc)},
            },
        )


async def get_query_state_values(session_id: str) -> dict[str, Any]:
    state = await get_state(session_id=session_id)
    return _to_jsonable(state.values if state else {})
