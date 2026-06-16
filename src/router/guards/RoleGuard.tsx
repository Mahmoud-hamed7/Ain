import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function RoleGuard({ allowedRoles }: { allowedRoles: string[] }) {
  const isRole = useAuthStore((state) => state.isRole);
  
  if (!isRole(...allowedRoles)) return <Navigate to="/unauthorized" replace />;
  
  return <Outlet />;
}