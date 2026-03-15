import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useOrderStore from '../../store/orderStore';
import { orderService } from '../../services/orderService';
import Toast from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorMessage';

export default function OrderDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fetchOrderById = useOrderStore((state) => state.fetchOrderById);
  const isLoading = useOrderStore((state) => state.isLoading);
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState('');

  const vnpResponseCode = searchParams.get('vnp_ResponseCode');
  const vnpTransactionNo = searchParams.get('vnp_TransactionNo');
  const vnpPaymentNotice =
    vnpResponseCode === '00'
      ? 'VNPay payment successful.'
      : vnpResponseCode
        ? 'VNPay payment was not successful. Please try again.'
        : '';

  useEffect(() => {
    async function loadDetail() {
      setError('');
      const data = await fetchOrderById(id);
      if (!data) {
        setError('Order not found.');
        return;
      }
      setOrder(data);
    }

    loadDetail();
  }, [id, fetchOrderById]);

  const onConfirmReceived = async () => {
    setConfirming(true);
    try {
      await orderService.confirmReceived(id);
      const updated = await fetchOrderById(id);
      if (updated) {
        setOrder(updated);
      }
      setToast(`Order #${id} marked as delivered.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not confirm this order.'));
    } finally {
      setConfirming(false);
    }
  };

  const onCancelOrder = async () => {
    setCancelling(true);
    try {
      const { data } = await orderService.cancel(id);
      const updated = await fetchOrderById(id);
      if (updated) {
        setOrder(updated);
      }
      await fetchProfile().catch(() => null);
      setToast(data?.message || `Order #${id} updated.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not update this order.'));
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading && !order) {
    return <section className="card">Loading order details...</section>;
  }

  if (error) {
    return (
      <section className="card">
        <p className="text-red-600">{error}</p>
        <Link to="/orders" className="mt-3 inline-block text-brand-700">
          Back to orders
        </Link>
      </section>
    );
  }

  if (!order) {
    return <section className="card text-slate-600">No order data.</section>;
  }

  return (
    <section className="space-y-4">
      {vnpPaymentNotice ? (
        <div className={`rounded-lg p-3 text-sm ${vnpResponseCode === '00' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {vnpPaymentNotice}
          {vnpTransactionNo ? ` Transaction: ${vnpTransactionNo}.` : ''}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Order #{order.id}</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">{order.status}</span>
          {String(order.status).toLowerCase() === 'shipped' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={onConfirmReceived}
              disabled={confirming}
            >
              {confirming ? 'Confirming...' : 'Confirm received'}
            </button>
          ) : null}
          {['pending', 'processing', 'shipped'].includes(String(order.status).toLowerCase()) ? (
            <button
              type="button"
              className="rounded-lg border border-rose-300 px-3 py-1 text-sm font-medium text-rose-700"
              onClick={onCancelOrder}
              disabled={cancelling || String(order.cancellation_status || 'none').toLowerCase() === 'pending'}
            >
              {cancelling ? 'Submitting...' : String(order.status).toLowerCase() === 'shipped' ? 'Request cancel' : 'Cancel order'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold">Items</h2>
          <div className="mt-3 space-y-3">
            {(order.items || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-none last:pb-0">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-slate-500">${item.price} x {item.quantity}</p>
                </div>
                <p className="font-medium">${Number(item.line_total || item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card h-fit space-y-3">
          <h2 className="text-lg font-semibold">Summary</h2>
          <p className="text-sm text-slate-600">Ordered: {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</p>
          {order.delivered_at ? (
            <p className="text-sm font-medium text-emerald-600">Received: {new Date(order.delivered_at).toLocaleString()}</p>
          ) : null}
          <p className="text-sm text-slate-600">Payment Method: {order.payment_method || '-'}</p>
          <p className="text-sm text-slate-600">Payment Status: {order.payment_status || 'pending'}</p>
          {String(order.cancellation_status || 'none').toLowerCase() !== 'none' ? (
            <p className="text-sm text-slate-600">
              Cancellation: {order.cancellation_status}
              {order.cancellation_requested_at ? ` • requested ${new Date(order.cancellation_requested_at).toLocaleString()}` : ''}
            </p>
          ) : null}
          {order.cancellation_reason ? (
            <p className="text-sm text-slate-600">Cancellation note: {order.cancellation_reason}</p>
          ) : null}
          <p className="text-sm text-slate-600">Shipping Address: {order.shipping_address || '-'}</p>
          <div className="border-t border-slate-200 pt-3">
            <p className="text-sm text-slate-600">Subtotal: ${Number(order.pricing?.subtotal || 0).toFixed(2)}</p>
            <p className="text-sm text-slate-600">Shipping: ${Number(order.pricing?.shipping_fee || 0).toFixed(2)}</p>
            <p className="mt-1 text-lg font-semibold text-brand-700">Total: ${Number(order.pricing?.total || order.total || 0).toFixed(2)}</p>
          </div>
          {order.notes ? <p className="rounded-md bg-slate-50 p-2 text-sm text-slate-600">Notes: {order.notes}</p> : null}
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
