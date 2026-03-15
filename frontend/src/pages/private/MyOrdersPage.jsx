import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import useOrderStore from '../../store/orderStore';

export default function MyOrdersPage() {
  const orders = useOrderStore((state) => state.orders);
  const fetchOrders = useOrderStore((state) => state.fetchOrders);
  const isLoading = useOrderStore((state) => state.isLoading);
  const error = useOrderStore((state) => state.error);

  useEffect(() => {
    fetchOrders().catch(() => {});
  }, [fetchOrders]);

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
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className="card block border-l-4 border-l-brand-500 hover:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Order #{order.id}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {order.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {new Date(order.created_at).toLocaleString()} • {order.items?.length || 0} items
            </p>
            <p className="mt-1 text-sm font-semibold text-brand-700">
              Total: ${order.pricing?.total?.toFixed ? order.pricing.total.toFixed(2) : order.total}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}