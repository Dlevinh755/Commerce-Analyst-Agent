import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartService } from '../services/cartService';
import { getAccessToken } from '../utils/token';
import { resolveMediaUrl } from '../utils/mediaUrl';

const CART_LOG_PREFIX = '[cartStore]';
const devLog = (...args) => {
  if (import.meta.env.DEV) {
    console.debug(CART_LOG_PREFIX, ...args);
  }
};

function normalizeCartItem(raw = {}) {
  const book = raw.book ?? {};

  return {
    id: raw.book_id ?? book.book_id ?? book.id ?? raw.bookId ?? raw.id,
    cartId: raw.cart_id ?? raw.cartId,
    title: book.title ?? 'Chưa đặt tên',
    author: book.author ?? 'Không rõ tác giả',
    price: Number(raw.unit_price ?? book.price ?? 0),
    quantity: Number(raw.quantity ?? 0),
    cover: resolveMediaUrl(
      book.image_url ??
        book.cover ??
        book.image ??
        book.thumbnail ??
        raw.image_url ??
        raw.cover ??
        raw.image ??
        ''
    ),
    stock: Number(book.stock_quantity ?? 0),
  };
}

function isAuthenticatedCart() {
  return Boolean(getAccessToken());
}

function isUnauthorized(error) {
  return Number(error?.response?.status) === 401;
}

function normalizeItemRef(itemRef) {
  if (typeof itemRef === 'object' && itemRef !== null) {
    return {
      cartId: itemRef.cartId ?? null,
      bookId: itemRef.bookId ?? itemRef.id ?? null,
    };
  }

  return { cartId: null, bookId: itemRef ?? null };
}

function findItemByRef(items, itemRef) {
  const ref = normalizeItemRef(itemRef);
  if (ref.cartId != null) {
    return items.find((entry) => entry.cartId === ref.cartId) ?? null;
  }
  if (ref.bookId != null) {
    return items.find((entry) => entry.id === ref.bookId) ?? null;
  }
  return null;
}

function isSameItem(entry, itemRef) {
  const ref = normalizeItemRef(itemRef);
  if (ref.cartId != null) {
    return entry.cartId === ref.cartId;
  }
  if (ref.bookId != null) {
    return entry.id === ref.bookId;
  }
  return false;
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
          if (isUnauthorized(error)) {
            devLog('fetchCart:unauthorized');
            set({ items: [], isLoading: false, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
            return [];
          }

          console.error(CART_LOG_PREFIX, 'fetchCart:error', error?.response?.status, error?.response?.data || error?.message);
          set({ isLoading: false, error: error?.response?.data?.detail || 'Không thể tải giỏ hàng.' });
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

      removeItem: async (itemRef) => {
        devLog('removeItem:start', { itemRef, hasToken: isAuthenticatedCart() });
        const item = findItemByRef(get().items, itemRef);
        try {
          if (isAuthenticatedCart() && item?.cartId) {
            await cartService.removeItem(item.cartId);
          }
          set({
            items: get().items.filter((entry) => !isSameItem(entry, itemRef)),
            error: '',
          });
          devLog('removeItem:done', { itemRef, remaining: get().items.length });
        } catch (error) {
          if (isUnauthorized(error)) {
            devLog('removeItem:unauthorized');
            set({ items: [], error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
            return;
          }

          console.error(CART_LOG_PREFIX, 'removeItem:error', error?.response?.status, error?.response?.data || error?.message);
          set({ error: error?.response?.data?.detail || 'Không thể xóa sản phẩm khỏi giỏ hàng.' });
        }
      },

      updateQuantity: async (itemRef, quantity) => {
        devLog('updateQuantity:start', { itemRef, quantity, hasToken: isAuthenticatedCart() });
        if (quantity <= 0) {
          await get().removeItem(itemRef);
          return;
        }

        const currentItem = findItemByRef(get().items, itemRef);
        if (!currentItem) {
          return;
        }

        try {
          if (isAuthenticatedCart() && currentItem.cartId) {
            const { data } = await cartService.updateItem(currentItem.cartId, { quantity });
            const normalized = normalizeCartItem(data);
            set({
              items: get().items.map((entry) => (isSameItem(entry, itemRef) ? normalized : entry)),
              error: '',
            });
            return;
          }

          set({
            items: get().items.map((entry) => (isSameItem(entry, itemRef) ? { ...entry, quantity } : entry)),
            error: '',
          });
        } catch (error) {
          if (isUnauthorized(error)) {
            devLog('updateQuantity:unauthorized');
            set({ items: [], error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
            return;
          }

          console.error(CART_LOG_PREFIX, 'updateQuantity:error', error?.response?.status, error?.response?.data || error?.message);
          set({ error: error?.response?.data?.detail || 'Không thể cập nhật số lượng.' });
        }
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
