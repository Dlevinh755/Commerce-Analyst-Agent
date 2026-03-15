import { useEffect, useMemo, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import useOrderStore from '../../store/orderStore';
import Toast from '../../components/common/Toast';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/errorMessage';

export default function ProfilePage() {
  const user = useAuth((state) => state.user);
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const logout = useAuth((state) => state.logout);
  const orders = useOrderStore((state) => state.orders);
  const payments = useOrderStore((state) => state.payments);
  const [accountNumber, setAccountNumber] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [toast, setToast] = useState('');

  const canUpdateAccountNumber = useMemo(
    () => user?.role === 'buyer' || user?.role === 'seller',
    [user?.role]
  );

  useEffect(() => {
    if (!user) {
      fetchProfile().catch(() => {});
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    setAccountNumber(user?.account_number || '');
  }, [user?.account_number]);

  const onSubmitAccountNumber = async (event) => {
    event.preventDefault();
    setSavingAccount(true);
    try {
      await authService.updateMyAccountNumber({ account_number: accountNumber.trim() });
      await fetchProfile();
      setToast('Account number updated successfully.');
    } catch (err) {
      setToast(getErrorMessage(err, 'Could not update account number.'));
    } finally {
      setSavingAccount(false);
    }
  };

  if (!user) {
    return <div className="card">Loading profile...</div>;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={logout}>
          Logout
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <h2 className="text-lg font-semibold">Account Information</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Username</dt>
              <dd className="font-medium">{user.username}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Full Name</dt>
              <dd className="font-medium">{user.full_name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd className="font-medium capitalize">{user.role}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Account Number</dt>
              <dd className="font-medium">{user.account_number || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Current Balance</dt>
              <dd className="font-medium">${Number(user.balance || 0).toFixed(2)}</dd>
            </div>
          </dl>

          {canUpdateAccountNumber ? (
            <form className="mt-5 rounded-lg border border-slate-200 p-4" onSubmit={onSubmitAccountNumber}>
              <p className="text-sm font-medium">Update Account Number</p>
              <p className="mt-1 text-xs text-slate-500">
                This account number is used for payment settlement on delivered orders.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="input"
                  placeholder="Enter account number"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  required
                />
                <button type="submit" className="btn-primary sm:w-auto" disabled={savingAccount}>
                  {savingAccount ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold">Quick Overview</h2>
          <p className="mt-4 text-sm text-slate-600">Orders: <span className="font-semibold">{orders.length}</span></p>
          <p className="mt-1 text-sm text-slate-600">Payments: <span className="font-semibold">{payments.length}</span></p>
          <div className="mt-4 space-y-2">
            <Link className="block rounded-md border border-slate-300 px-3 py-2 text-sm" to="/orders">
              View orders
            </Link>
            <Link className="block rounded-md border border-slate-300 px-3 py-2 text-sm" to="/payments">
              View payments
            </Link>
          </div>
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
