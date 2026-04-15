import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

export default function RoleProtectedRoute({ allowedRoles = [] }) {
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const isHydrated = useAuth((state) => state.isHydrated);
  const user = useAuth((state) => state.user);
  const location = useLocation();

  // If user is already authenticated in memory, let route render immediately.
  if (!isHydrated && !isAuthenticated) {
    return <div className="container-page py-6 text-sm text-slate-500">Đang tải phiên đăng nhập...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const normalizedRole = normalizeRole(user?.role);
  const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role));

  if (!normalizedAllowedRoles.includes(normalizedRole)) {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
}
