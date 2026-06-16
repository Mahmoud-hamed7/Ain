/**
 * CitizenLayout — Premium sidebar layout for the citizen dashboard.
 * Joins / leaves SignalR community groups on mount.
 */
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Newspaper, Map, FileText, Plus, Siren, Users, UserCircle,
  Shield,
  LogOut,
} from 'lucide-react';
import apiClient from '../api/client';
import NotificationCenter from '../components/NotificationCenter';
import ConnectionStatus from '../components/ConnectionStatus';
import { useSignalR } from '../providers/SignalRProvider';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { to: '/citizen/feed',       label: 'Public Feed',     icon: Newspaper  },
  { to: '/citizen/map',        label: 'Map',             icon: Map        },
  { to: '/citizen/my-reports', label: 'My Reports',      icon: FileText   },
  { to: '/citizen/report/new', label: 'Submit Report',   icon: Plus       },
  { to: '/citizen/communities',label: 'Communities',     icon: Users      },
  { to: '/citizen/profile',    label: 'Profile',         icon: UserCircle },
];

const SOS_ITEM = { to: '/citizen/sos', label: 'SOS Emergency', icon: Siren };

export default function CitizenLayout() {
  const user = useAuthStore((s) => s.user);
  const { joinCommunityGroup, leaveCommunityGroup, connectionState } = useSignalR();

  /* Join SignalR community groups */
  const { data: communities } = useQuery({
    queryKey: ['my-communities'],
    queryFn: () => apiClient.get('/api/community').then((r) => r.data ?? []),
  });

  useEffect(() => {
    if (!communities?.length || connectionState !== 'Connected') return;
    communities.forEach((c: any) => joinCommunityGroup(c.id));
    return () => { communities.forEach((c: any) => leaveCommunityGroup(c.id)); };
  }, [communities, joinCommunityGroup, leaveCommunityGroup, connectionState]);

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 hidden md:flex flex-col">
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">AIN</p>
            <p className="text-[10px] text-gray-500 leading-tight">Citizen Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
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
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* SOS button — always prominent red */}
          <NavLink
            to={SOS_ITEM.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold mt-3 transition-all ${
                isActive
                  ? 'bg-red-600/30 text-red-300 border border-red-500/40'
                  : 'text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20'
              }`
            }
          >
            <Siren className="w-4 h-4 shrink-0" />
            <span>SOS Emergency</span>
            <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </NavLink>
        </nav>

        {/* User chip */}
        <div className="p-3 border-t border-gray-800">
          <Link to="/citizen/profile" className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-800 transition-colors">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold shrink-0">
              {(user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.displayName ?? user?.email ?? 'Citizen'}</p>
              <p className="text-[10px] text-gray-500">Citizen</p>
            </div>
          </Link>
        </div>
        {/* Profile Footer - Citizen */}
        <div className="mt-auto border-t border-gray-800 p-4 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(user?.displayName ?? 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.displayName ?? 'Citizen'}</p>
              <p className="text-[10px] text-gray-500 truncate">Citizen</p>
            </div>
            <button  onClick={() => { useAuthStore.getState().logout(); window.location.href = '/login'; }} className="text-gray-500 hover:text-red-400 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-end px-5 gap-3">
          <ConnectionStatus />
          <NotificationCenter />
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}