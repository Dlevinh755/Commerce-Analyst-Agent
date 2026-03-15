import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

export default function RoleProtectedRoute({ allowedRoles = [] }) {
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const user = useAuth((state) => state.user);
  const location = useLocation();

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
