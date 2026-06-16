import { Outlet, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NotificationCenter from '../components/NotificationCenter';
import ConnectionStatus from '../components/ConnectionStatus';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';
import {
  LayoutDashboard, Users, Building2, FileText, Tag, Layers,
  Siren, BarChart3, Map, Settings, Users2, ShieldCheck,
  LogOut,
} from 'lucide-react';

const navLinks = [
  { to: '/admin/dashboard',    icon: LayoutDashboard, label: 'Dashboard'       },
  { to: '/admin/users',        icon: Users,           label: 'Users'           },
  { to: '/admin/authorities',  icon: Building2,       label: 'Authorities'     },
  { to: '/admin/reports',      icon: FileText,        label: 'Reports'         },
  { to: '/admin/categories',   icon: Tag,             label: 'Categories'      },
  { to: '/admin/specializations', icon: Layers,       label: 'Specializations' },
  { to: '/admin/communities',  icon: Users2,          label: 'Communities'     },
  { to: '/admin/sos',          icon: Siren,           label: 'SOS Monitor',  sos: true },
  { to: '/admin/analytics',    icon: BarChart3,       label: 'Analytics'       },
  { to: '/admin/map',          icon: Map,             label: 'System Map'      },
];

export default function AdminLayout() {
  const user = useAuthStore((state) => state.user);

  const isSuperAdmin = Array.isArray(user?.role)
    ? user.role.includes('SuperAdmin')
    : user?.role === 'SuperAdmin';

  /* Pull live SOS count for badge */
  const { data: summary } = useQuery({
    queryKey: ['admin', 'dashboard-summary'],
    queryFn:  () => apiClient.get('/api/admin/dashboard-summary').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const activeSOS: number = summary?.activeSOS ?? 0;

  /* System health color */
  const health = (summary?.systemHealth ?? 'operational').toLowerCase();
  const healthColor =
    health === 'operational' ? 'text-emerald-400' :
    health === 'degraded'    ? 'text-amber-400'   : 'text-red-400';

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 hidden md:flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">AIN Admin</span>
          {isSuperAdmin && (
            <span className="ml-auto text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/20">
              ROOT
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navLinks.map(({ to, icon: Icon, label, sos }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-white'}`} />
                  <span className="flex-1">{label}</span>
                  {sos && activeSOS > 0 && (
                    <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-red-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                      {activeSOS}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          {isSuperAdmin && (
            <NavLink
              to="/superadmin/roles"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mt-4 border border-dashed transition-all ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                    : 'text-amber-500/70 border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-400'
                }`
              }
            >
              <Settings className="w-4 h-4" />
              <span>Role Management</span>
            </NavLink>
          )}
        </nav>

        {/* Super admin footer */}
        {isSuperAdmin && (
          <div className="p-3 border-t border-gray-800 bg-amber-950/20">
            <p className="text-[10px] font-bold text-amber-500 tracking-widest uppercase text-center">
              ⭐ Super Admin Mode
            </p>
          </div>
        )}
        {/* Profile Footer - Admin */}
        <div className="mt-auto border-t border-gray-800 p-4 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(user?.displayName ?? 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.displayName ?? 'Admin'}</p>
              <p className="text-[10px] text-gray-500 truncate">{isSuperAdmin ? 'Super Admin' : 'Admin'}</p>
            </div>
            <button onClick={() => { useAuthStore.getState().logout(); window.location.href = '/login'; }} className="text-gray-500 hover:text-red-400 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden md:flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${activeSOS > 0 ? 'bg-red-400 animate-pulse' : health === 'operational' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`text-xs font-medium ${healthColor}`}>
                {health === 'operational' ? 'All Systems Operational' : `System ${health}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeSOS > 0 && (
              <NavLink to="/admin/sos" className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-red-500/20 transition-colors">
                <Siren className="w-3.5 h-3.5" />
                {activeSOS} Active SOS
              </NavLink>
            )}
            <ConnectionStatus />
            <NotificationCenter />
            <div className="flex items-center gap-2 pl-3 border-l border-gray-700">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold">
                {(user?.displayName ?? user?.email ?? 'A')[0].toUpperCase()}
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-semibold text-white leading-none">{user?.displayName ?? user?.email ?? 'Admin'}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{isSuperAdmin ? 'Super Admin' : 'Administrator'}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}