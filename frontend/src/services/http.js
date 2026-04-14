import axios from 'axios';
import {
  clearAccessToken,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
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
        const nextRefreshToken = response?.data?.refresh_token;

        if (!nextAccessToken || !nextRefreshToken) {
          throw new Error('Invalid refresh response payload');
        }

        setAccessToken(nextAccessToken);
        setRefreshToken(nextRefreshToken);
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

    if (status === 401 && !originalConfig.__skipAuthRefresh && !originalConfig.__isRetryRequest) {
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
      }
    } else if (status === 401) {
      clearAccessToken();
    }

    return Promise.reject(error);
  }
);

export default api;
