import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getDefaultRouteByRole } from '../../utils/role';
import { getErrorMessage } from '../../utils/errorMessage';

export default function LoginPage() {
  const login = useAuth((state) => state.login);
  const isLoading = useAuth((state) => state.isLoading);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;
  const infoMessage = location.state?.message || '';

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const auth = await login(form);
      const destination = from || getDefaultRouteByRole(auth?.user?.role);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'));
    }
  };

  return (
    <section className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-2">
      <div className="bg-gradient-to-br from-brand-700 to-brand-500 p-8 text-white">
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="mt-3 text-brand-100">
          Login to continue shopping, manage cart, and track your orders.
        </p>
      </div>

      <div className="p-8">
        <h2 className="text-2xl font-semibold">Login</h2>
        {infoMessage ? (
          <div className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-700">{infoMessage}</div>
        ) : null}
        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <input
            className="input"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="btn-primary w-full" type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}
