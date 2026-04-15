import { useEffect, useState } from 'react';
import { authService } from '../../services/authService';
import Toast from '../../components/common/Toast';
import AdminSectionNav from '../../components/admin/AdminSectionNav';
import { getErrorMessage } from '../../utils/errorMessage';
import { formatCurrencyVND } from '../../utils/currency';

export default function AdminBuyersPage() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingUserId, setSavingUserId] = useState(null);
  const [toast, setToast] = useState('');

  const loadBuyers = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await authService.listUsers({ role: 'buyer', page: 1, page_size: 100 });
      setBuyers(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách người mua.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuyers();
  }, []);

  const onPatchBuyer = async (userId, patch, successMessage) => {
    setSavingUserId(userId);
    try {
      const { data } = await authService.updateUser(userId, patch);
      setBuyers((prev) => prev.map((item) => (item.user_id === userId ? data : item)));
      setToast(successMessage);
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể cập nhật người mua.'));
    } finally {
      setSavingUserId(null);
    }
  };

  const onHideBuyer = async (userId) => {
    setSavingUserId(userId);
    try {
      await authService.hideUser(userId);
      setBuyers((prev) =>
        prev.map((item) =>
          item.user_id === userId ? { ...item, is_hidden: true, is_active: false } : item
        )
      );
      setToast('Đã ẩn người mua thành công.');
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể ẩn người mua.'));
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Quản lý người mua</h1>
        <p className="mt-1 text-slate-600">Xem tài khoản người mua và theo dõi số dư.</p>
      </div>

      <AdminSectionNav />

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="card">Đang tải danh sách người mua...</div>
      ) : (
        <article className="card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Người mua</h2>
            <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadBuyers}>
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
              {buyers.map((buyer) => (
                <tr key={buyer.user_id}>
                  <td className="px-3 py-2">#{buyer.user_id}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{buyer.username}</p>
                    <p className="text-xs text-slate-500">{buyer.email}</p>
                  </td>
                  <td className="px-3 py-2">{buyer.account_number || '-'}</td>
                  <td className="px-3 py-2 font-medium">{formatCurrencyVND(buyer.balance)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <p>Kích hoạt: {buyer.is_active ? 'Có' : 'Không'}</p>
                    <p>Ẩn: {buyer.is_hidden ? 'Có' : 'Không'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs"
                        onClick={() =>
                          onPatchBuyer(
                            buyer.user_id,
                            { is_active: !buyer.is_active },
                            buyer.is_active ? 'Đã tắt người mua.' : 'Đã kích hoạt người mua.'
                          )
                        }
                        disabled={savingUserId === buyer.user_id}
                      >
                        {buyer.is_active ? 'Tắt' : 'Kích hoạt'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700"
                        onClick={() => onHideBuyer(buyer.user_id)}
                        disabled={savingUserId === buyer.user_id || buyer.is_hidden}
                      >
                        {buyer.is_hidden ? 'Đã ẩn' : 'Ẩn'}
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
