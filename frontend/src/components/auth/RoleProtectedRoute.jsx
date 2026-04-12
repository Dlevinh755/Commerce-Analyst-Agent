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

  console.log('[RoleProtectedRoute]', {
    path: location.pathname,
    isHydrated,
    isAuthenticated,
    userRole: user?.role,
    allowedRoles,
  });

  // Wait for store to hydrate from localStorage before checking permissions
  if (!isHydrated) {
    console.log('[RoleProtectedRoute] Not hydrated yet, rendering outlet');
    return <Outlet />;
  }

  if (!isAuthenticated) {
    console.log('[RoleProtectedRoute] Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const normalizedRole = normalizeRole(user?.role);
  const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role));

  console.log('[RoleProtectedRoute] Checking role', { normalizedRole, normalizedAllowedRoles });

  if (!normalizedAllowedRoles.includes(normalizedRole)) {
    console.log('[RoleProtectedRoute] Role not allowed, redirecting to profile');
    return <Navigate to="/profile" replace />;
  }

  console.log('[RoleProtectedRoute] Access granted, rendering outlet');
  return <Outlet />;
}
