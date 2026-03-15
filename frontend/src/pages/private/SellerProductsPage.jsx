import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Toast from '../../components/common/Toast';
import { sellerProductService } from '../../services/sellerProductService';
import { getErrorMessage } from '../../utils/errorMessage';

export default function SellerProductsPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [hidingId, setHidingId] = useState(null);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await sellerProductService.listMine();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your products.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (location.state?.message) {
      setToast(location.state.message);
    }
  }, [location.state]);

  const onHide = async (product) => {
    setHidingId(product.book_id);
    try {
      await sellerProductService.remove(product.book_id);
      setProducts((prev) =>
        prev.map((item) =>
          item.book_id === product.book_id ? { ...item, is_hidden: true, is_active: false } : item
        )
      );
      setToast(`Hidden ${product.title}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Hide failed.'));
    } finally {
      setHidingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Products</h1>
          <p className="mt-1 text-slate-600">Manage products you published as a seller.</p>
        </div>
        <Link to="/seller/products/new" className="btn-primary">
          Add Product
        </Link>
      </div>

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="card">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="card text-slate-600">
          No products yet. Create your first product from the Add Product button.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Author</th>
                <th className="px-4 py-3 text-left font-medium">Price</th>
                <th className="px-4 py-3 text-left font-medium">Stock</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.book_id}>
                  <td className="px-4 py-3">{product.title}</td>
                  <td className="px-4 py-3 text-slate-600">{product.author}</td>
                  <td className="px-4 py-3">${Number(product.price).toFixed(2)}</td>
                  <td className="px-4 py-3">{product.stock_quantity}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <p>Active: {product.is_active ? 'Yes' : 'No'}</p>
                    <p>Hidden: {product.is_hidden ? 'Yes' : 'No'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/seller/products/${product.book_id}/edit`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700"
                        onClick={() => onHide(product)}
                        disabled={hidingId === product.book_id || product.is_hidden}
                      >
                        {product.is_hidden ? 'Hidden' : hidingId === product.book_id ? 'Hiding...' : 'Hide'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
