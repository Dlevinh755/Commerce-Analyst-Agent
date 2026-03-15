import { Link } from 'react-router-dom';

export default function SellerDashboardPage() {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Seller Dashboard</h1>
        <p className="mt-1 text-slate-600">Manage your catalog and keep products ready for buyers.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/seller/products" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Catalog Management</h2>
          <p className="mt-2 text-sm text-slate-600">
            Review your product list, edit existing items, and remove outdated products.
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
