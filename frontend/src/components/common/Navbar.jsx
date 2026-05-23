import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useCart from '../../hooks/useCart';
import { getDefaultRouteByRole, normalizeRole } from '../../utils/role';

const baseLinkClass =
  'group inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900';

function NavItem({ to, children, badge, icon, className }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${baseLinkClass} ${
          isActive ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100' : ''
        } ${className || ''}`
      }
    >
      <span className="text-slate-500 transition group-hover:text-slate-700">{icon}</span>
      <span>{children}</span>
      {badge ? (
        <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">{badge}</span>
      ) : null}
    </NavLink>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const logout = useAuth((state) => state.logout);
  const user = useAuth((state) => state.user);
  const totalItems = useCart((state) => state.totalItems());
  const role = normalizeRole(user?.role);
  const dashboardPath = getDefaultRouteByRole(role);

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="container-page flex min-h-16 flex-col gap-2 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <Link to="/" className="text-3xl font-bold leading-none text-slate-800 sm:text-4xl">
          Book Store
        </Link>

        <nav className="flex w-full flex-wrap items-center justify-start gap-1.5 rounded-full border border-slate-200 bg-white p-1.5 shadow-sm sm:w-auto sm:justify-end">
          <NavItem
            to="/books"
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 5a2 2 0 0 1 2-2h12v17H6a2 2 0 0 0-2 2V5z" />
                <path d="M18 17H6a2 2 0 0 0-2 2" />
              </svg>
            }
          >
            Sách
          </NavItem>

          {isAuthenticated ? (
            <>
              <NavItem
                to={dashboardPath}
                icon={
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 13h8V3H3v10z" />
                    <path d="M13 21h8V11h-8v10z" />
                    <path d="M13 3h8v6h-8V3z" />
                    <path d="M3 17h8v4H3v-4z" />
                  </svg>
                }
              >
                AI Assistant
              </NavItem>

              {role === 'buyer' ? (
                <>
                  <NavItem
                    to="/cart"
                    badge={totalItems > 0 ? totalItems : undefined}
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="9" cy="20" r="1" />
                        <circle cx="18" cy="20" r="1" />
                        <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h9.8a1 1 0 0 0 1-.8L21 7H7" />
                      </svg>
                    }
                  >
                    Giỏ hàng
                  </NavItem>
                  <NavItem
                    to="/orders"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <path d="M8 9h8M8 13h8M8 17h5" />
                      </svg>
                    }
                  >
                    Đơn hàng
                  </NavItem>
                  <NavItem
                    to="/payments"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <path d="M2 10h20" />
                      </svg>
                    }
                  >
                    Thanh toán
                  </NavItem>
                </>
              ) : null}

              {role === 'seller' ? (
                <>
                  <NavItem
                    to="/seller/orders"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <path d="M8 9h8M8 13h8M8 17h5" />
                      </svg>
                    }
                  >
                    Đơn hàng
                  </NavItem>
                  <NavItem
                    to="/seller/products"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 7L12 3 4 7l8 4 8-4z" />
                        <path d="M4 7v10l8 4 8-4V7" />
                      </svg>
                    }
                  >
                    Sản phẩm của tôi
                  </NavItem>
                </>
              ) : null}

              {role === 'admin' ? (
                <>
                  <NavItem
                    to="/admin/buyers"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                      </svg>
                    }
                  >
                    Người mua
                  </NavItem>
                  <NavItem
                    to="/admin/sellers"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    }
                  >
                    Người bán
                  </NavItem>
                  <NavItem
                    to="/admin/products"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 7L12 3 4 7l8 4 8-4z" />
                        <path d="M4 7v10l8 4 8-4V7" />
                      </svg>
                    }
                  >
                    Sản phẩm
                  </NavItem>
                  <NavItem
                    to="/admin/orders"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <path d="M8 9h8M8 13h8M8 17h5" />
                      </svg>
                    }
                  >
                    Đơn hàng
                  </NavItem>
                </>
              ) : null}

              <NavItem
                to="/profile"
                className="hidden sm:inline-flex"
                icon={
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
              >
                Hồ sơ
              </NavItem>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <NavItem
                to="/login"
                icon={
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 17l5-5-5-5" />
                    <path d="M15 12H3" />
                    <path d="M21 19V5a2 2 0 0 0-2-2h-5" />
                  </svg>
                }
              >
                Đăng nhập
              </NavItem>
              <NavLink to="/register" className="btn-primary inline-flex items-center rounded-full px-4 py-2 text-sm">
                Đăng ký
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
