import { Link } from 'react-router-dom';

const mockOrders = [
  { id: 101, status: 'PAID', total: 76 },
  { id: 102, status: 'SHIPPING', total: 23 },
];

export default function OrdersPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Orders</h1>
      <div className="mt-4 space-y-3">
        {mockOrders.map((order) => (
          <Link key={order.id} to={`/orders/${order.id}`} className="card block hover:border-brand-500">
            <p className="font-medium">Order #{order.id}</p>
            <p className="text-sm text-slate-600">Status: {order.status}</p>
            <p className="text-sm text-slate-600">Total: ${order.total}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
