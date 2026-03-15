import { useEffect, useState } from 'react';
import { sellerProductService } from '../../services/sellerProductService';
import Toast from '../../components/common/Toast';
import AdminSectionNav from '../../components/admin/AdminSectionNav';
import { getErrorMessage } from '../../utils/errorMessage';

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingProductId, setSavingProductId] = useState(null);
  const [toast, setToast] = useState('');

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await sellerProductService.listForAdmin({ page: 1, page_size: 100 });
      setProducts(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load products.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const onProductPatch = async (bookId, patch, successMessage) => {
    setSavingProductId(bookId);
    try {
      const { data } = await sellerProductService.updateAsAdmin(bookId, patch);
      setProducts((prev) => prev.map((item) => (item.book_id === bookId ? data : item)));
      setToast(successMessage);
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not update product.'));
    } finally {
      setSavingProductId(null);
    }
  };

  const onHideProduct = async (bookId) => {
    setSavingProductId(bookId);
    try {
      await sellerProductService.remove(bookId);
      setProducts((prev) =>
        prev.map((item) =>
          item.book_id === bookId ? { ...item, is_hidden: true, is_active: false } : item
        )
      );
      setToast('Product hidden successfully.');
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not hide product.'));
    } finally {
      setSavingProductId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Admin Products</h1>
        <p className="mt-1 text-slate-600">Control product visibility and active status.</p>
      </div>

      <AdminSectionNav />

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="card">Loading products...</div>
      ) : (
        <article className="card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Products</h2>
            <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadProducts}>
              Refresh
            </button>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">ID</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Seller</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.book_id}>
                  <td className="px-3 py-2">#{product.book_id}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{product.title}</p>
                    <p className="text-xs text-slate-500">{product.author}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <p>ID: {product.seller_id}</p>
                    <p className="text-slate-500">{product.seller_username || '-'}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <p>Active: {product.is_active ? 'Yes' : 'No'}</p>
                    <p>Hidden: {product.is_hidden ? 'Yes' : 'No'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs"
                        onClick={() =>
                          onProductPatch(
                            product.book_id,
                            { is_active: !product.is_active },
                            product.is_active ? 'Product deactivated.' : 'Product activated.'
                          )
                        }
                        disabled={savingProductId === product.book_id}
                      >
                        {product.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs"
                        onClick={() =>
                          onProductPatch(
                            product.book_id,
                            { is_hidden: !product.is_hidden },
                            product.is_hidden ? 'Product unhidden.' : 'Product hidden.'
                          )
                        }
                        disabled={savingProductId === product.book_id}
                      >
                        {product.is_hidden ? 'Unhide' : 'Hide'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700"
                        onClick={() => onHideProduct(product.book_id)}
                        disabled={savingProductId === product.book_id || product.is_hidden}
                      >
                        {product.is_hidden ? 'Hidden' : 'Soft Delete'}
                      </button>
                    </div>
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
