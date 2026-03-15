import { useEffect, useState } from 'react';
import { orderService } from '../../services/orderService';
import { getErrorMessage } from '../../utils/errorMessage';
import Toast from '../../components/common/Toast';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shippingOrderId, setShippingOrderId] = useState(null);
  const [reviewingOrderId, setReviewingOrderId] = useState(null);
  const [toast, setToast] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await orderService.listForSeller({ page: 1, page_size: 100 });
      setOrders(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load seller orders.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const onMarkShipped = async (orderId) => {
    setShippingOrderId(orderId);
    try {
      const { data } = await orderService.markShippedBySeller(orderId);
      setOrders((prev) =>
        prev.map((item) => (item.order_id === orderId ? { ...item, ...data } : item))
      );
      setToast(`Order #${orderId} marked as shipped.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not update order status.'));
    } finally {
      setShippingOrderId(null);
    }
  };

  const onApproveCancellation = async (orderId) => {
    setReviewingOrderId(orderId);
    try {
      const { data } = await orderService.approveCancellation(orderId);
      setOrders((prev) => prev.map((item) => (item.order_id === orderId ? { ...item, ...data } : item)));
      setToast(`Cancellation approved for order #${orderId}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not approve cancellation request.'));
    } finally {
      setReviewingOrderId(null);
    }
  };

  const onRejectCancellation = async (orderId) => {
    setReviewingOrderId(orderId);
    try {
      const { data } = await orderService.rejectCancellation(orderId);
      setOrders((prev) => prev.map((item) => (item.order_id === orderId ? { ...item, ...data } : item)));
      setToast(`Cancellation rejected for order #${orderId}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not reject cancellation request.'));
    } finally {
      setReviewingOrderId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Seller Orders</h1>
          <p className="mt-1 text-slate-600">Set order status to shipped when package leaves your warehouse.</p>
        </div>
        <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadOrders}>
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="card">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="card text-slate-600">No orders found for your books.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Order</th>
                <th className="px-4 py-3 text-left font-medium">Buyer</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => {
                const status = String(order.status || '').toLowerCase();
                const cancellationStatus = String(order.cancellation_status || 'none').toLowerCase();
                const canMarkShipped = status === 'pending' || status === 'processing';
                const hasPendingCancellation = status === 'shipped' && cancellationStatus === 'pending';
                return (
                  <tr key={order.order_id}>
                    <td className="px-4 py-3 font-medium">#{order.order_id}</td>
                    <td className="px-4 py-3">{order.buyer_id}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {order.order_date ? new Date(order.order_date).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">${Number(order.total_amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {order.status}
                        </span>
                        {cancellationStatus !== 'none' ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                            cancel:{cancellationStatus}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasPendingCancellation ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700"
                            onClick={() => onApproveCancellation(order.order_id)}
                            disabled={reviewingOrderId === order.order_id}
                          >
                            {reviewingOrderId === order.order_id ? 'Updating...' : 'Approve cancel'}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                            onClick={() => onRejectCancellation(order.order_id)}
                            disabled={reviewingOrderId === order.order_id}
                          >
                            {reviewingOrderId === order.order_id ? 'Updating...' : 'Reject'}
                          </button>
                        </div>
                      ) : canMarkShipped ? (
                        <button
                          type="button"
                          className="btn-primary px-3 py-1.5 text-xs"
                          onClick={() => onMarkShipped(order.order_id)}
                          disabled={shippingOrderId === order.order_id}
                        >
                          {shippingOrderId === order.order_id ? 'Updating...' : 'Mark shipped'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
