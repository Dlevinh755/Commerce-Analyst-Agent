import { useEffect, useState } from 'react';
import { authService } from '../../services/authService';
import Toast from '../../components/common/Toast';
import AdminSectionNav from '../../components/admin/AdminSectionNav';
import { getErrorMessage } from '../../utils/errorMessage';

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
      setError(getErrorMessage(err, 'Could not load buyers.'));
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
      setToast(getErrorMessage(err, 'Could not update buyer.'));
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
      setToast('Buyer hidden successfully.');
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not hide buyer.'));
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Admin Buyers</h1>
        <p className="mt-1 text-slate-600">Review buyer accounts and monitor balances.</p>
      </div>

      <AdminSectionNav />

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="card">Loading buyers...</div>
      ) : (
        <article className="card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Buyers</h2>
            <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadBuyers}>
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
              {buyers.map((buyer) => (
                <tr key={buyer.user_id}>
                  <td className="px-3 py-2">#{buyer.user_id}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{buyer.username}</p>
                    <p className="text-xs text-slate-500">{buyer.email}</p>
                  </td>
                  <td className="px-3 py-2">{buyer.account_number || '-'}</td>
                  <td className="px-3 py-2 font-medium">${Number(buyer.balance || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <p>Active: {buyer.is_active ? 'Yes' : 'No'}</p>
                    <p>Hidden: {buyer.is_hidden ? 'Yes' : 'No'}</p>
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
                            buyer.is_active ? 'Buyer deactivated.' : 'Buyer activated.'
                          )
                        }
                        disabled={savingUserId === buyer.user_id}
                      >
                        {buyer.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700"
                        onClick={() => onHideBuyer(buyer.user_id)}
                        disabled={savingUserId === buyer.user_id || buyer.is_hidden}
                      >
                        {buyer.is_hidden ? 'Hidden' : 'Hide'}
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
