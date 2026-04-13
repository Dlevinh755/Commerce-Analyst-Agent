import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useOrderStore from '../../store/orderStore';
import { orderService } from '../../services/orderService';
import { vnpayService } from '../../services/vnpayService';
import { bookService } from '../../services/bookService';
import Toast from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorMessage';
import { normalizeBook } from '../../utils/bookMapper';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=300&q=80';

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered' || s === 'completed') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (s === 'pending' || s === 'pending_payment') {
    return 'bg-amber-100 text-amber-700';
  }
  if (s === 'cancelled' || s === 'canceled') {
    return 'bg-rose-100 text-rose-700';
  }
  if (s === 'shipped') {
    return 'bg-sky-100 text-sky-700';
  }
  return 'bg-slate-100 text-slate-700';
}

function BookThumb({ item, fallbackCover }) {
  const fallbackText = String(item?.title || 'Book').slice(0, 2).toUpperCase();
  const coverSrc = item?.cover || fallbackCover;
  if (coverSrc) {
    return (
      <img
        src={coverSrc}
        alt={item.title || 'Book'}
        className="h-16 w-10 rounded object-cover"
        onError={(event) => {
          event.currentTarget.src = FALLBACK_COVER;
        }}
      />
    );
  }

  return (
    <div className="flex h-16 w-10 items-center justify-center rounded bg-slate-300 text-[10px] font-bold text-slate-700">
      {fallbackText}
    </div>
  );
}

export default function MyOrdersPage() {
  const ordersRaw = useOrderStore((state) => state.orders);
  const orders = Array.isArray(ordersRaw) ? ordersRaw : [];
  const fetchOrders = useOrderStore((state) => state.fetchOrders);
  const isLoading = useOrderStore((state) => state.isLoading);
  const error = useOrderStore((state) => state.error);
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [toast, setToast] = useState('');
  const [coverByBookId, setCoverByBookId] = useState({});

  useEffect(() => {
    fetchOrders().catch(() => {});
  }, [fetchOrders]);

  useEffect(() => {
    const missingBookIds = [...new Set(
      orders
        .flatMap((order) => order.items || [])
        .filter((item) => !item?.cover && item?.book_id)
        .map((item) => Number(item.book_id))
        .filter((bookId) => Number.isInteger(bookId) && bookId > 0 && !coverByBookId[bookId])
    )];

    if (!missingBookIds.length) {
      return;
    }

    let cancelled = false;

    async function loadMissingCovers() {
      const results = await Promise.allSettled(
        missingBookIds.map(async (bookId) => {
          const { data } = await bookService.detail(bookId);
          const normalized = normalizeBook(data);
          return { bookId, cover: normalized.cover || FALLBACK_COVER };
        })
      );

      if (cancelled) {
        return;
      }

      const nextMap = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.bookId) {
          nextMap[result.value.bookId] = result.value.cover;
        }
      });

      if (Object.keys(nextMap).length) {
        setCoverByBookId((prev) => ({ ...prev, ...nextMap }));
      }
    }

    loadMissingCovers();

    return () => {
      cancelled = true;
    };
  }, [orders, coverByBookId]);

  const onConfirmReceived = async (orderId) => {
    setConfirmingId(orderId);
    try {
      await orderService.confirmReceived(orderId);
      await fetchOrders();
      setToast(`Order #${orderId} marked as delivered.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not confirm this order.'));
    } finally {
      setConfirmingId(null);
    }
  };

  const onCancelOrder = async (order) => {
    setCancellingId(order.id);
    try {
      const { data } = await orderService.cancel(order.id);
      await Promise.all([fetchOrders(), fetchProfile().catch(() => null)]);
      setToast(data?.message || `Order #${order.id} updated.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not update this order.'));
    } finally {
      setCancellingId(null);
    }
  };

  const canRetryVnpay = (order) => {
    const orderStatus = String(order?.status || '').toLowerCase();
    const paymentStatus = String(order?.payment_status || '').toLowerCase();
    const paymentMethod = String(order?.payment_method || '').toLowerCase();
    const isPendingUnpaid = orderStatus === 'pending' && paymentStatus !== 'completed';
    return isPendingUnpaid && (paymentMethod === '' || paymentMethod === 'vnpay');
  };

  const onRetryVnpay = async (order) => {
    const orderId = Number(order?.id || order?.order_id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      setToast('Invalid order id for VNPay retry.');
      return;
    }

    setRetryingId(orderId);
    try {
      const total = Number(order?.pricing?.total ?? order?.total ?? 0);
      const amountVnd = Math.max(1, Math.round(total * 25000));

      const { data } = await vnpayService.createPaymentUrl({
        order_id: String(orderId),
        amount: amountVnd,
        order_desc: `Thanh toan don hang ${orderId}`,
        return_url: `${window.location.origin}/checkout/vnpay-return`,
        language: 'vn',
      });

      const paymentUrl = data?.payment_url;
      if (!paymentUrl) {
        throw new Error('Could not create VNPay payment URL.');
      }

      window.location.href = paymentUrl;
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not start VNPay payment again.'));
      setRetryingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h1 className="text-3xl font-semibold text-slate-900">My Orders</h1>
          <Link to="/books" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
            Continue shopping
          </Link>
        </div>

        {isLoading ? <div className="card">Loading orders...</div> : null}
        {error ? <div className="card text-red-600">{error}</div> : null}

        {!isLoading && !orders.length ? (
          <div className="card text-center">
            <p className="text-slate-600">No orders yet.</p>
            <Link to="/books" className="btn-primary mt-4 inline-block">
              Buy your first book
            </Link>
          </div>
        ) : null}

        <div className="space-y-3">
          {orders.map((order) => {
            const statusLower = String(order.status || '').toLowerCase();
            const cancellationPending = String(order.cancellation_status || 'none').toLowerCase() === 'pending';
            const total = order.pricing?.total?.toFixed ? order.pricing.total.toFixed(2) : order.total;
            const previewItems = Array.isArray(order.items) ? order.items.slice(0, 3) : [];
            const remainingItems = Math.max(0, (order.items?.length || 0) - previewItems.length);

            return (
              <div key={order.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div className="flex gap-3">
                  <div className="relative flex w-24 flex-shrink-0 items-start gap-1">
                    {previewItems.length
                      ? previewItems.map((item) => (
                          <BookThumb
                            key={`${order.id}-${item.id}`}
                            item={item}
                            fallbackCover={coverByBookId[item.book_id]}
                          />
                        ))
                      : null}
                    {remainingItems > 0 ? (
                      <span className="absolute -bottom-1 right-0 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        +{remainingItems} items
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">Order #{order.id}</p>
                        <p className="text-xs text-slate-500">
                          {order.created_at ? new Date(order.created_at).toLocaleString() : '-'} • {order.items?.length || 0} items
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                        {String(order.status || 'unknown').toLowerCase()}
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-medium text-slate-700">Total: {formatCurrency(total)}</p>
                    <p className="text-sm text-slate-600">
                      Payment: {order.payment_method || '-'} - {order.payment_status || 'pending'}
                    </p>

                    {cancellationPending ? (
                      <p className="mt-1 text-xs font-medium text-amber-700">Cancellation request pending seller approval.</p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusLower === 'shipped' ? (
                          <button
                            type="button"
                            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
                            onClick={() => onConfirmReceived(order.id)}
                            disabled={confirmingId === order.id}
                          >
                            {confirmingId === order.id ? 'Confirming...' : 'Confirm received'}
                          </button>
                        ) : null}

                        {['pending', 'processing', 'shipped'].includes(statusLower) ? (
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                            onClick={() => onCancelOrder(order)}
                            disabled={cancellingId === order.id || cancellationPending}
                          >
                            {cancellingId === order.id
                              ? 'Submitting...'
                              : statusLower === 'shipped'
                                ? 'Request cancel'
                                : 'Cancel order'}
                          </button>
                        ) : null}

                        {canRetryVnpay(order) ? (
                          <button
                            type="button"
                            className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
                            onClick={() => onRetryVnpay(order)}
                            disabled={retryingId === order.id}
                          >
                            {retryingId === order.id ? 'Redirecting...' : 'Thanh toan lai'}
                          </button>
                        ) : null}
                      </div>

                      <Link
                        to={`/orders/${order.id}`}
                        className="text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                      >
                        View detail
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}