import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import useAuth from '../../hooks/useAuth';

export default function ProtectedRoute() {
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const isHydrated = useAuth((state) => state.isHydrated);
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const profileRefreshStartedRef = useRef(false);
  const location = useLocation();

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || profileRefreshStartedRef.current) {
      return;
    }

    profileRefreshStartedRef.current = true;
    fetchProfile().catch(() => {
      profileRefreshStartedRef.current = false;
    });
  }, [fetchProfile, isAuthenticated, isHydrated]);

  // If user is already authenticated in memory, let route render immediately.
  if (!isHydrated && !isAuthenticated) {
    return <div className="container-page py-6 text-sm text-slate-500">Đang tải phiên đăng nhập...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
