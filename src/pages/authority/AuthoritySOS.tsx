/**
 * AuthoritySOS — SOS Monitor (Authority Control Center)
 *
 * Tracking display uses sosTrackingStatus helpers — mutually exclusive badges,
 * no last-ping text when totalLocationUpdates === 0, no map pins without
 * incident location data. Cards open SOSDetailModal for full initiator/history.
 */
import {
  useEffect, useRef, useCallback, useState, useReducer,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wifi, WifiOff, MapPin, AlertTriangle, CheckCircle,
  ChevronLeft, ChevronRight, Radio,
} from 'lucide-react';
import { differenceInSeconds, differenceInMinutes } from 'date-fns';
import apiClient from '../../api/client';
import { fetchSOSLocationHistory, useSOSAlerts } from '../../api/sos';
import { useSignalR } from '../../providers/SignalRProvider';
import { useCommunityNameMap, resolveCommunityName } from '../../hooks/useCommunityNameMap';
import { normalizeStatus, normalizeSeverity, SEVERITY_TO_INT } from '../../utils/sos';
import { resolveLastKnownLocation, unwrapApiPayload } from '../../utils/sosLocation';
import {
  getTrackingStatus,
  getTrackingBadgeLabel,
  hasIncidentLocationData,
  shouldShowLastPingText,
  shouldShowNoPingsMessage,
  isStaleForDisplay,
} from '../../utils/sosTrackingStatus';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import SOSLiveMap from '../../components/Map/SOSLiveMap';
import SeveritySelector from '../../components/SeveritySelector';
import SOSDetailModal from '../../components/SOS/SOSDetailModal';
import { useNotificationStore } from '../../store/notificationStore';
import type {
  SOSAlertListItem, SOSLocationDto,
  SOSSeverity, ActiveSOSCardState, SOSLiveStateDto,
} from '../../types';

// ─── Audio ─────────────────────────────────────────────────────────────────
function playAlertSound(severity?: string) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const beep = (f: number, t: number, d: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.start(t); o.stop(t + d);
    };
    const now = ctx.currentTime;
    if (severity === 'Critical') {
      beep(880, now, 0.15, 'square');
      beep(1100, now + 0.2, 0.15, 'square');
      beep(880, now + 0.4, 0.2, 'square');
    } else {
      beep(660, now, 0.12);
      beep(880, now + 0.18, 0.18);
    }
  } catch { /* noop — browser may block until user gesture */ }
}

// ─── Per-card state reducer ──────────────────────────────────────────────────
type CardAction =
  | { type: 'INIT'; id: string; state: ActiveSOSCardState }
  | { type: 'LOCATION_PING'; id: string; loc: SOSLocationDto }
  | { type: 'HISTORY_LOADED'; id: string; history: SOSLocationDto[] }
  | { type: 'TICK' }  // every second: increment lastPingAgeSeconds
  | { type: 'SEVERITY_CHANGED'; id: string; severity: SOSSeverity }
  | { type: 'SET_STALE'; id: string }
  | { type: 'SET_HEALTHY'; id: string }
  | { type: 'USER_PANNED'; id: string }
  | { type: 'RECENTER'; id: string };

type CardStates = Record<string, ActiveSOSCardState>;

function cardReducer(state: CardStates, action: CardAction): CardStates {
  switch (action.type) {
    case 'INIT':
      // Don't overwrite if already initialized (e.g. from SignalR before mount)
      if (state[action.id]) return state;
      return { ...state, [action.id]: action.state };

    case 'LOCATION_PING': {
      const prev = state[action.id];
      if (!prev) return state;
      const loc = action.loc;
      const merged = dedupeAndSort([...prev.locationHistory, loc]);
      return {
        ...state,
        [action.id]: {
          ...prev,
          locationHistory: merged,
          latestLocation: loc,
          totalPingsReceived: prev.totalPingsReceived + 1,
          lastPingAt: loc.recordedAtUtc,
          lastPingAgeSeconds: 0,
          isLocationStale: false,
        },
      };
    }

    case 'HISTORY_LOADED': {
      const prev = state[action.id];
      if (!prev) return state;
      const merged = dedupeAndSort([...prev.locationHistory, ...action.history]);
      const latest = merged.length > 0 ? merged[merged.length - 1] : prev.latestLocation;
      return {
        ...state,
        [action.id]: {
          ...prev,
          locationHistory: merged,
          latestLocation: latest,
          totalPingsReceived: Math.max(prev.totalPingsReceived, merged.length),
          lastPingAt: latest?.recordedAtUtc ?? prev.lastPingAt,
          lastPingAgeSeconds: latest
            ? differenceInSeconds(new Date(), new Date(latest.recordedAtUtc))
            : prev.lastPingAgeSeconds,
          isLocationStale: latest
            ? differenceInSeconds(new Date(), new Date(latest.recordedAtUtc)) > 90
            : prev.isLocationStale,
        },
      };
    }

    case 'TICK': {
      const next: CardStates = {};
      for (const [id, card] of Object.entries(state)) {
        if (card.totalPingsReceived === 0 && card.locationHistory.length === 0) {
          next[id] = { ...card, lastPingAgeSeconds: 0, isLocationStale: false };
          continue;
        }
        const age = card.lastPingAt
          ? differenceInSeconds(new Date(), new Date(card.lastPingAt))
          : card.lastPingAgeSeconds + 1;
        next[id] = {
          ...card,
          lastPingAgeSeconds: age,
          isLocationStale: age > 90,
        };
      }
      return next;
    }

    case 'SEVERITY_CHANGED':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], currentSeverity: action.severity } };

    case 'SET_STALE':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], isLocationStale: true } };

    case 'SET_HEALTHY':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], isLocationStale: false, lastPingAgeSeconds: 0 } };

    case 'USER_PANNED':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], userHasPanned: true } };

    case 'RECENTER':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], userHasPanned: false } };

    default:
      return state;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function dedupeAndSort(locs: SOSLocationDto[]): SOSLocationDto[] {
  const seen = new Set<string>();
  return locs
    .filter((l) => {
      const key = l.recordedAtUtc;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.recordedAtUtc).getTime() - new Date(b.recordedAtUtc).getTime());
}

// ─── Single tracking-status badge (mutually exclusive states) ────────────────
function TrackingStatusChip({
  totalLocationUpdates,
  locationHistoryLength,
  isLocationStale,
  ageSeconds,
}: {
  totalLocationUpdates: number;
  locationHistoryLength: number;
  isLocationStale: boolean;
  ageSeconds: number;
}) {
  const status = getTrackingStatus({ totalLocationUpdates, locationHistoryLength, isLocationStale });
  const label = getTrackingBadgeLabel(status);

  if (status === 'waiting') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <Radio className="w-2.5 h-2.5" /> {label}
      </span>
    );
  }
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {label} · {ageSeconds < 60 ? `${ageSeconds}s` : `${Math.floor(ageSeconds / 60)}m`} ago
      </span>
    );
  }
  const mins = Math.floor(ageSeconds / 60);
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
      ⚠ {label}
      {ageSeconds > 0 && ` · ${mins > 0 ? `${mins}m` : `${ageSeconds}s`} ago`}
    </span>
  );
}

// ─── Elapsed time counter ────────────────────────────────────────────────────
function ElapsedMinutes({ createdAtUtc }: { createdAtUtc: string }) {
  const [mins, setMins] = useState(() => differenceInMinutes(new Date(), new Date(createdAtUtc)));

  useEffect(() => {
    const id = setInterval(() => {
      setMins(differenceInMinutes(new Date(), new Date(createdAtUtc)));
    }, 60_000);
    return () => clearInterval(id);
  }, [createdAtUtc]);

  return <span className="text-white font-semibold tabular-nums">{mins}m</span>;
}

// ─── SOSCard ─────────────────────────────────────────────────────────────────
function SOSCard({
  alert,
  cardState,
  onAction,
  onOpenDetail,
  onPanned,
  onRecenter,
  recenterNonce,
  isReconnecting,
  isPending,
}: {
  alert: SOSAlertListItem;
  cardState: ActiveSOSCardState | null;
  onAction: (action: string, payload?: string) => void;
  onOpenDetail: () => void;
  onPanned: () => void;
  onRecenter: () => void;
  recenterNonce: number;
  isReconnecting: boolean;
  isPending: boolean;
}) {
  // GET /{id} for initiator display name only — not for map placeholder on summary cards.
  const { data: alertDetail } = useQuery<any>({
    queryKey: ['sos', alert.id, 'detail'],
    queryFn: async () => {
      const res = await apiClient.get(`/api/sosalerts/${alert.id}`);
      const d = unwrapApiPayload<any>(res.data);
      return {
        ...d,
        status: normalizeStatus(d.status),
        severity: normalizeSeverity(d.severity),
      };
    },
    staleTime: Infinity,
  });

  // ── Step 2: GET /{id}/live-state for initiatorName, memberLocations ──────────
  const { data: liveState } = useQuery<SOSLiveStateDto>({
    queryKey: ['sos', alert.id, 'live-state'],
    queryFn: () =>
      apiClient.get(`/api/sosalerts/${alert.id}/live-state`).then((r) => {
        const d = r.data;
        return {
          ...d,
          status: normalizeStatus(d.status),
          severity: normalizeSeverity(d.severity),
        };
      }),
    staleTime: 30_000,
  });

  // ── Derived values ────────────────────────────────────────────────────────
  const severity = cardState?.currentSeverity ?? normalizeSeverity(alert.severity);
  const isCritical = severity === 'Critical';
  const isHigh = severity === 'High';
  const locationHistory = cardState?.locationHistory ?? [];
  const totalPings = Math.max(
    cardState?.totalPingsReceived ?? alert.totalLocationUpdates,
    locationHistory.length > 0 ? 1 : 0,
  );
  const trackingInput = {
    totalLocationUpdates: totalPings,
    locationHistoryLength: locationHistory.length,
    isLocationStale: cardState?.isLocationStale ?? alert.isLocationStale,
  };
  const showStale = isStaleForDisplay(trackingInput);
  const ageSeconds = shouldShowLastPingText(trackingInput)
    ? (cardState?.lastPingAgeSeconds ??
        (alert.lastLocationPingAt
          ? differenceInSeconds(new Date(), new Date(alert.lastLocationPingAt))
          : 0))
    : 0;
  const latestLocation = cardState?.latestLocation ?? null;
  const accuracy = latestLocation?.accuracyMeters ?? null;
  const incidentHasLocation = hasIncidentLocationData(totalPings, locationHistory.length);

  const rawCommunityName = cardState?.communityName ?? 'Unknown Community';
  const communityName = rawCommunityName;
  const showCommunityIdFallback = rawCommunityName === 'Unknown Community';

  const reporter = alertDetail?.reporter;
  const lastKnownLocation = resolveLastKnownLocation(
    reporter,
    alertDetail?.recentLocations,
    liveState ?? null,
  );
  const initiatorName =
    liveState?.initiatorName ??
    reporter?.fullName ??
    null;
  const displayName = initiatorName ?? (alert.initiatorUserId.slice(0, 8) + '…');

  const borderClass = showStale
    ? 'border-amber-500/50 border-dashed'
    : isCritical
      ? 'border-red-500 shadow-lg shadow-red-900/20 animate-[pulse_3s_ease-in-out_infinite]'
      : isHigh
        ? 'border-orange-500/70 shadow-md shadow-orange-900/10'
        : 'border-gray-800';

  const severityBadgeClass = isCritical
    ? 'bg-red-600 animate-pulse'
    : isHigh
      ? 'bg-orange-500'
      : 'bg-yellow-500';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenDetail(); }}
      className={`bg-gray-900 rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all duration-300 cursor-pointer hover:border-indigo-500/40 ${borderClass}`}
    >
      {/* ── Header row: [Severity] [Community] [GPS chip] [Active Xm] ── */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity badge */}
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold text-white ${severityBadgeClass}`}>
            {severity}
          </span>

          {/* Community name — gray outlined chip; fallback shows truncated UUID */}
          <div className="flex flex-col">
            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-gray-800/50 text-gray-300 border border-gray-600">
              {communityName}
            </span>
            {showCommunityIdFallback && (
              <span className="text-[9px] text-gray-600 pl-3 mt-0.5 font-mono">
                Community ID: …{alert.communityId.slice(-8)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <TrackingStatusChip
            totalLocationUpdates={totalPings}
            locationHistoryLength={locationHistory.length}
            isLocationStale={trackingInput.isLocationStale}
            ageSeconds={ageSeconds}
          />
          {/* Active Xm counter */}
          <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
            Active <ElapsedMinutes createdAtUtc={alert.createdAtUtc} />
          </span>
        </div>
      </div>

      {/* ── Reconnecting banner (SignalR fallback active) ── */}
      {isReconnecting && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Reconnecting — polling live-state every 15s
        </div>
      )}

      {/* ── Message ── */}
      {alert.message && (
        <p className="text-white font-medium text-sm leading-snug">{alert.message}</p>
      )}

      {/* ── Metadata row ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 bg-gray-800/50 rounded-xl px-3 py-2.5">
        {/* Initiator */}
        <div className="flex items-center gap-1.5">
          {reporter?.profilePhotoUrl ? (
            <img
              src={reporter.profilePhotoUrl}
              alt={displayName}
              className="w-4 h-4 rounded-full object-cover border border-gray-700"
            />
          ) : null}
          <span className="text-gray-600">Initiator:</span>
          <span className="text-gray-200 font-medium">{displayName}</span>
        </div>

        {/* Ping count */}
        <div className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-gray-500" />
          {shouldShowNoPingsMessage(trackingInput) ? (
            <span className="text-amber-400 font-semibold">No pings — GPS may be unavailable</span>
          ) : (
            <span className="text-gray-300 font-medium">📡 {totalPings} pings</span>
          )}
        </div>

        {shouldShowLastPingText(trackingInput) && ageSeconds >= 0 && (
          <div className="flex items-center gap-1">
            <span className="text-gray-600">⏱ Last ping:</span>
            <span className={showStale ? 'text-amber-400' : 'text-gray-400'}>
              {ageSeconds < 60 ? `${ageSeconds}s ago` : `${Math.floor(ageSeconds / 60)}m ago`}
            </span>
          </div>
        )}

        {/* Accuracy */}
        {accuracy !== null && accuracy > 0 && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gray-500" />
            <span className="text-gray-300">±{Math.round(accuracy)}m</span>
          </div>
        )}

        {/* Coordinates — incident or last known profile */}
        {latestLocation ? (
          <span className={`font-mono text-[10px] ${showStale ? 'text-amber-400/70' : 'text-gray-500'}`}>
            {latestLocation.latitude.toFixed(5)}, {latestLocation.longitude.toFixed(5)}
          </span>
        ) : lastKnownLocation && !incidentHasLocation ? (
          <span className="font-mono text-[10px] text-gray-500">
            Last: {lastKnownLocation.lat.toFixed(5)}, {lastKnownLocation.lng.toFixed(5)}
          </span>
        ) : null}
      </div>

      {/* ── Member status row (from live-state) ── */}
      {liveState && liveState.memberLocations.length > 0 && (
        <div className="text-xs text-gray-400 bg-gray-800/30 rounded-xl px-3 py-2">
          👥 {liveState.totalActiveMembers} members active ·{' '}
          ⚠ {liveState.totalStaleMembers} stale ·{' '}
          ⏳ {liveState.totalLocationPendingMembers} pending
        </div>
      )}

      {/* ── Live map (7 layers) ── */}
      <div onClick={(e) => e.stopPropagation()}>
        <SOSLiveMap
          sosId={alert.id}
          locationHistory={locationHistory}
          latestLocation={latestLocation}
          lastPingAgeSeconds={ageSeconds}
          userHasPanned={cardState?.userHasPanned ?? false}
          onUserPanned={onPanned}
          onRecenter={onRecenter}
          recenterNonce={recenterNonce}
          lastKnownLocation={!incidentHasLocation ? lastKnownLocation : null}
          liveState={liveState ?? null}
          initiatorName={initiatorName}
          hasIncidentLocationData={incidentHasLocation}
        />
      </div>

      {/* ── Actions ── */}
      <div
        className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          onClick={() => onOpenDetail()}
          variant="secondary"
          className="w-full text-xs"
        >
          View Details →
        </Button>
        <Button
          size="sm"
          onClick={() => onAction('resolve')}
          isLoading={isPending}
          className="flex-1"
        >
          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Resolve
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onAction('false-alarm')}
          isLoading={isPending}
          className="flex-1"
        >
          ✗ False Alarm
        </Button>
        <div className="w-full">
          <SeveritySelector
            current={severity}
            alertId={alert.id}
            isPending={isPending}
            onConfirm={(newSev) => onAction('severity', newSev)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Severity filter chips ───────────────────────────────────────────────────
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

// ─── Pagination ──────────────────────────────────────────────────────────────
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

// ─── Main page ───────────────────────────────────────────────────────────────
export default function AuthoritySOS() {
  const queryClient = useQueryClient();
  const { connection, connectionState, joinCommunityGroup } = useSignalR();
  const addToast = useNotificationStore((s) => s.addToast);
  const communityNameMap = useCommunityNameMap();

  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [detailAlert, setDetailAlert] = useState<SOSAlertListItem | null>(null);
  const [recenterNonces, setRecenterNonces] = useState<Record<string, number>>({});
  const prevCritical = useRef(new Set<string>());

  // Per-card live state
  const [cardStates, dispatch] = useReducer(cardReducer, {});
  const cardStatesRef = useRef(cardStates);
  cardStatesRef.current = cardStates;

  // Fallback polling intervals when SignalR disconnects
  const pollingIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const lastGeneratedAt = useRef<Map<string, string>>(new Map());
  const alertCommunityGroupsJoined = useRef<Set<string>>(new Set());

  // ─── 1-second tick: age all lastPingAgeSeconds ───────────────────────────
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, []);

  const filters = {
    status: 'Active',
    ...(severityFilter ? { severity: severityFilter } : {}),
    page: currentPage,
    pageSize: 20,
  };

  const { data, isLoading } = useSOSAlerts(filters);
  const alerts: SOSAlertListItem[] = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Join SignalR groups for each active alert's community (live location events)
  useEffect(() => {
    if (connectionState !== 'Connected') return;
    for (const alert of alerts) {
      if (!alertCommunityGroupsJoined.current.has(alert.communityId)) {
        joinCommunityGroup(alert.communityId);
        alertCommunityGroupsJoined.current.add(alert.communityId);
      }
    }
  }, [alerts, connectionState, joinCommunityGroup]);

  // Periodic history sync — retries GET /locations after 403 backoff; fills missed SignalR pings
  useEffect(() => {
    if (!alerts.length) return;

    const syncHistories = async () => {
      for (const alert of alerts) {
        try {
          const history = await fetchSOSLocationHistory(alert.id);
          if (history.length === 0) continue;
          dispatch({ type: 'HISTORY_LOADED', id: alert.id, history });
          queryClient.setQueryData<SOSLocationDto[]>(
            ['sos', alert.id, 'locations'],
            (old) => dedupeAndSort([...(old ?? []), ...history]),
          );
        } catch {
          /* non-critical */
        }
      }
    };

    syncHistories();
    const intervalId = setInterval(syncHistories, 30_000);
    return () => clearInterval(intervalId);
  }, [alerts, queryClient]);

  // ─── Bootstrap a card when an alert enters state ──────────────────────────
  const bootstrapCard = useCallback(
    async (alert: SOSAlertListItem, overrideCommunityName?: string) => {
      const id = alert.id;
      const communityName =
        overrideCommunityName ??
        resolveCommunityName(communityNameMap, alert.communityId);

      const hasListPings = alert.totalLocationUpdates > 0;
      const initState: ActiveSOSCardState = {
        alertId: id,
        communityName,
        locationHistory: [],
        latestLocation: null,
        totalPingsReceived: alert.totalLocationUpdates,
        lastPingAt: hasListPings ? alert.lastLocationPingAt : null,
        lastPingAgeSeconds: hasListPings && alert.lastLocationPingAt
          ? differenceInSeconds(new Date(), new Date(alert.lastLocationPingAt))
          : 0,
        isLocationStale: hasListPings ? alert.isLocationStale : false,
        userHasPanned: false,
        currentSeverity: normalizeSeverity(alert.severity),
      };

      dispatch({ type: 'INIT', id, state: initState });

      // Seed location history (403 → recentLocations from GET /{id}; live-state + SignalR fill gaps)
      try {
        const history = await fetchSOSLocationHistory(id);
        if (history.length > 0) {
          dispatch({ type: 'HISTORY_LOADED', id, history });
          queryClient.setQueryData<SOSLocationDto[]>(
            ['sos', id, 'locations'],
            (old) => dedupeAndSort([...(old ?? []), ...history])
          );
        }
      } catch {
        // Non-critical: live-state polling + SignalR will fill in from this point forward
      }
    },
    [communityNameMap, queryClient]
  );

  // ─── Bootstrap all alerts when list loads / communityNameMap resolves ─────
  const bootstrappedIds = useRef(new Set<string>());
  useEffect(() => {
    for (const alert of alerts) {
      if (!bootstrappedIds.current.has(alert.id)) {
        bootstrappedIds.current.add(alert.id);
        bootstrapCard(alert);
      } else if (cardStatesRef.current[alert.id]) {
        // Already bootstrapped but communityName might have resolved
        const resolved = communityNameMap.get(alert.communityId);
        if (resolved && cardStatesRef.current[alert.id].communityName === 'Unknown Community') {
          dispatch({
            type: 'INIT',
            id: alert.id,
            state: {
              ...cardStatesRef.current[alert.id],
              communityName: resolved,
            },
          });
        }
      }
    }
  }, [alerts, communityNameMap, bootstrapCard]);

  // ─── Sound for new Critical alerts (normalize severity first) ────────────
  useEffect(() => {
    alerts.forEach((alert) => {
      if (normalizeSeverity(alert.severity) === 'Critical' && !prevCritical.current.has(alert.id)) {
        playAlertSound('Critical');
        prevCritical.current.add(alert.id);
      }
    });
  }, [alerts]);

  // ─── Fallback polling: polls GET /{id}/live-state every 15s ─────────────
  // (live-state has initiator coords + member locations + staleness)
  const startPolling = useCallback(
    (alertId: string) => {
      if (pollingIntervals.current.has(alertId)) return;
      const id = setInterval(async () => {
        try {
          const lsRes = await apiClient.get<SOSLiveStateDto>(`/api/sosalerts/${alertId}/live-state`);
          const ls = lsRes.data;
          const prevGen = lastGeneratedAt.current.get(alertId);
          if (prevGen && ls.generatedAt === prevGen) return;
          lastGeneratedAt.current.set(alertId, ls.generatedAt);

          queryClient.setQueryData(['sos', alertId, 'live-state'], ls);

          // Only treat live-state coords as pings when list/history already has incident data
          const card = cardStatesRef.current[alertId];
          const hasData = card &&
            hasIncidentLocationData(card.totalPingsReceived, card.locationHistory.length);
          if (hasData && ls.initiatorLatitude && ls.initiatorLatitude !== 0) {
            const syntheticLoc: SOSLocationDto = {
              latitude: ls.initiatorLatitude,
              longitude: ls.initiatorLongitude,
              accuracyMeters: null,
              altitudeMeters: null,
              recordedAtUtc: ls.initiatorLastPingAt ?? new Date().toISOString(),
              locationName: null,
            };
            dispatch({ type: 'LOCATION_PING', id: alertId, loc: syntheticLoc });
          }
        } catch { /* noop */ }
      }, 15_000);
      pollingIntervals.current.set(alertId, id);
    },
    [queryClient]
  );

  const stopAllPolling = useCallback(() => {
    for (const id of pollingIntervals.current.values()) clearInterval(id);
    pollingIntervals.current.clear();
  }, []);

  // ─── SignalR event handlers ───────────────────────────────────────────────
  useEffect(() => {
    if (!connection) return;

    const onTriggered = (_communityId: string, alert: any) => {
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      if (alert.communityId) {
        joinCommunityGroup(alert.communityId);
        alertCommunityGroupsJoined.current.add(alert.communityId);
      }
      const normalized = {
        ...alert,
        status: normalizeStatus(alert.status),
        severity: normalizeSeverity(alert.severity),
      };
      queryClient.setQueryData(['sos', alert.id], normalized);
      const communityName = resolveCommunityName(communityNameMap, alert.communityId);
      const sev = normalized.severity as SOSSeverity;
      addToast({
        type: 'sos',
        title: 'New SOS Alert',
        description: alert.message ?? undefined,
        communityName,
        severity: sev,
        actionLink: '/authority/sos',
      });
      if (sev === 'Critical') playAlertSound('Critical');
    };

    const onResolved = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
    const onCancelled = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
    const onFalseAlarm = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });

    // ReceiveLocationUpdate — 2-arg form per backend ISOSClient
    const onLocation = (sosAlertId: string, loc: SOSLocationDto) => {
      dispatch({ type: 'LOCATION_PING', id: sosAlertId, loc });
      // Also keep react-query cache fresh (SOSLiveMap reads it on mount)
      queryClient.setQueryData<SOSLocationDto[]>(
        ['sos', sosAlertId, 'locations'],
        (old) => {
          const merged = [...(old ?? []), loc];
          return dedupeAndSort(merged);
        }
      );
    };

    const onSeverityChanged = (sosAlertId: string, newSeverity: string) => {
      const sev = normalizeSeverity(newSeverity);
      dispatch({ type: 'SEVERITY_CHANGED', id: sosAlertId, severity: sev });
      // Also invalidate the detail query so reporter info refreshes
      queryClient.invalidateQueries({ queryKey: ['sos', sosAlertId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      if (sev === 'Critical') {
        playAlertSound('Critical');
        addToast({ type: 'warning', title: '⚠ SOS escalated to Critical', description: 'Severity updated by authority.' });
      }
    };

    const onStale = (sosAlertId: string, secondsSinceLastPing: number) => {
      dispatch({ type: 'SET_STALE', id: sosAlertId });
      const alert = alerts.find((a) => a.id === sosAlertId);
      addToast({
        type: 'warning',
        title: '⚠ Location signal lost',
        description: `SOS${alert ? ` in ${communityNameMap.get(alert.communityId) ?? 'a community'}` : ''} — no ping for ${Math.round(secondsSinceLastPing)}s.`,
      });
    };

    const onRestored = (sosAlertId: string) => {
      dispatch({ type: 'SET_HEALTHY', id: sosAlertId });
      addToast({ type: 'success', title: '✓ Location signal restored' });
    };

    const onMemberActivated = (_sosAlertId: string, _userId: string, memberName: string) => {
      addToast({ type: 'info', title: `${memberName} is now tracking this SOS` });
    };

    // ─── Disconnect / reconnect ────────────────────────────────────────────
    const onDisconnect = () => {
      // Start polling for every active card
      for (const alertId of Object.keys(cardStatesRef.current)) {
        startPolling(alertId);
      }
      addToast({ type: 'warning', title: '⚠ Live updates paused — using polling fallback' });
    };

    const onReconnect = () => {
      stopAllPolling();
      lastGeneratedAt.current.clear();
      addToast({ type: 'success', title: '✓ Live updates restored' });
      for (const alert of alerts) {
        queryClient.invalidateQueries({ queryKey: ['sos', alert.id, 'live-state'] });
        bootstrapCard(alert);
      }
    };

    connection.on('ReceiveSOSTriggered', onTriggered);
    connection.on('ReceiveSOSResolved', onResolved);
    connection.on('ReceiveSOSCancelled', onCancelled);
    connection.on('ReceiveSOSMarkedAsFalseAlarm', onFalseAlarm);
    connection.on('ReceiveLocationUpdate', onLocation);
    connection.on('ReceiveSeverityChanged', onSeverityChanged);
    connection.on('ReceiveLocationStale', onStale);
    connection.on('ReceiveLocationRestored', onRestored);
    connection.on('ReceiveSOSMemberActivated', onMemberActivated);
    connection.onclose(onDisconnect);
    connection.onreconnected(onReconnect);

    return () => {
      connection.off('ReceiveSOSTriggered', onTriggered);
      connection.off('ReceiveSOSResolved', onResolved);
      connection.off('ReceiveSOSCancelled', onCancelled);
      connection.off('ReceiveSOSMarkedAsFalseAlarm', onFalseAlarm);
      connection.off('ReceiveLocationUpdate', onLocation);
      connection.off('ReceiveSeverityChanged', onSeverityChanged);
      connection.off('ReceiveLocationStale', onStale);
      connection.off('ReceiveLocationRestored', onRestored);
      connection.off('ReceiveSOSMemberActivated', onMemberActivated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, queryClient, addToast, communityNameMap]);

  // ─── Action mutation ──────────────────────────────────────────────────────
  // NOTE: PUT /{id}/severity body is integer enum: { severity: 0|1|2 }
  // No optimistic update for severity — update confirmed from API response.
  const actionMutation = useMutation({
    mutationFn: async ({ id, action, payload }: { id: string; action: string; payload?: string }) => {
      if (action === 'severity') {
        // Convert string severity to integer before sending
        const sevInt = SEVERITY_TO_INT[payload ?? 'Standard'] ?? 0;
        const res = await apiClient.put(`/api/sosalerts/${id}/severity`, { severity: sevInt });
        return { action, id, responseData: res.data };
      } else {
        await apiClient.put(`/api/sosalerts/${id}/${action}`, {});
        return { action, id, responseData: null };
      }
    },
    onSuccess: (result: { action: string; id: string; responseData: any }) => {
      if (result.action === 'severity' && result.responseData) {
        const confirmedSev = normalizeSeverity(result.responseData.severity);
        dispatch({ type: 'SEVERITY_CHANGED', id: result.id, severity: confirmedSev });
      }
      if (result.action === 'resolve' || result.action === 'false-alarm') {
        setDetailAlert(null);
      }
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      addToast({ type: 'success', title: 'SOS Alert Updated' });
    },
    onError: () => addToast({ type: 'error', title: 'Action Failed' }),
  });

  const handleAction = useCallback(
    (alertId: string) => (action: string, payload?: string) => {
      actionMutation.mutate({ id: alertId, action, payload });
    },
    [actionMutation]
  );

  const handleSeverityChange = (sev: string) => {
    setSeverityFilter(sev);
    setCurrentPage(1);
  };

  const staleCount = alerts.filter((a) => {
    const card = cardStates[a.id];
    const total = Math.max(a.totalLocationUpdates, card?.totalPingsReceived ?? 0);
    const histLen = card?.locationHistory.length ?? 0;
    return isStaleForDisplay({
      totalLocationUpdates: total,
      locationHistoryLength: histLen,
      isLocationStale: card?.isLocationStale ?? a.isLocationStale,
    });
  }).length;

  // Normalize severity for stats bar (list returns strings, so normalizeSeverity handles both)
  const getSeverityForAlert = (a: SOSAlertListItem) =>
    cardStates[a.id]?.currentSeverity ?? normalizeSeverity(a.severity);

  const isReconnecting = connectionState !== 'Connected';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page header ── */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">SOS Monitor</h1>
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connectionState === 'Connected'
                ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse'
                : connectionState === 'Reconnecting'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-red-500'
            }`}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          {connectionState === 'Connected' ? (
            <><Wifi className="w-4 h-4 text-emerald-400" /> Live updates active</>
          ) : connectionState === 'Reconnecting' ? (
            <><WifiOff className="w-4 h-4 text-amber-400" /> Reconnecting… (polling active)</>
          ) : (
            <><WifiOff className="w-4 h-4 text-red-400" /> Disconnected — polling fallback</>
          )}
        </div>
      </div>

      {/* ── Stats bar ── */}
      {data && data.totalCount > 0 && (
        <div className="flex flex-wrap gap-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
          {(['Critical', 'High', 'Standard'] as const).map((sev) => {
            const count = alerts.filter((a) => getSeverityForAlert(a) === sev).length;
            const color = sev === 'Critical' ? 'text-red-400' : sev === 'High' ? 'text-orange-400' : 'text-yellow-400';
            return (
              <div key={sev} className="flex items-center gap-2">
                <span className={`text-2xl font-black tabular-nums ${color}`}>{count}</span>
                <span className="text-gray-500 text-sm">{sev}</span>
              </div>
            );
          })}

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

      {/* ── Severity filter chips ── */}
      <div className="flex flex-wrap gap-2">
        {SEVERITIES.map((sev) => (
          <button
            key={sev || 'all'}
            onClick={() => handleSeverityChange(sev)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              severityFilter === sev ? SEV_ACTIVE[sev] : SEV_COLORS[sev]
            }`}
          >
            {SEV_LABELS[sev]}
          </button>
        ))}
      </div>

      {/* ── Alert grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => <Skeleton key={n} type="card" className="h-96" />)}
        </div>
      ) : !alerts.length ? (
        <EmptyState title="All Clear" message="No active SOS alerts in your jurisdiction." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {alerts.map((alert) => (
            <SOSCard
              key={alert.id}
              alert={alert}
              cardState={cardStates[alert.id] ?? null}
              onAction={handleAction(alert.id)}
              onOpenDetail={() => setDetailAlert(alert)}
              onPanned={() => dispatch({ type: 'USER_PANNED', id: alert.id })}
              onRecenter={() => {
                dispatch({ type: 'RECENTER', id: alert.id });
                setRecenterNonces((prev) => ({
                  ...prev,
                  [alert.id]: (prev[alert.id] ?? 0) + 1,
                }));
              }}
              recenterNonce={recenterNonces[alert.id] ?? 0}
              isReconnecting={isReconnecting}
              isPending={actionMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {detailAlert && (
        <SOSDetailModal
          alert={detailAlert}
          communityNameMap={communityNameMap}
          onClose={() => setDetailAlert(null)}
          onAction={handleAction(detailAlert.id)}
          isPending={actionMutation.isPending}
        />
      )}
    </div>
  );
}