import { useEffect, useState } from 'react';
import { authService } from '../../services/authService';
import Toast from '../../components/common/Toast';
import AdminSectionNav from '../../components/admin/AdminSectionNav';
import { getErrorMessage } from '../../utils/errorMessage';
import { formatCurrencyVND } from '../../utils/currency';

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingUserId, setSavingUserId] = useState(null);
  const [toast, setToast] = useState('');

  const loadSellers = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await authService.listUsers({ role: 'seller', page: 1, page_size: 100 });
      setSellers(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách người bán.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, []);

  const onPatchSeller = async (userId, patch, successMessage) => {
    setSavingUserId(userId);
    try {
      const { data } = await authService.updateUser(userId, patch);
      setSellers((prev) => prev.map((item) => (item.user_id === userId ? data : item)));
      setToast(successMessage);
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể cập nhật người bán.'));
    } finally {
      setSavingUserId(null);
    }
  };

  const onHideSeller = async (userId) => {
    setSavingUserId(userId);
    try {
      await authService.hideUser(userId);
      setSellers((prev) =>
        prev.map((item) =>
          item.user_id === userId ? { ...item, is_hidden: true, is_active: false } : item
        )
      );
      setToast('Đã ẩn người bán thành công.');
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể ẩn người bán.'));
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Quản lý người bán</h1>
        <p className="mt-1 text-slate-600">Xem tài khoản người bán, số tài khoản và số dư hiện tại.</p>
      </div>

      <AdminSectionNav />

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="card">Đang tải danh sách người bán...</div>
      ) : (
        <article className="card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Người bán</h2>
            <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadSellers}>
              Làm mới
            </button>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">ID</th>
                <th className="px-3 py-2 text-left font-medium">Tài khoản</th>
                <th className="px-3 py-2 text-left font-medium">Số tài khoản</th>
                <th className="px-3 py-2 text-left font-medium">Số dư</th>
                <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
                <th className="px-3 py-2 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sellers.map((seller) => (
                <tr key={seller.user_id}>
                  <td className="px-3 py-2">#{seller.user_id}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{seller.username}</p>
                    <p className="text-xs text-slate-500">{seller.email}</p>
                  </td>
                  <td className="px-3 py-2">{seller.account_number || '-'}</td>
                  <td className="px-3 py-2 font-medium">{formatCurrencyVND(seller.balance)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <p>Kích hoạt: {seller.is_active ? 'Có' : 'Không'}</p>
                    <p>Ẩn: {seller.is_hidden ? 'Có' : 'Không'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs"
                        onClick={() =>
                          onPatchSeller(
                            seller.user_id,
                            { is_active: !seller.is_active },
                            seller.is_active ? 'Đã tắt người bán.' : 'Đã kích hoạt người bán.'
                          )
                        }
                        disabled={savingUserId === seller.user_id}
                      >
                        {seller.is_active ? 'Tắt' : 'Kích hoạt'}
                      </button>
                      <button
                        type="button"
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          seller.is_hidden
                            ? 'border-green-300 text-green-700'
                            : 'border-red-300 text-red-700'
                        }`}
                        onClick={() =>
                          seller.is_hidden
                            ? onPatchSeller(seller.user_id, { is_hidden: false }, 'Đã hiện lại người bán.')
                            : onHideSeller(seller.user_id)
                        }
                        disabled={savingUserId === seller.user_id}
                      >
                        {seller.is_hidden ? 'Hiện lại' : 'Ẩn'}
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
