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
      setError(getErrorMessage(err, 'Register failed'));
    }
  };

  return (
    <section className="mx-auto max-w-lg card">
      <h1 className="text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-slate-600">Join now to save cart, checkout, and manage orders.</p>

      <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
        <input
          className="input sm:col-span-1"
          placeholder="Username"
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
          placeholder="Full name"
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <input
          className="input sm:col-span-2"
          type="password"
          placeholder="Password"
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <label className="sm:col-span-2 text-sm text-slate-600" htmlFor="role">
          Account role
        </label>
        <select
          id="role"
          className="input sm:col-span-2"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
        {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
        <button className="btn-primary w-full sm:col-span-2" type="submit">
          Create account
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        Already have account?{' '}
        <Link to="/login" className="font-medium text-brand-700">
          Login
        </Link>
      </p>
    </section>
  );
}
