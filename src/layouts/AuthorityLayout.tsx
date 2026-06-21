import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, ClipboardList, Map, AlertTriangle,
  BarChart3, UserCircle, Users,
  LogOut
} from 'lucide-react';
import NotificationCenter from '../components/NotificationCenter';
import { useAuthStore } from '../store/authStore';
import ConnectionStatus from '../components/ConnectionStatus';
import { useSignalR } from '../providers/SignalRProvider';
import apiClient from '../api/client';
import { parseCommunityListFromResponse } from '../hooks/useCommunityNameMap';

const navItems = [
  { to: '/authority/dashboard', label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/authority/feed',      label: 'Case Feed',     icon: ClipboardList   },
  { to: '/authority/map',       label: 'Map View',      icon: Map             },
  { to: '/authority/sos',       label: 'SOS Monitor',   icon: AlertTriangle,  accent: true },
  { to: '/authority/analytics', label: 'Analytics',     icon: BarChart3       },
  { to: '/authority/communities', label: 'Communities', icon: Users           },
  { to: '/authority/profile',   label: 'My Profile',    icon: UserCircle      },
];

export default function AuthorityLayout() {
  const user = useAuthStore((s) => s.user);
  const { joinCommunityGroup, leaveCommunityGroup, connectionState } = useSignalR();
  const joinedGroupIds = useRef<Set<string>>(new Set());

  const [time, setTime] = useState(new Date());

  const { data: jurisdictionCommunities } = useQuery({
    queryKey: ['community', 'all', 'authority-signalr'],
    queryFn: () =>
      apiClient
        .get('/api/Community/all', { params: { pageNumber: 1, pageSize: 1000 } })
        .then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  /* Join SignalR community groups so ReceiveLocationUpdate / SOS events arrive */
  useEffect(() => {
    if (connectionState !== 'Connected') return;

    const communities = parseCommunityListFromResponse(jurisdictionCommunities);
    const nextIds = new Set(communities.map((c) => c.id));

    for (const id of joinedGroupIds.current) {
      if (!nextIds.has(id)) {
        leaveCommunityGroup(id);
        joinedGroupIds.current.delete(id);
      }
    }

    for (const id of nextIds) {
      if (!joinedGroupIds.current.has(id)) {
        joinCommunityGroup(id);
        joinedGroupIds.current.add(id);
      }
    }
  }, [jurisdictionCommunities, connectionState, joinCommunityGroup, leaveCommunityGroup]);

  useEffect(() => {
    return () => {
      for (const id of joinedGroupIds.current) {
        leaveCommunityGroup(id);
      }
      joinedGroupIds.current.clear();
    };
  }, [leaveCommunityGroup]);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* ─── Sidebar ─── */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 hidden md:flex flex-col">
        {/* Logo / brand */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm">A</div>
          <div>
            <div className="font-bold text-blue-400 text-sm leading-tight">AIN Authority</div>
            <div className="text-[10px] text-gray-500 leading-tight truncate max-w-[140px]">
              {user?.displayName || 'Authority User'}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, accent }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? accent
                      ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                      : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : accent
                      ? 'text-red-400/70 hover:bg-red-600/10 hover:text-red-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {accent && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* Removed sidebar status, moved to topbar */}
        {/* Profile Footer - Authority */}
        <div className="mt-auto border-t border-gray-800 p-4 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(user?.displayName ?? 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.displayName ?? 'Authority'}</p>
              <p className="text-[10px] text-gray-500 truncate">Authority Member</p>
            </div>
            <button onClick={() => { useAuthStore.getState().logout(); window.location.href = '/login'; }} className="text-gray-500 hover:text-red-400 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main area ─── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex justify-between items-center px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full">
              Authority Control Center
            </div>
          </div>
          <div className="flex items-center gap-5">
            <ConnectionStatus />
            <span className="text-sm text-gray-400 tabular-nums font-mono">
              {time.toLocaleTimeString()}
            </span>
            <NotificationCenter />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}