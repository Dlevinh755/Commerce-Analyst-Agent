import { useEffect, useRef, useState } from 'react';
import { buildAnalyticsStreamUrl } from '../../services/analyticsService';

function createSessionId() {
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatPayload(payload) {
  if (!payload) return '';
  if (payload.final_answer) return payload.final_answer;
  if (payload.message) return payload.message;
  if (payload.payload?.error) return payload.payload.error;
  return JSON.stringify(payload, null, 2);
}

export default function AnalyticsChatPanel() {
  const eventSourceRef = useRef(null);
  const [sessionId, setSessionId] = useState(() => createSessionId());
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      status: 'completed',
      content: 'Ask a business question to stream analysis progress from the analytics agent.',
      events: [],
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState('Idle');

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const appendEventToLastAssistantMessage = (eventName, payload) => {
    setMessages((prev) =>
      prev.map((message, index) => {
        if (index !== prev.length - 1 || message.role !== 'assistant') {
          return message;
        }

        const nextEvents = [
          ...message.events,
          {
            id: `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: eventName,
            payload,
          },
        ];

        if (eventName === 'completed') {
          return {
            ...message,
            status: 'completed',
            content: payload.final_answer || 'Completed without a final answer.',
            events: nextEvents,
            meta: payload,
          };
        }

        if (eventName === 'error') {
          return {
            ...message,
            status: 'error',
            content: payload.message || 'Streaming failed.',
            events: nextEvents,
            meta: payload,
          };
        }

        return {
          ...message,
          status: 'streaming',
          content: formatPayload(payload) || message.content,
          events: nextEvents,
        };
      })
    );
  };

  const startStream = () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isStreaming) return;

    const nextSessionId = createSessionId();
    setSessionId(nextSessionId);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        status: 'completed',
        content: trimmedQuestion,
      },
      {
        id: `assistant-${Date.now() + 1}`,
        role: 'assistant',
        status: 'streaming',
        content: 'Connecting to analytics stream...',
        events: [],
      },
    ]);
    setIsStreaming(true);
    setStatusText('Connecting...');

    closeStream();
    const source = new EventSource(
      buildAnalyticsStreamUrl({
        sessionId: nextSessionId,
        question: trimmedQuestion,
      })
    );
    eventSourceRef.current = source;

    source.addEventListener('started', (event) => {
      const payload = JSON.parse(event.data);
      setStatusText(payload.message || 'Started');
      appendEventToLastAssistantMessage('started', payload);
    });

    source.addEventListener('progress', (event) => {
      const payload = JSON.parse(event.data);
      setStatusText(payload.step || payload.message || 'Processing');
      appendEventToLastAssistantMessage('progress', payload);
    });

    source.addEventListener('completed', (event) => {
      const payload = JSON.parse(event.data);
      setStatusText('Completed');
      appendEventToLastAssistantMessage('completed', payload);
      setIsStreaming(false);
      closeStream();
    });

    source.addEventListener('error', (event) => {
      let payload = { message: 'Streaming failed.' };
      if (event.data) {
        try {
          payload = JSON.parse(event.data);
        } catch {
          payload = { message: event.data };
        }
      }
      setStatusText('Error');
      appendEventToLastAssistantMessage('error', payload);
      setIsStreaming(false);
      closeStream();
    });

    source.onerror = () => {
      setMessages((prev) =>
        prev.map((message, index) => {
          if (index !== prev.length - 1 || message.role !== 'assistant' || message.status === 'completed') {
            return message;
          }

          return {
            ...message,
            status: 'error',
            content: 'Connection closed before the analytics stream finished.',
          };
        })
      );
      setStatusText('Disconnected');
      setIsStreaming(false);
      closeStream();
    };

    setQuestion('');
  };

  const stopStream = () => {
    closeStream();
    setIsStreaming(false);
    setStatusText('Stopped');
    setMessages((prev) =>
      prev.map((message, index) => {
        if (index !== prev.length - 1 || message.role !== 'assistant' || message.status !== 'streaming') {
          return message;
        }

        return {
          ...message,
          status: 'error',
          content: 'Stream stopped by admin.',
        };
      })
    );
  };

  return (
    <article className="card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Analytics Chat</h2>
          <p className="mt-1 text-sm text-slate-600">
            Stream live reasoning steps from the analytics agent through the admin gateway.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          Session: {sessionId}
        </div>
      </div>

      <div className="mt-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex h-[32rem] flex-col gap-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-brand-500 text-white'
                    : message.status === 'error'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-white text-slate-800'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-wide opacity-75">
                  <span>{message.role === 'user' ? 'Admin' : 'Analytics Agent'}</span>
                  <span>{message.status}</span>
                </div>
                <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                {message.meta?.validated_sql ? (
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950/90 p-3 text-xs text-slate-100">
                    {message.meta.validated_sql}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="analytics-question">
              Ask the analytics agent
            </label>
            <textarea
              id="analytics-question"
              className="input min-h-28 resize-y"
              placeholder="Example: Total revenue by month for the last 6 months"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  startStream();
                }
              }}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Press Ctrl/Cmd + Enter to send.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  onClick={stopStream}
                  disabled={!isStreaming}
                >
                  Stop
                </button>
                <button type="button" className="btn-primary" onClick={startStream} disabled={!question.trim() || isStreaming}>
                  {isStreaming ? 'Streaming...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
