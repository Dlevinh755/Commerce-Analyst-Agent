import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartService } from '../services/cartService';
import { getAccessToken } from '../utils/token';

const CART_LOG_PREFIX = '[cartStore]';
const devLog = (...args) => {
  if (import.meta.env.DEV) {
    console.debug(CART_LOG_PREFIX, ...args);
  }
};

function normalizeCartItem(raw = {}) {
  return {
    id: raw.book_id ?? raw.book?.book_id,
    cartId: raw.cart_id,
    title: raw.book?.title ?? 'Untitled Book',
    author: raw.book?.author ?? 'Unknown Author',
    price: Number(raw.unit_price ?? raw.book?.price ?? 0),
    quantity: Number(raw.quantity ?? 0),
    cover: raw.book?.image_url ?? '',
    stock: Number(raw.book?.stock_quantity ?? 0),
  };
}

function isAuthenticatedCart() {
  return Boolean(getAccessToken());
}

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: '',

      fetchCart: async () => {
        const hasToken = isAuthenticatedCart();
        devLog('fetchCart:start', { hasToken, localItems: get().items.length });
        if (!hasToken) {
          devLog('fetchCart:skip-backend-no-token');
          return get().items;
        }

        set({ isLoading: true, error: '' });
        try {
          const { data } = await cartService.getSummary();
          const items = Array.isArray(data?.items) ? data.items.map(normalizeCartItem) : [];
          devLog('fetchCart:success', { backendItems: items.length });
          set({ items, isLoading: false, error: '' });
          return items;
        } catch (error) {
          console.error(CART_LOG_PREFIX, 'fetchCart:error', error?.response?.status, error?.response?.data || error?.message);
          set({ isLoading: false, error: error?.response?.data?.detail || 'Could not load cart.' });
          return get().items;
        }
      },

      addItem: async (book, quantity = 1) => {
        devLog('addItem:start', { bookId: Number(book?.id), quantity, hasToken: isAuthenticatedCart() });
        if (isAuthenticatedCart()) {
          const { data } = await cartService.addItem({
            book_id: Number(book.id),
            quantity,
          });

          const normalized = normalizeCartItem(data);
          const existing = get().items.find((item) => item.id === normalized.id);
          if (existing) {
            devLog('addItem:update-existing', { bookId: normalized.id, quantity: normalized.quantity });
            set({
              items: get().items.map((item) => (item.id === normalized.id ? normalized : item)),
              error: '',
            });
            return normalized;
          }

          devLog('addItem:add-new', { bookId: normalized.id, quantity: normalized.quantity });
          set({ items: [...get().items, normalized], error: '' });
          return normalized;
        }

        const existing = get().items.find((item) => item.id === book.id);
        if (existing) {
          set({
            items: get().items.map((item) =>
              item.id === book.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
          });
          return existing;
        }

        set({ items: [...get().items, { ...book, quantity }] });
        return { ...book, quantity };
      },

      removeItem: async (bookId) => {
        devLog('removeItem:start', { bookId, hasToken: isAuthenticatedCart() });
        if (isAuthenticatedCart()) {
          const item = get().items.find((entry) => entry.id === bookId);
          if (item?.cartId) {
            await cartService.removeItem(item.cartId);
          }
        }
        set({ items: get().items.filter((item) => item.id !== bookId) });
        devLog('removeItem:done', { bookId, remaining: get().items.length });
      },

      updateQuantity: async (bookId, quantity) => {
        devLog('updateQuantity:start', { bookId, quantity, hasToken: isAuthenticatedCart() });
        if (quantity <= 0) {
          await get().removeItem(bookId);
          return;
        }

        if (isAuthenticatedCart()) {
          const item = get().items.find((entry) => entry.id === bookId);
          if (item?.cartId) {
            const { data } = await cartService.updateItem(item.cartId, { quantity });
            const normalized = normalizeCartItem(data);
            set({
              items: get().items.map((entry) => (entry.id === bookId ? normalized : entry)),
            });
            return;
          }
        }

        set({
          items: get().items.map((item) =>
            item.id === bookId ? { ...item, quantity } : item
          ),
        });
      },

      clearCart: async () => {
        devLog('clearCart:start', { hasToken: isAuthenticatedCart(), currentItems: get().items.length });
        if (isAuthenticatedCart()) {
          await cartService.clear();
        }
        set({ items: [] });
        devLog('clearCart:done');
      },

      totalItems: () =>
        get().items.reduce((total, item) => total + item.quantity, 0),

      totalAmount: () =>
        get().items.reduce(
          (total, item) => total + (item.price || 0) * item.quantity,
          0
        ),
    }),
    {
      name: 'bookstore-cart',
    }
  )
);

export default useCartStore;
