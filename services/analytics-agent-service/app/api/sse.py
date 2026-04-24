from __future__ import annotations

import json
from typing import Any


def sse_event(event: str, data: Any, event_id: str | None = None) -> str:
    payload = json.dumps(data, ensure_ascii=False, default=str)

    lines: list[str] = []
    if event_id is not None:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    for line in payload.splitlines():
        lines.append(f"data: {line}")
    lines.append("")  # end of event
    return "\n".join(lines) + "\n"


def event_name_for_payload(payload: dict[str, Any]) -> str:
    if payload.get("type") == "step_error":
        return "error"
    return "progress"
