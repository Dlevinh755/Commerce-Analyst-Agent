import { useEffect, useMemo } from 'react';
import useAuth from '../../hooks/useAuth';
import useOrderStore from '../../store/orderStore';
import { formatCurrencyVND } from '../../utils/currency';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=300&q=80';

function paymentBadge(status) {
  const normalized = String(status || '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
  if (normalized.includes('complete') || normalized.includes('paid')) return 'bg-emerald-100 text-emerald-700';
  if (normalized.includes('refund')) return 'bg-sky-100 text-sky-700';
  if (normalized.includes('fail') || normalized.includes('cancel')) return 'bg-rose-100 text-rose-700';
  if (normalized.includes('pending') || normalized.includes('confirm')) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

function formatMoney(value) {
  return formatCurrencyVND(value);
}

function normalizeMethod(method) {
  const value = String(method || '').toLowerCase().trim();
  if (!value) return 'Không xác định';
  if (value === 'cod') return 'COD';
  if (value === 'vnpay') return 'VNPay';
  if (value === 'credit') return 'Thẻ tín dụng';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatStatus(status) {
  const normalized = String(status || '')
    .replace(/[_\s]+/g, ' ')
    .toLowerCase()
    .trim();
  if (!normalized) return 'Khong xac dinh';
  if (normalized.includes('paid') || normalized.includes('complete')) return 'Thanh cong';
  if (normalized.includes('pending') || normalized.includes('confirm')) return 'Dang cho';
  if (normalized.includes('refund')) return 'Hoan tien';
  if (normalized.includes('fail') || normalized.includes('cancel')) return 'That bai';
  return normalized;
}

export default function MyPaymentsPage() {
  const isHydrated = useAuth((state) => state.isHydrated);
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const paymentsRaw = useOrderStore((state) => state.payments);
  const payments = Array.isArray(paymentsRaw) ? paymentsRaw : [];
  const ordersRaw = useOrderStore((state) => state.orders);
  const orders = Array.isArray(ordersRaw) ? ordersRaw : [];
  const fetchPayments = useOrderStore((state) => state.fetchPayments);
  const fetchOrders = useOrderStore((state) => state.fetchOrders);
  const isLoading = useOrderStore((state) => state.isLoading);
  const error = useOrderStore((state) => state.error);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) {
      return;
    }
    Promise.all([fetchPayments(), fetchOrders()]).catch(() => {});
  }, [fetchPayments, fetchOrders, isHydrated, isAuthenticated]);

  const orderById = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      const key = String(order?.id ?? order?.order_id ?? '');
      if (key) {
        map.set(key, order);
      }
    });
    return map;
  }, [orders]);

  const displayPayments = useMemo(() => {
    return [...payments]
      .map((payment) => {
        const orderKey = String(payment?.order_id ?? '');
        const order = orderById.get(orderKey);
        const items = Array.isArray(order?.items) ? order.items : [];
        return {
          ...payment,
          orderItems: items,
        };
      })
      .sort((a, b) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [payments, orderById]);

  const renderOrderItems = (items) => {
    if (!items.length) {
      return {
        title: 'Sản phẩm trong đơn',
        covers: [FALLBACK_COVER],
      };
    }

    const firstTitle = items[0]?.title || 'Sản phẩm';
    const title = items.length > 1 ? `${firstTitle} +${items.length - 1} sản phẩm` : firstTitle;
    const covers = items.slice(0, 2).map((item) => item?.cover || FALLBACK_COVER);

    return { title, covers };
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Thanh toán của tôi</h1>
          <p className="mt-1 text-sm text-slate-500">Lịch sử thanh toán kèm thông tin sản phẩm và đơn hàng.</p>
        </div>
      </div>

      {isLoading ? <div className="card">Đang tải lịch sử thanh toán...</div> : null}
      {error ? <div className="card text-red-600">{error}</div> : null}

      {!isLoading && !displayPayments.length ? (
        <div className="card text-center text-slate-600">Không tìm thấy thanh toán nào.</div>
      ) : null}

      <div className="space-y-3">
        {displayPayments.map((payment) => {
          const preview = renderOrderItems(payment.orderItems || []);
          return (
            <article key={`${payment.id}-${payment.order_id || 'na'}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-12 md:items-center">
                <div className="md:col-span-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sản phẩm</p>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {preview.covers.map((cover, index) => (
                        <img
                          key={`${payment.id}-cover-${index}`}
                          src={cover}
                          alt="Sách"
                          className="h-12 w-9 rounded object-cover ring-1 ring-slate-200"
                          onError={(event) => {
                            event.currentTarget.src = FALLBACK_COVER;
                          }}
                        />
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{preview.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-xs text-slate-500">Đơn hàng #{payment.order_id || '-'}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${paymentBadge(payment.status)}`}>
                          {formatStatus(payment.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thời gian</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {payment.created_at ? new Date(payment.created_at).toLocaleString() : '-'}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số tiền</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(payment.amount)}</p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phương thức</p>
                  <p className="mt-1 text-sm text-slate-800">{normalizeMethod(payment.method)}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}