import axios from 'axios';
import useAuthStore from '../store/authStore';
import {
  clearAccessToken,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from '../utils/token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
});

let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('Missing refresh token');
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, {
        refresh_token: refreshToken,
      })
      .then((response) => {
        const nextAccessToken = response?.data?.access_token;
        const nextRefreshToken = response?.data?.refresh_token || response?.data?.refreshToken;

        if (!nextAccessToken || !nextRefreshToken) {
          throw new Error('Invalid refresh response payload');
        }

        setAuthTokens(nextAccessToken, nextRefreshToken);
        useAuthStore.setState((prev) => ({
          ...prev,
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
          isAuthenticated: true,
        }));
        return nextAccessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalConfig = error?.config || {};

    if (status !== 401) {
      return Promise.reject(error);
    }

    if (originalConfig.__skipAuthRefresh) {
      // If refresh endpoint itself is unauthorized, current session is no longer valid.
      if (String(originalConfig.url || '').includes('/auth/refresh')) {
        clearAccessToken();
        useAuthStore.setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      }
      return Promise.reject(error);
    }

    if (!originalConfig.__isRetryRequest) {
      try {
        const newAccessToken = await refreshAccessToken();
        originalConfig.__isRetryRequest = true;
        originalConfig.headers = {
          ...(originalConfig.headers || {}),
          Authorization: `Bearer ${newAccessToken}`,
        };
        return api(originalConfig);
      } catch {
        clearAccessToken();
        useAuthStore.setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      }
    }

    return Promise.reject(error);
  }
);

export default api;
