import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function GuestRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (isAuthenticated && user) {
    const roles = Array.isArray(user.role) ? user.role : [user.role];
    if (roles.includes('SuperAdmin') || roles.includes('Admin')) return <Navigate to="/admin/dashboard" replace />;
    if (roles.includes('Authority')) return <Navigate to="/authority/dashboard" replace />;
    return <Navigate to="/citizen/feed" replace />;
  }

  return <Outlet />;
}