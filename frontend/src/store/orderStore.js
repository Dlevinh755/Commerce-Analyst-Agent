import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';

const ORDER_LOG_PREFIX = '[orderStore]';
const devLog = (...args) => {
  if (import.meta.env.DEV) {
    console.debug(ORDER_LOG_PREFIX, ...args);
  }
};

function normalizeOrder(raw = {}) {
  const orderId = raw.id ?? raw.order_id;
  const items = (raw.items || []).map((item) => ({
    id: item.id ?? item.order_item_id ?? item.book_id,
    title: item.title ?? item.book?.title ?? `Book #${item.book_id}`,
    price: Number(item.price ?? item.unit_price ?? 0),
    quantity: Number(item.quantity ?? 0),
    line_total: Number(item.line_total ?? item.subtotal ?? (Number(item.unit_price ?? 0) * Number(item.quantity ?? 0))),
  }));

  const subtotal = Number(
    raw.pricing?.subtotal ??
      items.reduce((sum, item) => sum + Number(item.line_total || 0), 0)
  );
  const shippingFee = Number(raw.pricing?.shipping_fee ?? 0);
  const total = Number(raw.pricing?.total ?? raw.total_amount ?? subtotal + shippingFee);

  return {
    ...raw,
    id: orderId,
    order_id: orderId,
    created_at: raw.created_at ?? raw.order_date,
    delivered_at: raw.delivered_at ?? null,
    payment_method: raw.payment_method ?? null,
    payment_status: raw.payment_status ?? null,
    transaction_code: raw.transaction_code ?? null,
    cancellation_status: raw.cancellation_status ?? 'none',
    cancellation_requested_at: raw.cancellation_requested_at ?? null,
    cancellation_reason: raw.cancellation_reason ?? null,
    cancellation_reviewed_at: raw.cancellation_reviewed_at ?? null,
    notes: raw.notes ?? '',
    items,
    total,
    pricing: {
      subtotal,
      shipping_fee: shippingFee,
      total,
    },
  };
}

function normalizePayment(raw = {}) {
  return {
    ...raw,
    id: raw.id ?? raw.payment_id,
    payment_id: raw.payment_id ?? raw.id,
    order_id: raw.order_id,
    amount: Number(raw.amount ?? 0),
    method: raw.method ?? raw.payment_method ?? '-',
    status: raw.status ?? raw.payment_status ?? 'pending',
    created_at: raw.created_at ?? null,
    transaction_code: raw.transaction_code ?? null,
  };
}

function randomId(prefix) {
  const timestamp = Date.now().toString().slice(-7);
  const random = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${timestamp}${random}`;
}

const useOrderStore = create(
  persist(
    (set, get) => ({
      orders: [],
      payments: [],
      isLoading: false,
      error: '',

      clearError: () => set({ error: '' }),

      fetchOrders: async () => {
        set({ isLoading: true, error: '' });
        try {
          const { data } = await orderService.list();
          const items = Array.isArray(data) ? data : data?.items || [];
          const normalized = items.map(normalizeOrder);
          if (normalized.length) {
            set({ orders: normalized });
          }
          return normalized;
        } catch {
          return get().orders;
        } finally {
          set({ isLoading: false });
        }
      },

      fetchOrderById: async (orderId) => {
        set({ isLoading: true, error: '' });
        try {
          const { data } = await orderService.detail(orderId);
          return normalizeOrder(data);
        } catch {
          return get().orders.find((item) => String(item.id) === String(orderId)) || null;
        } finally {
          set({ isLoading: false });
        }
      },

      fetchPayments: async () => {
        set({ isLoading: true, error: '' });
        try {
          const { data } = await paymentService.listMyPayments();
          const items = Array.isArray(data) ? data : data?.items || [];
          const normalized = items.map(normalizePayment);
          set({ payments: normalized });
          return normalized;
        } catch {
          return get().payments;
        } finally {
          set({ isLoading: false });
        }
      },

      createOrderFromCart: async ({ user, cartItems, shippingAddress, paymentMethod, notes }) => {
        devLog('createOrderFromCart:start', {
          buyerId: user?.user_id,
          cartItems: cartItems?.length || 0,
          shippingAddressLength: shippingAddress?.trim?.().length || 0,
          paymentMethod,
        });
        if (!cartItems?.length) {
          set({ error: 'Cart is empty.' });
          console.warn(ORDER_LOG_PREFIX, 'createOrderFromCart:blocked-empty-cart');
          throw new Error('Cart is empty.');
        }

        set({ isLoading: true, error: '' });

        const now = new Date().toISOString();
        const subtotal = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
        const shippingFee = subtotal >= 50 ? 0 : 4.99;
        const totalAmount = Number((subtotal + shippingFee).toFixed(2));

        const order = {
          id: randomId('OD'),
          created_at: now,
          status: 'PENDING_PAYMENT',
          customer: {
            id: user?.user_id,
            username: user?.username,
            full_name: user?.full_name,
            email: user?.email,
          },
          items: cartItems.map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            line_total: Number(((item.price || 0) * item.quantity).toFixed(2)),
          })),
          payment_method: paymentMethod,
          shipping_address: shippingAddress,
          notes: notes || '',
          pricing: {
            subtotal: Number(subtotal.toFixed(2)),
            shipping_fee: shippingFee,
            total: totalAmount,
          },
        };

        try {
          devLog('createOrderFromCart:request', { shipping_address: shippingAddress });
          const { data } = await orderService.create({
            shipping_address: shippingAddress,
          });
          const normalized = normalizeOrder(data);
          devLog('createOrderFromCart:success', {
            orderId: normalized.order_id,
            items: normalized.items?.length || 0,
            total: normalized.total,
          });

          set({
            orders: [normalized, ...get().orders.filter((item) => String(item.id) !== String(normalized.id))],
            isLoading: false,
            error: '',
          });

          return normalized;
        } catch (error) {
          console.error(ORDER_LOG_PREFIX, 'createOrderFromCart:error', error?.response?.status, error?.response?.data || error?.message);
          set({
            isLoading: false,
            error: error?.response?.data?.detail || 'Could not create order.',
          });
          throw error;
        }
      },
    }),
    {
      name: 'bookstore-order',
      partialize: (state) => ({
        orders: state.orders,
        payments: state.payments,
      }),
    }
  )
);

export default useOrderStore;
