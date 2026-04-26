from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from app.agent.graph import build_graph
from app.common.logging import get_logger

logger = get_logger(__name__)

graph = build_graph()


def _to_jsonable(value: Any) -> Any:
    if hasattr(value, "model_dump") and callable(value.model_dump):
        return value.model_dump()
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    return value


def _short_repr(value: Any, limit: int = 500) -> str:
    text = repr(value)
    if len(text) > limit:
        return text[:limit] + "...<truncated>"
    return text


async def run_agent(session_id: str, question: str) -> dict[str, Any]:
    logger.info("Starting agent execution | session_id=%s | question=%s", session_id, question[:100])
    try:
        config = {"configurable": {"thread_id": session_id}}
        state_input = {
            "session_id": session_id,
            "question": question,
        }
        result = await graph.ainvoke(state_input, config=config)
        logger.info("Agent execution completed | session_id=%s | status=success", session_id)
        return result
    except Exception as exc:
        logger.error(
            "Agent execution failed | session_id=%s | error=%s",
            session_id,
            str(exc),
            exc_info=True,
        )
        raise


async def stream_agent(session_id: str, question: str) -> AsyncGenerator[dict[str, Any], None]:
    logger.info("Starting agent stream | session_id=%s | question=%s", session_id, question[:100])
    config = {"configurable": {"thread_id": session_id}}
    state_input = {
        "session_id": session_id,
        "question": question,
    }

    try:
        async for chunk in graph.astream(
            state_input,
            config=config,
            stream_mode=["custom", "updates"],
        ):
            logger.info(
                "Agent stream chunk received | session_id=%s | chunk_type=%s | chunk=%s",
                session_id,
                type(chunk).__name__,
                _short_repr(chunk),
            )
            mode = "custom"
            payload: Any = chunk
            if isinstance(chunk, tuple) and len(chunk) == 2:
                mode, payload = chunk
                logger.info(
                    "Agent stream tuple chunk | session_id=%s | mode=%s | payload_type=%s | payload=%s",
                    session_id,
                    mode,
                    type(payload).__name__,
                    _short_repr(payload),
                )

            if mode == "custom":
                if isinstance(payload, dict):
                    logger.info(
                        "Agent stream payload dict | session_id=%s | type=%s | step=%s | message=%s",
                        session_id,
                        payload.get("type"),
                        payload.get("step"),
                        payload.get("message"),
                    )
                    yield _to_jsonable(payload)
                else:
                    logger.info(
                        "Agent stream payload non-dict | session_id=%s | payload_type=%s | payload=%s",
                        session_id,
                        type(payload).__name__,
                        _short_repr(payload),
                    )
                    yield {
                        "type": "progress",
                        "message": str(payload),
                    }
                continue

            if mode == "updates" and isinstance(payload, dict):
                for step, step_payload in payload.items():
                    if step in {"__interrupt__", "__metadata__"}:
                        continue
                    logger.info(
                        "Agent stream updates payload | session_id=%s | step=%s | payload=%s",
                        session_id,
                        step,
                        _short_repr(step_payload),
                    )
                    yield {
                        "type": "step_end",
                        "step": step,
                        "message": f"Đã hoàn thành {step}",
                        "payload": _to_jsonable(step_payload),
                    }
    except Exception as exc:
        logger.error(
            "Agent stream failed | session_id=%s | error=%s",
            session_id,
            str(exc),
            exc_info=True,
        )
        raise


async def get_state(session_id: str):
    config = {"configurable": {"thread_id": session_id}}
    return await graph.aget_state(config)
