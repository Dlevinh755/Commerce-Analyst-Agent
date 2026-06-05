import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errorMessage';

export default function RegisterPage() {
  const register = useAuth((state) => state.register);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: 'buyer',
  });

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/login');
    } catch (err) {
      setError(getErrorMessage(err, 'Đăng ký thất bại'));
    }
  };

  return (
    <section className="mx-auto max-w-lg card">
      <h1 className="text-3xl font-extrabold text-ink">Tạo tài khoản của bạn</h1>
      <p className="mt-2 font-semibold text-stone-600">Tham gia ngay để lưu giỏ hàng, thanh toán và quản lý đơn hàng.</p>

      <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
        <input
          className="input sm:col-span-1"
          placeholder="Tên người dùng"
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          className="input sm:col-span-1"
          type="email"
          placeholder="Email"
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="input sm:col-span-2"
          placeholder="Họ và tên"
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <input
          className="input sm:col-span-2"
          type="password"
          placeholder="Mật khẩu"
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <label className="sm:col-span-2 text-sm font-semibold text-stone-600" htmlFor="role">
          Loại tài khoản
        </label>
        <select
          id="role"
          className="input sm:col-span-2"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="buyer">Người mua</option>
          <option value="seller">Người bán</option>
        </select>
        {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
        <button className="btn-primary w-full sm:col-span-2" type="submit">
          Tạo tài khoản
        </button>
      </form>

      <p className="mt-4 text-sm font-semibold text-stone-600">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-bold text-brand-700">
          Đăng nhập
        </Link>
      </p>
    </section>
  );
}
