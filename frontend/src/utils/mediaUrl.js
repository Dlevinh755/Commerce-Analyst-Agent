export function resolveMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (raw.startsWith('/api/')) {
    return raw;
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    if (isLocalhost && parsed.pathname.startsWith('/api/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    if (isLocalhost && parsed.pathname.startsWith('/uploads/')) {
      return `/api/v1/products${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return raw;
  }

  return raw;
}
