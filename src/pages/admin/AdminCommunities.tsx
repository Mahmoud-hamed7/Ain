import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, ChevronLeft, ChevronRight, Users, MapPin, Key } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import { TILE_URL, createCustomIcon } from '../../utils/map';
import type { CommunityType } from '../../types';

const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  0: 'Neighborhood',
  1: 'Building',
  2: 'Private',
};
const COMMUNITY_TYPE_COLORS: Record<CommunityType, string> = {
  0: 'text-emerald-400 bg-emerald-400/10',
  1: 'text-blue-400 bg-blue-400/10',
  2: 'text-purple-400 bg-purple-400/10',
};

function TypeBadge({ type }: { type?: CommunityType }) {
  const t = type ?? 0;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${COMMUNITY_TYPE_COLORS[t]}`}>
      {COMMUNITY_TYPE_LABELS[t]}
    </span>
  );
}


function CentroidMapPopup({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        title="Show on map"
      >
        <MapPin className="w-3.5 h-3.5" />
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <p className="text-sm font-bold text-white">{name} — Centroid</p>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="h-64">
              <MapContainer center={[lat, lng]} zoom={13} className="h-full w-full">
                <TileLayer url={TILE_URL} attribution="© OpenStreetMap" />
                <Marker position={[lat, lng]} icon={createCustomIcon('#6366f1', 18)}>
                  <Popup>{name}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminCommunities() {
  const [search, setSearch]   = useState('');
  const [page,   setPage]     = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'communities', { search, page }],
    queryFn:  () =>
      apiClient.get('/api/community/all', {
        params: { pageNumber: page, pageSize, search: search || undefined },
      }).then((r) => r.data),
  });

  const communities: any[] = data?.communities ?? data?.items ?? data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Community Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">{totalCount} communities system-wide</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by community name…"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="table-row" />)}</div>
        ) : (
          <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/60 border-b border-gray-800">
                  {['Name', 'Type', 'Description', 'Members', 'Creator', 'Created', 'Centroid', 'Invite Code'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {communities.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{c.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={c.communityType} />
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-xs text-gray-400 truncate">{c.description ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        <Users className="w-4 h-4 text-indigo-400" />
                        {c.memberCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {c.creatorName ?? c.createdByName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.centroidLatitude != null && c.centroidLongitude != null ? (
                        <CentroidMapPopup
                          lat={c.centroidLatitude}
                          lng={c.centroidLongitude}
                          name={c.name}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.inviteCode ? (
                        <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-300">
                          <Key className="w-3 h-3" />
                          {c.inviteCode}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {communities.length === 0 && (
              <p className="text-center py-12 text-gray-500 text-sm">No communities found.</p>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
