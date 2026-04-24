const analyticsBasePath = `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/analytics`;

export function buildAnalyticsStreamUrl({ sessionId, question }) {
  const params = new URLSearchParams({
    session_id: sessionId,
    question,
  });

  return `${analyticsBasePath}/api/query/stream?${params.toString()}`;
}
