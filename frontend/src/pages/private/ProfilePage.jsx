import { useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import useOrderStore from '../../store/orderStore';

export default function ProfilePage() {
  const user = useAuth((state) => state.user);
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const logout = useAuth((state) => state.logout);
  const orders = useOrderStore((state) => state.orders);
  const payments = useOrderStore((state) => state.payments);

  useEffect(() => {
    if (!user) {
      fetchProfile().catch(() => {});
    }
  }, [user, fetchProfile]);

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
          </dl>
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
    </section>
  );
}
