import { useEffect, useState } from 'react';
import { authService } from '../../services/authService';
import Toast from '../../components/common/Toast';
import AdminSectionNav from '../../components/admin/AdminSectionNav';
import { getErrorMessage } from '../../utils/errorMessage';

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
      setError(getErrorMessage(err, 'Could not load sellers.'));
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
      setToast(getErrorMessage(err, 'Could not update seller.'));
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
      setToast('Seller hidden successfully.');
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not hide seller.'));
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Admin Sellers</h1>
        <p className="mt-1 text-slate-600">Review seller accounts, account numbers and current balances.</p>
      </div>

      <AdminSectionNav />

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="card">Loading sellers...</div>
      ) : (
        <article className="card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Sellers</h2>
            <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadSellers}>
              Refresh
            </button>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">ID</th>
                <th className="px-3 py-2 text-left font-medium">User</th>
                <th className="px-3 py-2 text-left font-medium">Account Number</th>
                <th className="px-3 py-2 text-left font-medium">Balance</th>
                <th className="px-3 py-2 text-left font-medium">Flags</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
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
                  <td className="px-3 py-2 font-medium">${Number(seller.balance || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <p>Active: {seller.is_active ? 'Yes' : 'No'}</p>
                    <p>Hidden: {seller.is_hidden ? 'Yes' : 'No'}</p>
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
                            seller.is_active ? 'Seller deactivated.' : 'Seller activated.'
                          )
                        }
                        disabled={savingUserId === seller.user_id}
                      >
                        {seller.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700"
                        onClick={() => onHideSeller(seller.user_id)}
                        disabled={savingUserId === seller.user_id || seller.is_hidden}
                      >
                        {seller.is_hidden ? 'Hidden' : 'Hide'}
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
