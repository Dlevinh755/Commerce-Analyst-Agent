import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

export default function ProtectedRoute() {
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const isHydrated = useAuth((state) => state.isHydrated);
  const location = useLocation();

  // If user is already authenticated in memory, let route render immediately.
  if (!isHydrated && !isAuthenticated) {
    return <div className="container-page py-6 text-sm text-slate-500">Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
