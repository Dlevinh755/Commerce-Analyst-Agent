from __future__ import annotations

import asyncio

from app.api import service


def test_stream_query_completed_payload_contains_visualization(monkeypatch):
    async def fake_stream_agent(*, session_id: str, question: str):
        if False:
            yield  # pragma: no cover
        return

    async def fake_get_query_state_values(session_id: str):
        return {
            "validated_sql": "select * from fact_sales",
            "final_answer": "Done",
            "query_result": {"columns": ["month", "revenue"], "rows": [], "row_count": 0},
            "visualization": {
                "kind": "line",
                "title": "Doanh thu theo thang",
                "description": "Auto",
                "x_key": "month",
                "series": [{"key": "revenue", "label": "Revenue"}],
                "dataset": [{"month": "2026-01-01", "revenue": 1200.0}],
                "x_label": "Month",
                "y_label": "Revenue",
                "truncated": False,
                "reason": None,
            },
            "error": None,
        }

    monkeypatch.setattr(service, "_stream_agent", fake_stream_agent)
    monkeypatch.setattr(service, "get_query_state_values", fake_get_query_state_values)

    async def collect_events():
        events = []
        async for event_name, payload in service.stream_query(
            session_id="session-1",
            question="Doanh thu theo thang",
        ):
            events.append((event_name, payload))
        return events

    events = asyncio.run(collect_events())

    assert events[-1][0] == "completed"
    assert events[-1][1]["visualization"]["kind"] == "line"
