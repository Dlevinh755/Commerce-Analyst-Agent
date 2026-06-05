import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/authService';
import useCartStore from './cartStore';
import {
  clearAccessToken,
  getRefreshToken,
  setAccessToken,
  setAuthTokens,
  setRefreshToken,
} from '../utils/token';

function shouldLoadCart(user) {
  return String(user?.role || '').toLowerCase() === 'buyer';
}

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,

      setHydrated: () => set({ isHydrated: true }),

      login: async (payload) => {
        set({ isLoading: true });
        try {
          const { data } = await authService.login(payload);
          const accessToken = data.access_token || data.accessToken;
          const refreshToken = data.refresh_token || data.refreshToken;
          setAuthTokens(accessToken, refreshToken);
          set({
            user: data.user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isHydrated: true,
          });
          if (shouldLoadCart(data.user)) {
            useCartStore.getState().fetchCart().catch(() => {});
          } else {
            useCartStore.setState({ items: [], isLoading: false, error: '' });
          }
          return data;
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (payload) => {
        const { data } = await authService.register(payload);
        return data;
      },

      fetchProfile: async () => {
        const { data } = await authService.me();
        set({ user: data, isAuthenticated: true });
        if (shouldLoadCart(data)) {
          useCartStore.getState().fetchCart().catch(() => {});
        } else {
          useCartStore.setState({ items: [], isLoading: false, error: '' });
        }
        return data;
      },

      logout: async () => {
        const refreshToken = get().refreshToken || getRefreshToken();
        if (refreshToken) {
          try {
            await authService.logout({ refresh_token: refreshToken });
          } catch {
            // Ignore logout API errors and clear local session anyway.
          }
        }
        clearAccessToken();
        useCartStore.setState({ items: [], isLoading: false, error: '' });
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'bookstore-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: (storeState) => (state) => {
        const token = state?.accessToken;
        const refreshToken = state?.refreshToken;
        if (token) {
          setAccessToken(token);
        } else {
          setAccessToken(null);
        }
        if (refreshToken) {
          setRefreshToken(refreshToken);
        } else {
          setRefreshToken(null);
        }

        // Mark hydration complete even when there is no persisted auth payload.
        storeState?.setHydrated?.();
      },
    }
  )
);

export default useAuthStore;
