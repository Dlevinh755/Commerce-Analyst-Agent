import { Link } from 'react-router-dom';

export default function BuyerDashboardPage() {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Buyer Dashboard</h1>
        <p className="mt-1 text-slate-600">Manage your shopping journey in one place.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link className="card transition hover:-translate-y-0.5 hover:shadow-md" to="/books">
          <h2 className="text-lg font-semibold">Browse Books</h2>
          <p className="mt-2 text-sm text-slate-600">Discover new titles and best sellers.</p>
        </Link>

        <Link className="card transition hover:-translate-y-0.5 hover:shadow-md" to="/cart">
          <h2 className="text-lg font-semibold">My Cart</h2>
          <p className="mt-2 text-sm text-slate-600">Review items before checkout.</p>
        </Link>

        <Link className="card transition hover:-translate-y-0.5 hover:shadow-md" to="/orders">
          <h2 className="text-lg font-semibold">My Orders</h2>
          <p className="mt-2 text-sm text-slate-600">Track and inspect your order history.</p>
        </Link>
      </div>
    </section>
  );
}
