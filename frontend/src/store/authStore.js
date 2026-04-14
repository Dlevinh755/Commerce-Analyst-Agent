import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/authService';
import useCartStore from './cartStore';
import { clearAccessToken, setAccessToken, setRefreshToken } from '../utils/token';

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
          setAccessToken(data.access_token);
          setRefreshToken(data.refresh_token);
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
          });
          if (shouldLoadCart(data.user)) {
            await useCartStore.getState().fetchCart();
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
          await useCartStore.getState().fetchCart();
        } else {
          useCartStore.setState({ items: [], isLoading: false, error: '' });
        }
        return data;
      },

      logout: async () => {
        const refreshToken = get().refreshToken;
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
      onRehydrateStorage: () => (state) => {
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
        useAuthStore.setState({ isHydrated: true });
      },
    }
  )
);

export default useAuthStore;
