const ACCESS_TOKEN_KEY = 'bookstore_access_token';
const AUTH_STORE_KEY = 'bookstore-auth';

function getPersistedAuthToken() {
  const raw = localStorage.getItem(AUTH_STORE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const token = parsed?.state?.accessToken ?? parsed?.accessToken ?? null;
    return token || null;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  const directToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (directToken) {
    return directToken;
  }

  const persistedToken = getPersistedAuthToken();
  if (persistedToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, persistedToken);
    return persistedToken;
  }

  return null;
}

export function setAccessToken(token) {
  if (!token) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export { ACCESS_TOKEN_KEY };
