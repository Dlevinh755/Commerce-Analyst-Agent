import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getDefaultRouteByRole } from '../../utils/role';
import { getErrorMessage } from '../../utils/errorMessage';
import HeroBookStack from '../../components/common/HeroBookStack';

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
      setError(getErrorMessage(err, 'Đăng nhập thất bại'));
    }
  };

  return (
    <section className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border-2 border-stone-200 bg-white shadow-md md:grid-cols-2">
      <div className="relative flex flex-col justify-between bg-gradient-to-br from-surface-warm via-orange-50 to-amber-50 p-8">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">Chào mừng bạn quay lại</h1>
          <p className="mt-3 font-semibold text-stone-600">
            Đăng nhập để tiếp tục mua sắm, quản lý giỏ hàng và theo dõi đơn hàng.
          </p>
        </div>
        <HeroBookStack className="mt-8 hidden sm:flex" />
      </div>

      <div className="p-8">
        <h2 className="text-2xl font-bold text-ink">Đăng nhập</h2>
        {infoMessage ? (
          <div className="mt-3 rounded-md border-2 border-amber-200 bg-amber-50 p-2 text-sm font-semibold text-amber-800">
            {infoMessage}
          </div>
        ) : null}
        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <input
            className="input"
            placeholder="Tên người dùng"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="Mật khẩu"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          <button className="btn-primary w-full" type="submit" disabled={Boolean(isLoading)}>
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
        <p className="mt-4 text-sm font-semibold text-stone-600">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-bold text-brand-700 hover:text-brand-500">
            Đăng ký
          </Link>
        </p>
      </div>
    </section>
  );
}
