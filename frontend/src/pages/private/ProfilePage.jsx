import { useEffect, useMemo, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import useOrderStore from '../../store/orderStore';
import Toast from '../../components/common/Toast';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/errorMessage';
import { formatCurrencyVND } from '../../utils/currency';

export default function ProfilePage() {
  const user = useAuth((state) => state.user);
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const orders = useOrderStore((state) => state.orders);
  const payments = useOrderStore((state) => state.payments);
  const [accountNumber, setAccountNumber] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [toast, setToast] = useState('');

  const canUpdateAccountNumber = useMemo(
    () => user?.role === 'buyer' || user?.role === 'seller',
    [user?.role]
  );
  const roleLabel = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'admin') return 'Quản trị viên';
    if (role === 'seller') return 'Người bán';
    if (role === 'buyer') return 'Người mua';
    return 'Thành viên';
  }, [user?.role]);
  const roleClassName = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'admin') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
    if (role === 'seller') return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
    return 'bg-brand-100 text-brand-700 ring-1 ring-brand-200';
  }, [user?.role]);
  const displayName = useMemo(() => user?.full_name?.trim() || user?.username || 'User', [user?.full_name, user?.username]);
  const initials = useMemo(
    () =>
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'U',
    [displayName]
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
      setToast('Cập nhật số tài khoản thành công.');
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể cập nhật số tài khoản.'));
    } finally {
      setSavingAccount(false);
    }
  };

  if (!user) {
    return <div className="card">Đang tải hồ sơ...</div>;
  }

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-50 via-white to-slate-50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-xl font-bold text-brand-700 shadow-sm ring-1 ring-brand-100 sm:h-20 sm:w-20 sm:text-2xl">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Hồ sơ của tôi</h1>
              <p className="mt-1 text-sm text-slate-600">{displayName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleClassName}`}>{roleLabel}</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{user.email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <article className="card p-0">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-semibold text-slate-900">Thông tin tài khoản</h2>
              <p className="mt-1 text-sm text-slate-500">Thông tin cơ bản và cài đặt thanh toán.</p>
            </div>

            <dl className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tên đăng nhập</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{user.username}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Họ tên</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{displayName}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{user.email}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số tài khoản</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{user.account_number || '-'}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số dư hiện tại</dt>
                <dd className="mt-1 text-2xl font-bold leading-none text-slate-900">{formatCurrencyVND(user.balance)}</dd>
              </div>
            </dl>
          </article>

          {canUpdateAccountNumber ? (
            <form className="card space-y-3" onSubmit={onSubmitAccountNumber}>
              <div>
                <p className="text-sm font-semibold text-slate-900">Cập nhật số tài khoản</p>
                <p className="mt-1 text-xs text-slate-500">
                Số tài khoản này dùng để đối soát thanh toán cho các đơn đã giao.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="input"
                  placeholder="Nhập số tài khoản"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  required
                />
                <button type="submit" className="btn-primary min-h-10 sm:w-auto" disabled={savingAccount}>
                  {savingAccount ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        <div className="space-y-5">
          <aside className="card">
            <h2 className="text-lg font-semibold text-slate-900">Tổng quan</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Đơn hàng</p>
                <p className="mt-2 text-2xl font-bold leading-none text-slate-900">{orders.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thanh toán</p>
                <p className="mt-2 text-2xl font-bold leading-none text-slate-900">{payments.length}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Link
                className="block rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                to="/orders"
              >
                Xem đơn hàng
              </Link>
              <Link
                className="block rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                to="/payments"
              >
                Xem thanh toán
              </Link>
            </div>
          </aside>

          <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
            <p className="text-sm font-semibold text-brand-700">Bảo mật tài khoản</p>
            <p className="mt-1 text-xs text-brand-700/90">
              Hãy giữ số tài khoản chính xác để đảm bảo đối soát và thanh toán đúng.
            </p>
          </div>
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
