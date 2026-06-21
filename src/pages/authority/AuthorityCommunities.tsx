/**
 * AuthorityCommunities — v2
 *
 * Changes vs v1:
 * ⭐ communityType filter: All / Neighborhood / Building / Private Group
 * ⭐ Type badge on each card
 * ⭐ "Send Reminders" button for LocationPending members within jurisdiction
 *    → POST /api/community/{id}/members/{memberId}/remind-location per pending member
 * ⭐ Search by name
 * ⭐ Members list with status chips (if expanded)
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import {
  MapPin, Users, Info, ChevronLeft, ChevronRight,
  Calendar, User, Search, Bell, Home, Building2, Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import { createCustomIcon } from '../../utils/map';
import { useNotificationStore } from '../../store/notificationStore';
import CommunityMembersPanel from '../../components/Community/CommunityMembersPanel';
import type { CommunityType, CommunitySystemListDto } from '../../types';

// ─── Type config ──────────────────────────────────────────────────
const TYPE_CONFIG: Record<CommunityType, { label: string; color: string; icon: React.ReactElement }> = {
  0: { label: 'Neighborhood', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',    icon: <MapPin className="w-3 h-3" />      },
  1: { label: 'Building',     color: 'text-gray-400 bg-gray-400/10 border-gray-400/20',    icon: <Building2 className="w-3 h-3" />   },
  2: { label: 'Private',      color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: <Lock className="w-3 h-3" />    },
};

function TypeBadge({ type }: { type?: CommunityType }) {
  const t = type ?? 0;
  const cfg = TYPE_CONFIG[t];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Mini centroid map ────────────────────────────────────────────
function CentroidMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="h-32 rounded-xl overflow-hidden border border-gray-700 mt-3">
      <MapContainer center={[lat, lng]} zoom={13} className="h-full w-full z-0"
        scrollWheelZoom={false} zoomControl={false} attributionControl={false}>
        <TileLayer url={import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} />
        <Marker position={[lat, lng]} icon={createCustomIcon('#3b82f6', 18)} />
      </MapContainer>
    </div>
  );
}

// ─── Community card ───────────────────────────────────────────────
function CommunityCard({
  community,
  expanded,
  onToggleMap,
  onRemindAll,
  isReminding,
}: {
  community: CommunitySystemListDto & { pendingMemberIds?: string[] };
  expanded: boolean;
  onToggleMap: () => void;
  onRemindAll: () => void;
  isReminding: boolean;
}) {
  const hasLocation = community.centroidLatitude != null && community.centroidLongitude != null;
  const pendingCount = community.pendingMemberIds?.length ?? 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <h3 className="font-bold text-white text-base truncate">{community.name}</h3>
            <TypeBadge type={community.communityType} />
          </div>
          {community.description && (
            <p className="text-sm text-gray-400 line-clamp-2">{community.description}</p>
          )}
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/20 text-blue-300 border border-blue-800/40 rounded-full text-xs font-bold shrink-0">
          <Users className="w-3 h-3" /> {community.memberCount}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {community.createdByName}</span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {community.createdAt ? format(new Date(community.createdAt), 'MMM d, yyyy') : '—'}
        </span>
      </div>

      {/* Send reminders for LocationPending members */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <span className="text-xs text-amber-300">
            {pendingCount} member{pendingCount > 1 ? 's' : ''} pending location
          </span>
          <button
            onClick={onRemindAll}
            disabled={isReminding}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            {isReminding ? 'Sending…' : 'Send Reminders'}
          </button>
        </div>
      )}

      {/* Members + centroid */}
      <button
        onClick={onToggleMap}
        className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        <Users className="w-3.5 h-3.5" />
        {expanded ? 'Hide Members' : 'Show Members'}
      </button>
      {expanded && (
        <>
          {hasLocation && (
            <CentroidMap lat={community.centroidLatitude!} lng={community.centroidLongitude!} />
          )}
          <CommunityMembersPanel communityId={community.id} />
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────
const TYPE_FILTERS: { label: string; value: CommunityType | 'all' }[] = [
  { label: 'All',           value: 'all' },
  { label: 'Neighborhood',  value: 0     },
  { label: 'Building',      value: 1     },
  { label: 'Private Group', value: 2     },
];

export default function AuthorityCommunities() {
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState<CommunityType | 'all'>('all');
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [reminding,  setReminding]  = useState<string | null>(null);
  const addToast = useNotificationStore((s) => s.addToast);
  const PAGE_SIZE = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['community', 'all', page, search, typeFilter],
    queryFn: async () => {
      const res = await apiClient.get('/api/community/all', {
        params: {
          pageNumber:    page,
          pageSize:      PAGE_SIZE,
          search:        search || undefined,
          communityType: typeFilter !== 'all' ? typeFilter : undefined,
        },
      });
      return res.data;
    },
  });

  const communities: (CommunitySystemListDto & { pendingMemberIds?: string[] })[] =
    data?.communities ?? data?.items ?? [];
  const totalPages: number = data?.totalPages ?? 1;
  const totalCount: number = data?.totalCount ?? 0;

  // Remind all pending members in a community
  const { mutate: remindAll } = useMutation({
    mutationFn: async ({ communityId, memberIds }: { communityId: string; memberIds: string[] }) => {
      await Promise.all(
        memberIds.map((mid) =>
          apiClient.post(`/api/community/${communityId}/members/${mid}/remind-location`)
        )
      );
    },
    onSuccess: () => {
      addToast({ type: 'success', title: 'Reminders sent', description: 'Location reminders sent to pending members.' });
      setReminding(null);
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to send reminders' });
      setReminding(null);
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Communities</h1>
          {!isLoading && (
            <p className="text-sm text-gray-500 mt-0.5">{totalCount} communities in your jurisdiction</p>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-950/30 border border-blue-800/30 text-blue-300 text-sm p-4 rounded-xl">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
        <span>
          These communities have at least one member whose last known location falls within your jurisdiction.
          Only communities relevant to your coverage are shown.
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {TYPE_FILTERS.map(({ label, value }) => (
            <button
              key={String(value)}
              onClick={() => { setTypeFilter(value); setPage(1); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                typeFilter === value ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {value === 0 ? <Home className="w-3 h-3" /> :
               value === 1 ? <Building2 className="w-3 h-3" /> :
               value === 2 ? <Lock className="w-3 h-3" /> : null}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => <Skeleton key={n} type="card" className="h-48" />)}
        </div>
      ) : communities.length === 0 ? (
        <EmptyState title="No Communities Found" message="There are no communities with members in your jurisdiction yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {communities.map((c) => (
            <CommunityCard
              key={c.id}
              community={c}
              expanded={expanded === c.id}
              onToggleMap={() => setExpanded((p) => (p === c.id ? null : c.id))}
              isReminding={reminding === c.id}
              onRemindAll={() => {
                if (!c.pendingMemberIds?.length) return;
                setReminding(c.id);
                remindAll({ communityId: c.id, memberIds: c.pendingMemberIds });
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-gray-400 tabular-nums">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
