import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Toast from '../../components/common/Toast';
import { sellerProductService } from '../../services/sellerProductService';
import { getErrorMessage } from '../../utils/errorMessage';
import { formatCurrencyVND } from '../../utils/currency';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=300&q=60';

export default function SellerProductsPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [hidingId, setHidingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await sellerProductService.listMine();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải sản phẩm của bạn.'));
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

  const onToggleVisibility = async (product) => {
    setHidingId(product.book_id);
    try {
      const nextHidden = !product.is_hidden;
      await sellerProductService.setVisibility(product.book_id, nextHidden);
      await loadProducts();
      setToast(nextHidden ? `Đã ẩn ${product.title}.` : `Đã bỏ ẩn ${product.title}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Cập nhật trạng thái ẩn thất bại.'));
    } finally {
      setHidingId(null);
    }
  };

  const onHardDelete = async (product) => {
    const confirmed = window.confirm(`Bạn có chắc muốn xóa vĩnh viễn "${product.title}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(product.book_id);
    try {
      await sellerProductService.hardDelete(product.book_id);
      setProducts((prev) => prev.filter((item) => item.book_id !== product.book_id));
      setToast(`Đã xóa vĩnh viễn ${product.title}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Xóa sản phẩm thất bại.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sản phẩm của tôi</h1>
          <p className="mt-1 text-slate-600">Quản lý các sản phẩm bạn đã đăng bán.</p>
        </div>
        <Link to="/seller/products/new" className="btn-primary">
          Thêm sản phẩm
        </Link>
      </div>

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="card">Đang tải sản phẩm...</div>
      ) : products.length === 0 ? (
        <div className="card text-slate-600">
          Chưa có sản phẩm. Hãy tạo sản phẩm đầu tiên bằng nút Thêm sản phẩm.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Ảnh</th>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Tác giả</th>
                <th className="px-4 py-3 text-left font-medium">Giá</th>
                <th className="px-4 py-3 text-left font-medium">Tồn kho</th>
                <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.book_id}>
                  <td className="px-4 py-3">
                    <div className="h-16 w-12 overflow-hidden rounded border border-slate-200 bg-slate-100">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = FALLBACK_COVER;
                          }}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="max-w-[240px] px-4 py-3 truncate">{product.title}</td>
                  <td className="px-4 py-3 text-slate-600">{product.author}</td>
                  <td className="px-4 py-3">{formatCurrencyVND(product.price)}</td>
                  <td className="px-4 py-3">{product.stock_quantity}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <p>Kích hoạt: {product.is_active ? 'Có' : 'Không'}</p>
                    <p>Ẩn: {product.is_hidden ? 'Có' : 'Không'}</p>
                    <p>Đã mua: {product.purchase_count || 0}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/seller/products/${product.book_id}/edit`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium"
                      >
                        Sửa
                      </Link>
                      <button
                        type="button"
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          product.is_hidden ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700'
                        }`}
                        onClick={() => onToggleVisibility(product)}
                        disabled={hidingId === product.book_id}
                      >
                        {hidingId === product.book_id
                          ? 'Đang cập nhật...'
                          : product.is_hidden
                            ? 'Bỏ ẩn'
                            : 'Ẩn'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700"
                        onClick={() => onHardDelete(product)}
                        disabled={deletingId === product.book_id || Number(product.purchase_count || 0) > 0}
                        title={
                          Number(product.purchase_count || 0) > 0
                            ? 'Sản phẩm đã có lịch sử mua, không thể xóa vĩnh viễn. Hãy dùng Ẩn.'
                            : undefined
                        }
                      >
                        {deletingId === product.book_id ? 'Đang xóa...' : 'Xóa'}
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
