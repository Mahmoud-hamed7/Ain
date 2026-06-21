/**
 * CombinedMap — Full admin/authority map merging:
 *   - Report pins (clustered, filterable)
 *   - SOS alert pins (auto-refresh 30s, with actions)
 *   - Authority coverage area circles
 *
 * Features a filter sidebar panel and layer toggles.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { Link } from 'react-router-dom';
import { X, Layers, FileText, ExternalLink, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import apiClient from '../../api/client';
import {
  createCustomIcon,
  getStatusPinColor,
  getSeverityPinColor,
  TILE_URL,
  CAIRO,
  elapsedTime,
} from '../../utils/map';
import type { ReportMapPinDto, SOSAlert, Authority } from '../../types';
import { useNotificationStore } from '../../store/notificationStore';
import Skeleton from '../Skeleton';



type StatusFilter = 'all' | 'UnderReview' | 'Dispatched' | 'ReSolved' | 'Rejected';

interface CombinedMapProps {
  /** Which dash the viewer is on — affects report deep-link path */
  viewerRole?: 'authority' | 'admin';
  /** If true, show the filter sidebar panel toggle */
  showFilterPanel?: boolean;
  height?: string;
}

export default function CombinedMap({
  viewerRole    = 'authority',
  showFilterPanel = true,
  height        = '100%',
}: CombinedMapProps) {
  const queryClient = useQueryClient();
  const addToast    = useNotificationStore((s) => s.addToast);

  /* ── Layer visibility ── */
  const [showReports,  setShowReports]  = useState(true);
  const [showSOS,      setShowSOS]      = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);

  /* ── Filters ── */
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  /* ── Selected pin sidebar ── */
  const [selectedPin, setSelectedPin] = useState<{
    type: 'report' | 'sos';
    data: any;
  } | null>(null);

  /* ── Queries ── */
  const { data: reports, isLoading: rLoading } = useQuery<ReportMapPinDto[]>({
    queryKey: ['reports', 'map-data', 'combined'],
    queryFn:  async () => (await apiClient.get('/api/reports/map-data')).data ?? [],
    refetchInterval: 60_000,
  });

  const { data: sosAlerts, isLoading: sLoading } = useQuery<SOSAlert[]>({
    queryKey: ['sos', 'map-data'],
    queryFn:  async () => {
      const res = await apiClient.get('/api/sosalerts/map-data');
      return (res.data ?? []).filter((a: SOSAlert) => a.status === 'Active');
    },
    refetchInterval: 30_000,
  });

  const { data: profile } = useQuery<Authority>({
    queryKey: ['authorities', 'me'],
    queryFn:  async () => (await apiClient.get('/api/authorities/me')).data,
    enabled:  viewerRole === 'authority',
  });

  /* ── SOS action mutation ── */
  const sosMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) =>
      apiClient.put(`/api/sosalerts/${id}/${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos'] });
      setSelectedPin(null);
      addToast({ type: 'success', title: 'SOS Updated' });
    },
    onError: () => addToast({ type: 'error', title: 'Action failed' }),
  });

  const filteredReports = (reports ?? []).filter(
    (r) => statusFilter === 'all' || r.status === statusFilter,
  );

  const mapCenter: [number, number] =
    profile?.latitude && profile?.longitude
      ? [profile.latitude, profile.longitude]
      : CAIRO;

  const viewBase = viewerRole === 'admin' ? '/admin/reports' : '/authority/report';

  const isLoading = rLoading || sLoading;

  return (
    <div style={{ height }} className="flex flex-col overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="shrink-0 bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex flex-wrap items-center gap-3">
        {/* Layer toggles */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          <Layers className="w-4 h-4 text-gray-400 ml-1 mr-0.5" />
          {[
            { label: 'Reports', state: showReports, set: setShowReports, accent: 'accent-blue-500' },
            { label: 'SOS',     state: showSOS,     set: setShowSOS,     accent: 'accent-red-500'  },
            { label: 'Coverage',state: showCoverage,set: setShowCoverage,accent: 'accent-indigo-500'},
          ].map(({ label, state, set, accent }) => (
            <label key={label} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer px-2 py-1 rounded-md hover:bg-gray-700 transition-colors">
              <input type="checkbox" checked={state} onChange={(e) => set(e.target.checked)} className={`${accent} w-3 h-3`} />
              {label}
            </label>
          ))}
        </div>

        {/* Status filter */}
        {showReports && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="UnderReview">Under Review</option>
            <option value="Dispatched">Dispatched</option>
            <option value="ReSolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>
        )}

        {/* Stats chips */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-gray-500">{filteredReports.length} reports</span>
          <span className="w-px h-3 bg-gray-700" />
          <span className="text-red-400">{sosAlerts?.length ?? 0} active SOS</span>
        </div>

        {/* Filter panel toggle */}
        {showFilterPanel && (
          <button
            onClick={() => setFilterPanelOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filterPanelOpen
                ? 'bg-blue-600/20 border-blue-600/40 text-blue-400'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
        )}
      </div>

      {/* ── Map + sidebars ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <div className="flex-1 relative z-0">
          {isLoading ? (
            <Skeleton type="map" className="h-full w-full" />
          ) : (
            <MapContainer center={mapCenter} zoom={12} className="h-full w-full">
              <TileLayer url={TILE_URL} attribution="© OpenStreetMap" />

              {/* Coverage circles */}
              {showCoverage && profile && (
                <>
                  {profile.latitude && profile.longitude && profile.jurisdictionRadiusKm && (
                    <Circle
                      center={[profile.latitude, profile.longitude]}
                      radius={profile.jurisdictionRadiusKm * 1000}
                      pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.05, weight: 2, dashArray: '8 6' }}
                    />
                  )}
                  {profile.coverageAreas?.map((area) => (
                    <Circle
                      key={area.id}
                      center={[area.centerLatitude, area.centerLongitude]}
                      radius={area.radiusKm * 1000}
                      pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.06, weight: 1.5 }}
                    >
                      <Popup><strong>{area.areaName}</strong> — {area.radiusKm} km</Popup>
                    </Circle>
                  ))}
                </>
              )}

              {/* Report pins */}
              {showReports && (
                <MarkerClusterGroup chunkedLoading>
                  {filteredReports.map((pin) => (
                    <Marker
                      key={`r-${pin.id}`}
                      position={[pin.latitude, pin.longitude]}
                      icon={createCustomIcon(getStatusPinColor(pin.status), 28)}
                      eventHandlers={{ click: () => setSelectedPin({ type: 'report', data: pin }) }}
                    >
                      <Popup minWidth={200}>
                        <div className="flex flex-col gap-1.5">
                          <strong className="text-sm">{pin.title}</strong>
                          <span className="text-xs text-gray-500">{pin.status}</span>
                          <Link to={`${viewBase}/${pin.id}`} className="text-xs text-blue-600 underline">View →</Link>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              )}

              {/* SOS pins */}
              {showSOS && (
                <MarkerClusterGroup chunkedLoading>
                  {(sosAlerts ?? []).map((alert) => {
                    const lastLoc = alert.recentLocations?.at(-1);
                    if (!lastLoc) return null;
                    const isCritical = alert.severity === 'Critical';
                    return (
                      <Marker
                        key={`s-${alert.id}`}
                        position={[lastLoc.latitude, lastLoc.longitude]}
                        icon={createCustomIcon(getSeverityPinColor(alert.severity), isCritical ? 36 : 28, isCritical)}
                        eventHandlers={{ click: () => setSelectedPin({ type: 'sos', data: alert }) }}
                      >
                        <Popup>
                          <strong className="text-red-600 text-sm">{alert.severity} SOS</strong>
                          <p className="text-xs text-gray-500">{elapsedTime(alert.createdAtUtc)}</p>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MarkerClusterGroup>
              )}
            </MapContainer>
          )}
        </div>

        {/* ── Detail sidebar ── */}
        {selectedPin && (
          <aside className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto z-10 shrink-0">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="font-bold text-white text-sm">
                {selectedPin.type === 'report' ? 'Report Detail' : 'SOS Alert'}
              </h3>
              <button onClick={() => setSelectedPin(null)} className="text-gray-500 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 space-y-4">
              {selectedPin.type === 'report' ? (
                /* Report panel */
                <>
                  <div className="h-1 rounded-full" style={{ backgroundColor: getStatusPinColor(selectedPin.data.status) }} />
                  <h4 className="font-bold text-white">{selectedPin.data.title}</h4>
                  <dl className="text-xs text-gray-400 space-y-1.5">
                    <div className="flex justify-between">
                      <dt>Status</dt>
                      <dd className="text-white font-medium">{selectedPin.data.status}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Category</dt>
                      <dd className="text-white font-medium">{selectedPin.data.categoryName ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Created</dt>
                      <dd className="text-white font-medium">
                        {selectedPin.data.createdAt
                          ? formatDistanceToNow(new Date(selectedPin.data.createdAt), { addSuffix: true })
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    to={`${viewBase}/${selectedPin.data.id}`}
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
                  >
                    <FileText className="w-4 h-4" /> Open Case
                  </Link>
                </>
              ) : (
                /* SOS panel */
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                      selectedPin.data.severity === 'Critical' ? 'bg-red-600 animate-pulse' :
                      selectedPin.data.severity === 'High'     ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}>
                      {selectedPin.data.severity} SOS
                    </span>
                    <span className="text-xs text-gray-500">{selectedPin.data.status}</span>
                  </div>
                  {selectedPin.data.message && (
                    <p className="text-sm text-gray-300 bg-gray-800 rounded-lg p-3">{selectedPin.data.message}</p>
                  )}
                  <p className="text-xs text-gray-500">{elapsedTime(selectedPin.data.createdAtUtc)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => sosMutation.mutate({ id: selectedPin.data.id, action: 'resolve' })}
                      disabled={sosMutation.isPending}
                      className="flex-1 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      ✓ Resolve
                    </button>
                    <button
                      onClick={() => sosMutation.mutate({ id: selectedPin.data.id, action: 'false-alarm' })}
                      disabled={sosMutation.isPending}
                      className="flex-1 text-sm font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      ✗ False Alarm
                    </button>
                  </div>
                  <Link to={viewerRole === 'admin' ? '/admin/sos' : '/authority/sos'}
                    className="flex items-center justify-center gap-1.5 w-full text-sm text-blue-400 hover:text-blue-300 underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Manage in SOS Monitor
                  </Link>
                </>
              )}
            </div>
          </aside>
        )}

        {/* ── Legend overlay (bottom-left) ── */}
        <div className="absolute bottom-4 left-4 z-[500] bg-gray-900/90 backdrop-blur border border-gray-800 rounded-xl p-3 flex flex-col gap-1.5 text-xs pointer-events-none">
          {[
            { label: 'Under Review', color: '#f59e0b' },
            { label: 'Dispatched',   color: '#3b82f6' },
            { label: 'Resolved',     color: '#10b981' },
            { label: 'Rejected',     color: '#6b7280' },
            { label: 'SOS Critical', color: '#ef4444' },
            { label: 'SOS High',     color: '#f97316' },
            { label: 'SOS Standard', color: '#eab308' },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-gray-300">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
