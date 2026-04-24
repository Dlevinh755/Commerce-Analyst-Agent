from __future__ import annotations

from collections.abc import AsyncIterable
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse

from app.api.schemas import QueryRequest, QueryResponse
from app.api.service import get_query_state_values, run_query, stream_query
from app.api.sse import sse_event

router = APIRouter(prefix="/api", tags=["query"])


SSE_TEST_PAGE = """<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SSE Test</title>
  <style>
    :root {
      --bg: #f4efe7;
      --panel: #fffdf8;
      --border: #d9cdbd;
      --text: #1f1a14;
      --muted: #6a5f55;
      --accent: #1e6f5c;
      --accent-2: #c84b31;
      --code: #f7f1e8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: linear-gradient(180deg, #f4efe7 0%, #efe4d3 100%);
      color: var(--text);
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }
    .hero {
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 32px;
    }
    .sub {
      color: var(--muted);
      margin: 0;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 10px 30px rgba(73, 54, 33, 0.08);
    }
    .grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 20px;
      align-items: start;
    }
    label {
      display: block;
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
    }
    input, textarea {
      width: 100%;
      border: 1px solid var(--border);
      background: white;
      color: var(--text);
      border-radius: 12px;
      padding: 12px 14px;
      font: inherit;
    }
    textarea {
      min-height: 120px;
      resize: vertical;
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 14px;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 16px;
      font: inherit;
      cursor: pointer;
      color: white;
      background: var(--accent);
    }
    button.secondary {
      background: #7b8b8e;
    }
    .status {
      margin-top: 14px;
      color: var(--muted);
      font-size: 14px;
    }
    .event-list {
      display: grid;
      gap: 12px;
    }
    .event {
      border: 1px solid var(--border);
      border-left: 6px solid var(--accent);
      border-radius: 14px;
      background: white;
      overflow: hidden;
    }
    .event.error { border-left-color: #b42318; }
    .event.completed { border-left-color: #7c3aed; }
    .event.started { border-left-color: var(--accent-2); }
    .event-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      background: #fbf7f1;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    .event-name {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
      font-size: 12px;
    }
    .event-step {
      color: var(--muted);
    }
    pre {
      margin: 0;
      padding: 14px;
      overflow: auto;
      background: var(--code);
      font-size: 13px;
      line-height: 1.5;
    }
    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>SSE Stream Tester</h1>
      <p class="sub">Trang này mở trực tiếp SSE endpoint và hiển thị tuần tự started, progress, error, completed.</p>
    </div>

    <div class="grid">
      <div class="panel">
        <label for="sessionId">Session ID</label>
        <input id="sessionId" value="test-ui-001" />

        <label for="question" style="margin-top:14px;">Câu hỏi</label>
        <textarea id="question">Có bao nhiêu đơn hàng tồn tại</textarea>

        <div class="actions">
          <button id="startBtn" type="button">Bắt đầu stream</button>
          <button id="stopBtn" type="button" class="secondary">Dừng</button>
        </div>

        <div class="status" id="status">Chưa kết nối.</div>
      </div>

      <div class="panel">
        <div class="event-list" id="events"></div>
      </div>
    </div>
  </div>

  <script>
    let source = null;

    const statusEl = document.getElementById("status");
    const eventsEl = document.getElementById("events");
    const sessionIdEl = document.getElementById("sessionId");
    const questionEl = document.getElementById("question");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");

    function setStatus(text) {
      statusEl.textContent = text;
    }

    function clearEvents() {
      eventsEl.innerHTML = "";
    }

    function addEvent(name, payload) {
      const card = document.createElement("div");
      card.className = `event ${name}`;

      const step = payload && payload.step ? payload.step : "-";
      const head = document.createElement("div");
      head.className = "event-head";
      head.innerHTML = `
        <div>
          <div class="event-name">${name}</div>
          <div class="event-step">${step}</div>
        </div>
        <div>${new Date().toLocaleTimeString()}</div>
      `;

      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(payload, null, 2);

      card.appendChild(head);
      card.appendChild(pre);
      eventsEl.prepend(card);
    }

    function stopStream() {
      if (source) {
        source.close();
        source = null;
        setStatus("Đã ngắt kết nối.");
      }
    }

    function startStream() {
      stopStream();
      clearEvents();

      const sessionId = encodeURIComponent(sessionIdEl.value.trim() || "test-ui-001");
      const question = encodeURIComponent(questionEl.value.trim() || "Có bao nhiêu đơn hàng tồn tại");
      const url = `/api/query/stream?session_id=${sessionId}&question=${question}`;

      setStatus("Đang kết nối SSE...");
      source = new EventSource(url);

      source.addEventListener("started", (event) => {
        const payload = JSON.parse(event.data);
        addEvent("started", payload);
        setStatus("Đã nhận started.");
      });

      source.addEventListener("progress", (event) => {
        const payload = JSON.parse(event.data);
        addEvent("progress", payload);
        setStatus(`Đang chạy: ${payload.step || payload.message || "progress"}`);
      });

      source.addEventListener("completed", (event) => {
        const payload = JSON.parse(event.data);
        addEvent("completed", payload);
        setStatus("Đã hoàn thành.");
        stopStream();
      });

      source.addEventListener("error", (event) => {
        let payload = { message: "SSE error" };
        if (event.data) {
          try { payload = JSON.parse(event.data); } catch (_) {}
        }
        addEvent("error", payload);
        setStatus("Có lỗi trong quá trình stream.");
        stopStream();
      });

      source.onerror = () => {
        if (source) {
          addEvent("error", { message: "Kết nối SSE bị đóng hoặc lỗi mạng." });
          setStatus("Kết nối SSE bị đóng.");
          stopStream();
        }
      };
    }

    startBtn.addEventListener("click", startStream);
    stopBtn.addEventListener("click", stopStream);
  </script>
</body>
</html>
"""


@router.post("/query", response_model=QueryResponse)
async def query_endpoint(req: QueryRequest) -> QueryResponse:
    try:
        result = await run_query(session_id=req.session_id, question=req.question)
        query_result: Any = result.get("query_result")
        return QueryResponse(
            session_id=req.session_id,
            question=req.question,
            validated_sql=result.get("validated_sql"),
            final_answer=result.get("final_answer"),
            query_result=query_result.model_dump() if query_result else None,
            error=result.get("error"),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/query/stream")
async def query_stream_endpoint(session_id: str, question: str) -> StreamingResponse:
    async def event_generator() -> AsyncIterable[str]:
        async for event_name, payload in stream_query(session_id=session_id, question=question):
            yield sse_event(event=event_name, data=payload)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/query/stream/test", response_class=HTMLResponse)
async def query_stream_test_page() -> HTMLResponse:
    return HTMLResponse(SSE_TEST_PAGE)


@router.get("/session/{session_id}/state")
async def get_session_state(session_id: str):
    values = await get_query_state_values(session_id)
    if not values:
        raise HTTPException(status_code=404, detail="Session state not found")
    return values
