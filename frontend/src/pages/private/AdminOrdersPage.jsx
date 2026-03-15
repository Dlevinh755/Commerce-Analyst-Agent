import { useEffect, useState } from 'react';
import { orderService } from '../../services/orderService';
import Toast from '../../components/common/Toast';
import AdminSectionNav from '../../components/admin/AdminSectionNav';
import { getErrorMessage } from '../../utils/errorMessage';

const ORDER_STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [toast, setToast] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await orderService.listForAdmin({ page: 1, page_size: 100 });
      setOrders(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load orders.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const onOrderStatusChange = async (orderId, status) => {
    setSavingOrderId(orderId);
    try {
      const { data } = await orderService.updateStatus(orderId, status);
      setOrders((prev) => prev.map((item) => (item.order_id === orderId ? data : item)));
      setToast(`Order #${orderId} updated to ${status}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not update order status.'));
    } finally {
      setSavingOrderId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Admin Orders</h1>
        <p className="mt-1 text-slate-600">Manage order states and shipping progress.</p>
      </div>

      <AdminSectionNav />

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="card">Loading orders...</div>
      ) : (
        <article className="card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Orders</h2>
            <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadOrders}>
              Refresh
            </button>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">ID</th>
                <th className="px-3 py-2 text-left font-medium">Buyer</th>
                <th className="px-3 py-2 text-left font-medium">Total</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.order_id}>
                  <td className="px-3 py-2">#{order.order_id}</td>
                  <td className="px-3 py-2">{order.buyer_id}</td>
                  <td className="px-3 py-2">${Number(order.total_amount || 0).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <select
                      className="input max-w-44"
                      value={order.status}
                      onChange={(event) => onOrderStatusChange(order.order_id, event.target.value)}
                      disabled={savingOrderId === order.order_id}
                    >
                      {ORDER_STATUS_OPTIONS.map((statusValue) => (
                        <option key={statusValue} value={statusValue}>
                          {statusValue}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
