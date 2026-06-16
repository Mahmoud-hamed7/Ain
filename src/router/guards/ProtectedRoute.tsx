import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import SignalRProvider from '../../providers/SignalRProvider';

/**
 * ProtectedRoute — Guards unauthenticated access and mounts the SignalR
 * provider for the entire authenticated session.
 */
export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <SignalRProvider>
      <Outlet />
    </SignalRProvider>
  );
}