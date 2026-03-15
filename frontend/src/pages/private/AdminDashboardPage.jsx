import { Link } from 'react-router-dom';
import AdminSectionNav from '../../components/admin/AdminSectionNav';

export default function AdminDashboardPage() {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="mt-1 text-slate-600">
          Use separate sections to manage buyers, sellers, products, and orders.
        </p>
      </div>

      <AdminSectionNav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/admin/buyers" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Buyers</h2>
          <p className="mt-2 text-sm text-slate-600">View buyer accounts, account numbers, balances and status.</p>
        </Link>

        <Link to="/admin/sellers" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Sellers</h2>
          <p className="mt-2 text-sm text-slate-600">View seller balances and account numbers, activate or hide users.</p>
        </Link>

        <Link to="/admin/products" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Products</h2>
          <p className="mt-2 text-sm text-slate-600">Manage product visibility, active status, and soft delete.</p>
        </Link>

        <Link to="/admin/orders" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Orders</h2>
          <p className="mt-2 text-sm text-slate-600">Update order statuses and monitor checkout flow.</p>
        </Link>
      </div>
    </section>
  );
}
