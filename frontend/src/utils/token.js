const ACCESS_TOKEN_KEY = 'bookstore_access_token';
const REFRESH_TOKEN_KEY = 'bookstore_refresh_token';
const AUTH_STORE_KEY = 'bookstore-auth';

function getPersistedAuthState() {
  const raw = localStorage.getItem(AUTH_STORE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.state || parsed || null;
  } catch {
    return null;
  }
}

function syncPersistedAuthState(partialState) {
  const raw = localStorage.getItem(AUTH_STORE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    const next = {
      ...parsed,
      state: {
        ...(parsed?.state || {}),
        ...partialState,
      },
    };
    localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(next));
  } catch {
    // Ignore malformed persisted state and avoid breaking auth flow.
  }
}

export function getAccessToken() {
  const directToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (directToken) {
    return directToken;
  }

  const persistedToken = getPersistedAuthState()?.accessToken || null;
  if (persistedToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, persistedToken);
    return persistedToken;
  }

  return null;
}

export function getRefreshToken() {
  const directToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (directToken) {
    return directToken;
  }

  const persistedToken = getPersistedAuthState()?.refreshToken || null;
  if (persistedToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, persistedToken);
    return persistedToken;
  }

  return null;
}

export function setAccessToken(token) {
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    syncPersistedAuthState({ accessToken: null });
    return;
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  syncPersistedAuthState({ accessToken: token });
}

export function setRefreshToken(token) {
  if (!token) {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    syncPersistedAuthState({ refreshToken: null });
    return;
  }
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
  syncPersistedAuthState({ refreshToken: token });
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_STORE_KEY);
}

export { ACCESS_TOKEN_KEY };
