import { Link, NavLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useCart from '../../hooks/useCart';
import { getDefaultRouteByRole, normalizeRole } from '../../utils/role';

const baseLinkClass = 'rounded-md px-3 py-2 text-sm font-medium';

export default function Navbar() {
  const { isAuthenticated, logout, user } = useAuth();
  const totalItems = useCart((state) => state.totalItems());
  const role = normalizeRole(user?.role);
  const dashboardPath = getDefaultRouteByRole(role);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container-page flex min-h-16 flex-col gap-2 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <Link to="/" className="text-xl font-bold text-brand-700">
          Bookstore
        </Link>

        <nav className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:justify-end">
          <NavLink
            to="/books"
            className={({ isActive }) =>
              `${baseLinkClass} ${isActive ? 'bg-slate-100 text-brand-700' : 'text-slate-700'}`
            }
          >
            Books
          </NavLink>

          {isAuthenticated ? (
            <>

              {role === 'buyer' ? (
                <>
                  <NavLink
                    to="/cart"
                    className={({ isActive }) =>
                      `${baseLinkClass} ${isActive ? 'bg-slate-100 text-brand-700' : 'text-slate-700'}`
                    }
                  >
                    Cart ({totalItems})
                  </NavLink>
                  <NavLink
                    to="/orders"
                    className={({ isActive }) =>
                      `${baseLinkClass} ${isActive ? 'bg-slate-100 text-brand-700' : 'text-slate-700'}`
                    }
                  >
                    Orders
                  </NavLink>
                  <NavLink
                    to="/payments"
                    className={({ isActive }) =>
                      `${baseLinkClass} ${isActive ? 'bg-slate-100 text-brand-700' : 'text-slate-700'}`
                    }
                  >
                    Payments
                  </NavLink>
                </>
              ) : null}

              {role === 'seller' ? (
                <>
                  <NavLink
                    to="/seller/products"
                    className={({ isActive }) =>
                      `${baseLinkClass} ${isActive ? 'bg-slate-100 text-brand-700' : 'text-slate-700'}`
                    }
                  >
                    My Products
                  </NavLink>
                </>
              ) : null}

              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `${baseLinkClass} ${isActive ? 'bg-slate-100 text-brand-700' : 'text-slate-700'}`
                }
              >
                Profile
              </NavLink>
              <button type="button" onClick={logout} className="btn-primary">
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={baseLinkClass}>
                Login
              </NavLink>
              <NavLink to="/register" className="btn-primary">
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
