import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

export default function ProtectedRoute() {
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const isHydrated = useAuth((state) => state.isHydrated);
  const location = useLocation();

  // Wait for store to hydrate from localStorage before checking authentication
  if (!isHydrated) {
    return <Outlet />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
