/**
 * SOSPinsMap — Active SOS alert pins from GET /api/sosalerts/map-data
 * - Red pins with severity-based pulse animations for Critical alerts
 * - Rich popup: severity badge, elapsed time, message, Resolve/FalseAlarm actions
 * - Auto-refresh every 30 seconds
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import apiClient from '../../api/client';
import { createCustomIcon, getSeverityPinColor, TILE_URL, CAIRO, elapsedTime } from '../../utils/map';
import Skeleton from '../Skeleton';
import EmptyState from '../EmptyState';
import type { SOSAlert } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';

const SEVERITY_BG: Record<string, string> = {
  Standard: 'bg-yellow-500',
  High:     'bg-orange-500',
  Critical: 'bg-red-600',
};

interface SOSPinsMapProps {
  height?: string;
  /** If true, shows Resolve/FalseAlarm action buttons in popup (Authority/Admin only). */
  showActions?: boolean;
}

export default function SOSPinsMap({ height = '100%', showActions = false }: SOSPinsMapProps) {
  const queryClient = useQueryClient();
  const addToast    = useNotificationStore((s) => s.addToast);
  const user        = useAuthStore((s) => s.user);

  const isAuthorized = (() => {
    if (!user?.role) return false;
    const roles = Array.isArray(user.role) ? user.role : [user.role];
    return roles.some((r) => ['Authority', 'Admin', 'SuperAdmin'].includes(r));
  })();

  const { data: alerts, isLoading } = useQuery<SOSAlert[]>({
    queryKey: ['sos', 'map-data'],
    queryFn:  async () => {
      const res = await apiClient.get('/api/sosalerts/map-data');
      return (res.data ?? []).filter((a: SOSAlert) => a.status === 'Active');
    },
    refetchInterval: 30_000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) =>
      apiClient.put(`/api/sosalerts/${id}/${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos'] });
      addToast({ type: 'success', title: 'SOS Updated' });
    },
    onError: () => addToast({ type: 'error', title: 'Action failed' }),
  });

  if (isLoading) {
    return (
      <div style={{ height }} className="w-full rounded-xl overflow-hidden">
        <Skeleton type="map" className="h-full w-full" />
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <EmptyState title="No Active SOS" message="No active SOS alerts in the area." />
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full rounded-xl overflow-hidden border border-gray-700">
      <MapContainer center={CAIRO} zoom={11} className="h-full w-full z-0">
        <TileLayer url={TILE_URL} attribution="© OpenStreetMap" />
        <MarkerClusterGroup chunkedLoading>
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'Critical';
            const lastLoc    = alert.recentLocations?.at(-1);
            if (!lastLoc) return null;

            const color = getSeverityPinColor(alert.severity);
            return (
              <Marker
                key={alert.id}
                position={[lastLoc.latitude, lastLoc.longitude]}
                icon={createCustomIcon(color, isCritical ? 36 : 28, isCritical)}
              >
                <Popup minWidth={220}>
                  <div className="flex flex-col gap-2.5">
                    {/* Severity badge */}
                    <span
                      className={`self-start text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white ${SEVERITY_BG[alert.severity] ?? 'bg-red-600'} ${isCritical ? 'animate-pulse' : ''}`}
                    >
                      {alert.severity} SOS
                    </span>

                    {/* Elapsed */}
                    <p className="text-xs text-gray-500">{elapsedTime(alert.createdAtUtc)}</p>

                    {/* Message */}
                    {alert.message && (
                      <p className="text-sm text-gray-700 bg-gray-100 rounded p-2 leading-snug">
                        {alert.message}
                      </p>
                    )}

                    {/* Actions (Authority/Admin only) */}
                    {showActions && isAuthorized && (
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => actionMutation.mutate({ id: alert.id, action: 'resolve' })}
                          className="flex-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md py-1.5 transition-colors"
                        >
                          ✓ Resolve
                        </button>
                        <button
                          onClick={() => actionMutation.mutate({ id: alert.id, action: 'false-alarm' })}
                          className="flex-1 text-xs font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md py-1.5 transition-colors"
                        >
                          ✗ False Alarm
                        </button>
                      </div>
                    )}
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