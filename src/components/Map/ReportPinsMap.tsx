/**
 * ReportPinsMap — multi-pin map from GET /api/reports/map-data.
 * Supports MarkerCluster grouping and optional filters.
 * Usage: <ReportPinsMap filters={{ status: 'UnderReview' }} viewerRole="citizen" />
 */
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import {
  createCustomIcon,
  getStatusPinColor,
  TILE_URL,
  CAIRO,
  elapsedTime,
} from '../../utils/map';
import type { ReportMapPinDto } from '../../types';
import Skeleton from '../Skeleton';
import EmptyState from '../EmptyState';

/* Status badge colours (Tailwind-compatible inline) */
const STATUS_BADGE: Record<string, string> = {
  UnderReview: '#f59e0b',
  Dispatched:  '#3b82f6',
  ReSolved:    '#10b981',
  Resolved:    '#10b981',
  Rejected:    '#6b7280',
};

interface ReportPinsMapProps {
  /** Query-string filters forwarded to the API. */
  filters?: {
    categoryId?: string;
    status?:     string;
    authorityId?: string;
  };
  /** Controls the "View" link path. */
  viewerRole?: 'citizen' | 'authority' | 'admin';
  /** Map container height (default 100%). */
  height?: string;
}

export default function ReportPinsMap({
  filters,
  viewerRole = 'citizen',
  height = '100%',
}: ReportPinsMapProps) {
  const { data: pins, isLoading } = useQuery<ReportMapPinDto[]>({
    queryKey: ['reports', 'map-data', filters],
    queryFn:  async () => {
      const res = await apiClient.get('/api/reports/map-data', { params: filters });
      return res.data ?? [];
    },
    staleTime: 60_000,
  });

  const viewBase =
    viewerRole === 'authority' ? '/authority/report'
    : viewerRole === 'admin'  ? '/admin/report'
    : '/citizen/report';

  if (isLoading) {
    return (
      <div style={{ height }} className="w-full rounded-xl overflow-hidden">
        <Skeleton type="map" className="h-full w-full" />
      </div>
    );
  }

  if (!pins || pins.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <EmptyState title="No Reports" message="No report pins match the current filters." />
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full rounded-xl overflow-hidden border border-gray-700">
      <MapContainer center={CAIRO} zoom={11} className="h-full w-full z-0">
        <TileLayer url={TILE_URL} attribution="© OpenStreetMap" />
        <MarkerClusterGroup chunkedLoading>
          {pins.map((pin) => {
            const color = getStatusPinColor(pin.status);
            return (
              <Marker
                key={pin.id}
                position={[pin.latitude, pin.longitude]}
                icon={createCustomIcon(color, 28)}
              >
                <Popup minWidth={200}>
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold text-sm text-gray-800 leading-snug">{pin.title}</p>

                    <span
                      className="self-start text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: STATUS_BADGE[pin.status] ?? '#94a3b8' }}
                    >
                      {pin.status}
                    </span>

                    {pin.categoryName && (
                      <p className="text-xs text-gray-500">{pin.categoryName}</p>
                    )}

                    <p className="text-xs text-gray-400">{elapsedTime(pin.createdAt)}</p>

                    <Link
                      to={`${viewBase}/${pin.id}`}
                      className="text-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md py-1.5 transition-colors"
                    >
                      View Report →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}