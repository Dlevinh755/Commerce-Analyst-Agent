import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/authService';
import useCartStore from './cartStore';
import { clearAccessToken, setAccessToken } from '../utils/token';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (payload) => {
        set({ isLoading: true });
        try {
          const { data } = await authService.login(payload);
          setAccessToken(data.access_token);
          set({
            user: data.user,
            accessToken: data.access_token,
            isAuthenticated: true,
          });
          await useCartStore.getState().fetchCart();
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
        await useCartStore.getState().fetchCart();
        return data;
      },

      logout: () => {
        clearAccessToken();
        useCartStore.setState({ items: [], isLoading: false, error: '' });
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'bookstore-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        const token = state?.accessToken;
        if (token) {
          setAccessToken(token);
        } else {
          clearAccessToken();
        }
      },
    }
  )
);

export default useAuthStore;
