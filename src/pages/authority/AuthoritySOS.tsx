/**
 * AuthoritySOS — v3
 *
 * Changes vs v2:
 * ⭐ Uses new paginated GET /api/sosalerts (no more 404)
 * ⭐ Query key ['sos', 'list', filters] — matches SignalR invalidation
 * ⭐ Severity filter chip row
 * ⭐ Pagination controls (totalPages from response)
 * ⭐ isLocationStale field drives stale badge (no longer relying only on SignalR)
 * ⭐ ReceiveLocationStale / ReceiveLocationRestored patch list cache directly
 * ⭐ ReceiveSOSTriggered invalidates list (new alert appears instantly)
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import {
  Wifi, WifiOff, MapPin, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Users, ChevronLeft, ChevronRight,
} from 'lucide-react';
import apiClient from '../../api/client';
import { useSOSAlerts } from '../../api/sos';
import { useSignalR } from '../../providers/SignalRProvider';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import { useNotificationStore } from '../../store/notificationStore';
import { createCustomIcon } from '../../utils/map';
import type {
  SOSAlertListItem, SOSAlertListResponse, SOSLocationDto,
} from '../../types';

// ─── Audio ───────────────────────────────────────────────────────
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const beep = (f: number, t: number, d: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.start(t); o.stop(t + d);
    };
    const now = ctx.currentTime;
    beep(880, now, 0.12); beep(880, now + 0.2, 0.12); beep(1100, now + 0.4, 0.2);
  } catch { /* noop */ }
}

// ─── Mini map ────────────────────────────────────────────────────
function AlertMiniMap({
  location,
  trail,
  isStale,
}: {
  location: SOSLocationDto | undefined;
  trail?: SOSLocationDto[];
  isStale?: boolean;
}) {
  if (!location) return null;
  const pinColor = isStale ? '#6b7280' : '#ef4444';
  const trailPositions = (trail ?? []).map((l): [number, number] => [l.latitude, l.longitude]);

  return (
    <div className={`h-36 rounded-xl overflow-hidden border mt-2 ${isStale ? 'border-amber-500/40' : 'border-gray-700'}`}>
      <MapContainer
        center={[location.latitude, location.longitude]}
        zoom={14}
        className="h-full w-full z-0"
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} />
        {trailPositions.length > 1 && (
          <Polyline positions={trailPositions} color={isStale ? '#6b7280' : '#ef4444'} weight={2} opacity={0.6} />
        )}
        <Marker position={[location.latitude, location.longitude]} icon={createCustomIcon(pinColor, 20)} />
      </MapContainer>
    </div>
  );
}

// ─── Per-card runtime state (driven by SignalR, not backend) ─────
interface AlertCardState {
  isStale: boolean;
  secondsSinceLastPing: number | null;
  activeMemberCount: number;
}

// ─── Alert card ──────────────────────────────────────────────────
function SOSCard({
  alert,
  cardState,
  onAction,
  isPending,
}: {
  alert: SOSAlertListItem;
  cardState: AlertCardState;
  onAction: (action: string, payload?: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCritical = alert.severity === 'Critical';
  const elapsed = differenceInMinutes(new Date(), new Date(alert.createdAtUtc));

  // Live-state snapshot (loads on expand)
  // تم استخدام <any> لتجاوز اختلافات الـ Types مع الـ Backend
  const { data: liveState } = useQuery<any>({
    queryKey: ['sos', alert.id, 'live-state'],
    queryFn: () => apiClient.get(`/api/sosalerts/${alert.id}/live-state`).then((r) => r.data),
    enabled: expanded,
    refetchInterval: expanded ? 20_000 : false,
  });

  // تحديث قراءة البيانات لتتطابق مع الـ JSON الفعلي القادم من الـ Backend
  const isStale = alert.isLocationStale || cardState.isStale || liveState?.isInitiatorLocationStale;
  
  // استخدام Type Assertion (as SOSLocationDto) لحل مشكلة التايب سكريبت وتجاهل الخصائص الناقصة
  const displayLocation = liveState?.initiatorLatitude && liveState?.initiatorLongitude 
    ? { 
        latitude: liveState.initiatorLatitude, 
        longitude: liveState.initiatorLongitude 
      } as SOSLocationDto
    : undefined;

  const trail = (liveState?.memberLocations ?? []) as SOSLocationDto[]; 
  const activeMembers = liveState?.totalActiveMembers ?? cardState.activeMemberCount ?? 0;

  const borderClass = isStale
    ? 'border-amber-500/60 border-dashed shadow-lg shadow-amber-900/20'
    : isCritical
      ? 'border-red-500 shadow-lg shadow-red-900/30'
      : 'border-gray-800';

  return (
    <div className={`bg-gray-900 rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all ${borderClass}`}>
      {/* Header row */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${isCritical ? 'bg-red-600 animate-pulse' :
            alert.severity === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
            }`}>
            {alert.severity}
          </span>

          {/* Stale badge */}
          {isStale && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <WifiOff className="w-3 h-3" />
              Location signal lost
              {alert.lastLocationPingAt && (
                <span> · {formatDistanceToNow(new Date(alert.lastLocationPingAt))} ago</span>
              )}
              {!alert.lastLocationPingAt && cardState.secondsSinceLastPing != null && (
                ` · ${Math.round(cardState.secondsSinceLastPing)}s ago`
              )}
            </span>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500 tabular-nums">
            Active for <span className="text-white font-semibold">{elapsed}m</span>
          </p>
          <p className="text-[10px] text-gray-600">
            {formatDistanceToNow(new Date(alert.createdAtUtc), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Message */}
      {alert.message && <p className="text-white font-medium text-sm">{alert.message}</p>}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 bg-gray-800/50 rounded-xl p-3">
        <div>
          <span className="text-gray-600 block">Community</span>
          <span className="text-gray-200 font-medium truncate block">{alert.communityId}</span>
        </div>
        <div>
          <span className="text-gray-600 block">Initiator</span>
          <span className="text-gray-200 font-medium">
            {liveState?.initiatorName || alert.initiatorUserId?.slice(0, 10) + '…'}
          </span>
        </div>
        {activeMembers > 0 && (
          <div>
            <span className="text-gray-600 block flex items-center gap-1"><Users className="w-3 h-3 inline" /> Members</span>
            <span className="text-gray-200 font-medium">
              {activeMembers} active
            </span>
          </div>
        )}
        
        {expanded && displayLocation && (
          <div className="col-span-2 mt-2 pt-2 border-t border-gray-700">
            <span className={`block flex items-center gap-1 ${isStale ? 'text-amber-500' : 'text-gray-600'}`}>
              <MapPin className="w-3 h-3 inline" />
              {isStale ? 'Last known location (stale)' : 'Current location'}
            </span>
            <span className={`font-medium ${isStale ? 'text-amber-300/70' : 'text-gray-200'}`}>
              {displayLocation.latitude.toFixed(5)}, {displayLocation.longitude.toFixed(5)}
            </span>
          </div>
        )}
      </div>

      {/* Expand / collapse */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors self-start"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? 'Hide live details' : 'View live details & trail'}
      </button>

      {/* Mini map (loaded from live-state) */}
      {expanded && displayLocation && (
        <AlertMiniMap location={displayLocation} trail={trail} isStale={isStale} />
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
        <Button size="sm" onClick={() => onAction('resolve')} isLoading={isPending} className="flex-1">
          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Resolve
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAction('false-alarm')} isLoading={isPending} className="flex-1">
          ✗ False Alarm
        </Button>
        <select
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 text-sm text-white outline-none"
          value={alert.severity}
          onChange={(e) => onAction('severity', e.target.value)}
        >
          <option value="Standard">Standard</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
      </div>
    </div>
  );
}

// ─── Severity filter chips ────────────────────────────────────────
const SEVERITIES = ['', 'Standard', 'High', 'Critical'] as const;
const SEV_LABELS: Record<string, string> = { '': 'All', Standard: 'Standard', High: 'High', Critical: 'Critical' };
const SEV_COLORS: Record<string, string> = {
  '': 'border-gray-700 text-gray-400 hover:border-gray-500',
  Standard: 'border-yellow-500/60 text-yellow-400 hover:border-yellow-400',
  High: 'border-orange-500/60 text-orange-400 hover:border-orange-400',
  Critical: 'border-red-500/60 text-red-400 hover:border-red-400',
};
const SEV_ACTIVE: Record<string, string> = {
  '': 'bg-gray-700 border-gray-500 text-white',
  Standard: 'bg-yellow-500/20 border-yellow-400 text-yellow-300',
  High: 'bg-orange-500/20 border-orange-400 text-orange-300',
  Critical: 'bg-red-500/20 border-red-400 text-red-300',
};

// ─── Pagination ───────────────────────────────────────────────────
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-400 tabular-nums">
        Page <span className="text-white font-semibold">{currentPage}</span> of{' '}
        <span className="text-white font-semibold">{totalPages}</span>
      </span>
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────
export default function AuthoritySOS() {
  const queryClient = useQueryClient();
  const { connection, connectionState } = useSignalR();
  const addToast = useNotificationStore((s) => s.addToast);
  const prevCritical = useRef(new Set<string>());

  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // Per-card runtime stale state, keyed by alertId
  const [cardStates, setCardStates] = useState<Record<string, AlertCardState>>({});

  const updateCardState = useCallback((id: string, patch: Partial<AlertCardState>) => {
    setCardStates((prev) => {
      const defaults: AlertCardState = { isStale: false, secondsSinceLastPing: null, activeMemberCount: 0 };
      return { ...prev, [id]: { ...defaults, ...(prev[id] ?? {}), ...patch } };
    });
  }, []);

  // Build filters — Authority role: no ?status sent → backend defaults to Active only
  const filters = {
    ...(severityFilter ? { severity: severityFilter } : {}),
    page: currentPage,
    pageSize: 20,
  };

  const { data, isLoading } = useSOSAlerts(filters);

  const alerts: SOSAlertListItem[] = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Reset to page 1 when filter changes
  const handleSeverityChange = (sev: string) => {
    setSeverityFilter(sev);
    setCurrentPage(1);
  };

  // Sound for new Critical alerts
  useEffect(() => {
    alerts.forEach((alert) => {
      if (alert.severity === 'Critical' && !prevCritical.current.has(alert.id)) {
        playAlertSound();
        prevCritical.current.add(alert.id);
      }
    });
  }, [alerts]);

  // SignalR event listeners
  useEffect(() => {
    if (!connection) return;

    const currentFilters = filters; // capture for cache patches

    const onTriggered = (_communityId: string, alert: any) => {
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      queryClient.setQueryData(['sos', alert.id], alert);
      addToast({ type: 'sos', title: 'New SOS Alert', description: alert.message ?? undefined });
      if (alert.severity === 'Critical') playAlertSound();
    };

    const onResolved = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
    const onCancelled = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
    const onFalseAlarm = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
    const onSeverity = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });

    // Location update — clear stale on that card
    const onLocation = (_communityId: string, sosId: string, _loc: SOSLocationDto) => {
      updateCardState(sosId, { isStale: false, secondsSinceLastPing: null });
      queryClient.invalidateQueries({ queryKey: ['sos', sosId, 'live-state'] });
    };

    // Stale — patch list cache + update card state
    const onStale = (sosAlertId: string, secondsSinceLastPing: number) => {
      updateCardState(sosAlertId, { isStale: true, secondsSinceLastPing });
      queryClient.setQueryData<SOSAlertListResponse>(
        ['sos', 'list', currentFilters],
        (old) => old
          ? { ...old, data: old.data.map((a) => a.id === sosAlertId ? { ...a, isLocationStale: true } : a) }
          : old,
      );
      const alert = alerts.find((a) => a.id === sosAlertId);
      addToast({
        type: 'warning',
        title: '⚠ Location signal lost',
        description: `SOS alert${alert ? ` in community ${alert.communityId.slice(0, 8)}…` : ''} has no location ping for ${Math.round(secondsSinceLastPing)}s.`,
      });
    };

    // Restored — patch list cache + clear card state
    const onRestored = (sosAlertId: string) => {
      updateCardState(sosAlertId, { isStale: false, secondsSinceLastPing: null });
      queryClient.setQueryData<SOSAlertListResponse>(
        ['sos', 'list', currentFilters],
        (old) => old
          ? { ...old, data: old.data.map((a) => a.id === sosAlertId ? { ...a, isLocationStale: false } : a) }
          : old,
      );
      addToast({ type: 'success', title: '✓ Location signal restored' });
    };

    // Member activated
    const onMemberActivated = (sosAlertId: string, _userId: string, memberName: string) => {
      setCardStates((prev) => {
        const cur = prev[sosAlertId] ?? { isStale: false, secondsSinceLastPing: null, activeMemberCount: 0 };
        return { ...prev, [sosAlertId]: { ...cur, activeMemberCount: cur.activeMemberCount + 1 } };
      });
      addToast({ type: 'info', title: `${memberName} is now tracking this SOS` });
    };

    connection.on('ReceiveSOSTriggered', onTriggered);
    connection.on('ReceiveSOSResolved', onResolved);
    connection.on('ReceiveSOSCancelled', onCancelled);
    connection.on('ReceiveSOSMarkedAsFalseAlarm', onFalseAlarm);
    connection.on('ReceiveSeverityChanged', onSeverity);
    connection.on('ReceiveLocationUpdate', onLocation);
    connection.on('ReceiveLocationStale', onStale);
    connection.on('ReceiveLocationRestored', onRestored);
    connection.on('ReceiveSOSMemberActivated', onMemberActivated);

    return () => {
      connection.off('ReceiveSOSTriggered', onTriggered);
      connection.off('ReceiveSOSResolved', onResolved);
      connection.off('ReceiveSOSCancelled', onCancelled);
      connection.off('ReceiveSOSMarkedAsFalseAlarm', onFalseAlarm);
      connection.off('ReceiveSeverityChanged', onSeverity);
      connection.off('ReceiveLocationUpdate', onLocation);
      connection.off('ReceiveLocationStale', onStale);
      connection.off('ReceiveLocationRestored', onRestored);
      connection.off('ReceiveSOSMemberActivated', onMemberActivated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, queryClient, addToast, updateCardState]);

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, payload }: { id: string; action: string; payload?: string }) => {
      if (action === 'severity') {
        await apiClient.put(`/api/sosalerts/${id}/severity`, { case: payload });
      } else {
        await apiClient.put(`/api/sosalerts/${id}/${action}`, {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      addToast({ type: 'success', title: 'SOS Alert Updated' });
    },
    onError: () => addToast({ type: 'error', title: 'Action Failed' }),
  });

  const handleAction = useCallback(
    (alertId: string) => (action: string, payload?: string) => {
      actionMutation.mutate({ id: alertId, action, payload });
    },
    [actionMutation],
  );

  const staleCount = alerts.filter((a) => a.isLocationStale || (cardStates[a.id]?.isStale ?? false)).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">SOS Monitor</h1>
          <span className={`w-2.5 h-2.5 rounded-full ${connectionState === 'Connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'
            }`} />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          {connectionState === 'Connected'
            ? <><Wifi className="w-4 h-4 text-emerald-400" /> Live updates active</>
            : <><WifiOff className="w-4 h-4 text-red-400" /> Reconnecting…</>}
        </div>
      </div>

      {/* Stats bar */}
     {data && data.totalCount > 0 && (
        <div className="flex flex-wrap gap-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
          {(['Critical', 'High', 'Standard'] as const).map((sev) => {
            const count = alerts.filter((a) => a.severity === sev).length;
            const color = sev === 'Critical' ? 'text-red-400' : sev === 'High' ? 'text-orange-400' : 'text-yellow-400';
            return (
              <div key={sev} className="flex items-center gap-2">
                <span className={`text-2xl font-black tabular-nums ${color}`}>{count}</span>
                <span className="text-gray-500 text-sm">{sev}</span>
              </div>
            );
          })} {/* 👈 القوس ده كان ناقص هنا */}
          
          {staleCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-bold tabular-nums">{staleCount}</span>
              <span className="text-gray-500 text-sm">Stale location</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-2xl font-black tabular-nums text-white">{data.totalCount}</span>
            <span className="text-gray-500 text-sm">Total Active</span>
          </div>
        </div>
      )}

      {/* Severity filter chips */}
      <div className="flex flex-wrap gap-2">
        {SEVERITIES.map((sev) => (
          <button
            key={sev || 'all'}
            onClick={() => handleSeverityChange(sev)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${severityFilter === sev ? SEV_ACTIVE[sev] : SEV_COLORS[sev]
              }`}
          >
            {SEV_LABELS[sev]}
          </button>
        ))}
      </div>

      {/* Alert grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => <Skeleton key={n} type="card" className="h-72" />)}
        </div>
      ) : !alerts.length ? (
        <EmptyState title="All Clear" message="No active SOS alerts in your jurisdiction." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {alerts.map((alert) => (
            <SOSCard
              key={alert.id}
              alert={alert}
              cardState={cardStates[alert.id] ?? { isStale: false, secondsSinceLastPing: null, activeMemberCount: 0 }}
              onAction={handleAction(alert.id)}
              isPending={actionMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}