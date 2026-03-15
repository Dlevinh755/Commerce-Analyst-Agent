import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useOrderStore from '../../store/orderStore';
import { orderService } from '../../services/orderService';
import Toast from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorMessage';

export default function MyOrdersPage() {
  const orders = useOrderStore((state) => state.orders);
  const fetchOrders = useOrderStore((state) => state.fetchOrders);
  const isLoading = useOrderStore((state) => state.isLoading);
  const error = useOrderStore((state) => state.error);
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetchOrders().catch(() => {});
  }, [fetchOrders]);

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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My Orders</h1>
        <Link to="/books" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
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
        {orders.map((order) => (
          <div key={order.id} className="card border-l-4 border-l-brand-500">
            {String(order.cancellation_status || 'none').toLowerCase() === 'pending' ? (
              <p className="mb-2 text-xs font-medium text-amber-700">Cancellation request pending seller approval.</p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={`/orders/${order.id}`} className="font-semibold text-brand-700 hover:underline">
                Order #{order.id}
              </Link>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {order.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Ordered: {order.created_at ? new Date(order.created_at).toLocaleString() : '-'} • {order.items?.length || 0} items
            </p>
            {order.delivered_at ? (
              <p className="text-sm text-emerald-600">
                Received: {new Date(order.delivered_at).toLocaleString()}
              </p>
            ) : null}
            <p className="mt-1 text-sm font-semibold text-brand-700">
              Total: ${order.pricing?.total?.toFixed ? order.pricing.total.toFixed(2) : order.total}
            </p>
            <p className="mt-1 text-sm text-slate-500">Payment: {order.payment_method || '-'} • {order.payment_status || 'pending'}</p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Link
                to={`/orders/${order.id}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium"
              >
                View detail
              </Link>

              {String(order.status).toLowerCase() === 'shipped' ? (
                <button
                  type="button"
                  className="btn-primary px-3 py-1.5 text-xs"
                  onClick={() => onConfirmReceived(order.id)}
                  disabled={confirmingId === order.id}
                >
                  {confirmingId === order.id ? 'Confirming...' : 'Confirm received'}
                </button>
              ) : null}

              {['pending', 'processing', 'shipped'].includes(String(order.status).toLowerCase()) ? (
                <button
                  type="button"
                  className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700"
                  onClick={() => onCancelOrder(order)}
                  disabled={cancellingId === order.id || String(order.cancellation_status || 'none').toLowerCase() === 'pending'}
                >
                  {cancellingId === order.id
                    ? 'Submitting...'
                    : String(order.status).toLowerCase() === 'shipped'
                      ? 'Request cancel'
                      : 'Cancel order'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}