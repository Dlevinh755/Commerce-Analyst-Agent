import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

export default function SellerDashboardPage() {
  const user = useAuth((state) => state.user);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Seller Dashboard</h1>
        <p className="mt-1 text-slate-600">Manage your catalog and keep products ready for buyers.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/profile" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Account & Balance</h2>
          <p className="mt-2 text-sm text-slate-600">Account: {user?.account_number || '-'}</p>
          <p className="mt-1 text-sm text-slate-600">Balance: ${Number(user?.balance || 0).toFixed(2)}</p>
        </Link>

        <Link to="/seller/products" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Catalog Management</h2>
          <p className="mt-2 text-sm text-slate-600">
            Review your product list, edit existing items, and remove outdated products.
          </p>
        </Link>

        <Link to="/seller/orders" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Order Shipping</h2>
          <p className="mt-2 text-sm text-slate-600">
            View orders for your books and mark them as shipped when ready.
          </p>
        </Link>

        <Link to="/seller/products/new" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Create New Product</h2>
          <p className="mt-2 text-sm text-slate-600">
            Add a new book with title, price, stock, and optional metadata.
          </p>
        </Link>
      </div>
    </section>
  );
}
