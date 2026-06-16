/**
 * Citizen SOS Page — v2
 *
 * - Checks memberStatus of each community: if ANY is Active → SOS allowed
 * - LocationPending → shows warning + disables button
 * - Active SOS: real-time location pinging every 10s via watchPosition
 * - On reconnect → fetches live-state snapshot via GET /api/sosalerts/{id}/live-state
 * - On going offline → queues locations, uploads batch on reconnect
 * - Cancel / manual stop
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Siren, AlertTriangle, MapPin, Wifi, WifiOff,
  Clock, XCircle, Navigation, CheckCircle,
} from 'lucide-react';
import apiClient from '../../api/client';
import { useNotificationStore } from '../../store/notificationStore';
import { useSignalR } from '../../providers/SignalRProvider';
import type { SOSBatchLocationItem, SOSLiveStateDto } from '../../types';

// ── Severity config ──────────────────────────────────────────────
const SEVERITIES = [
  { value: 'Standard', label: 'Standard',        color: 'from-orange-600 to-red-600',  glow: 'shadow-orange-500/40' },
  { value: 'High',     label: 'High Priority',   color: 'from-red-600 to-red-700',     glow: 'shadow-red-500/50'    },
  { value: 'Critical', label: 'Critical !!!',    color: 'from-red-700 to-rose-800',    glow: 'shadow-rose-600/60'   },
];

type ActiveSOS = { id: string; communityId: string; severity: string };

export default function SOS() {
  const addToast     = useNotificationStore((s) => s.addToast);
  const { isConnected } = useSignalR();

  const [severity,   setSeverity]   = useState('Standard');
  const [message,    setMessage]    = useState('');
  const [loading,    setLoading]    = useState(false);
  const [activeSOS,  setActiveSOS]  = useState<ActiveSOS | null>(null);
  const [pingCount,  setPingCount]  = useState(0);
  const [isStale,    setIsStale]    = useState(false);

  // Offline location queue
  const locationQueue = useRef<SOSBatchLocationItem[]>([]);
  const watchIdRef    = useRef<number | null>(null);

  // ── Check community membership & LocationPending status ──────────
  const { data: communities } = useQuery({
    queryKey: ['communities', 'my'],
    queryFn: () => apiClient.get('/api/community').then((r) => r.data ?? []),
  });

  const communityList: any[] = Array.isArray(communities) ? communities : communities?.communities ?? [];
  const hasActiveMembership  = communityList.some((c: any) =>
    (c.userMemberStatus ?? c.memberStatus ?? 'Active') === 'Active'
  );
  const hasPendingMembership = communityList.some((c: any) =>
    (c.userMemberStatus ?? c.memberStatus) === 'LocationPending'
  );
  const hasAnyCommunity = communityList.length > 0;

  // Default community: first Active one
  const defaultCommunity = communityList.find((c: any) =>
    (c.userMemberStatus ?? c.memberStatus ?? 'Active') === 'Active'
  );

  // ── Live-state snapshot on reconnect ─────────────────────────────
  const { data: liveState } = useQuery<SOSLiveStateDto>({
    queryKey: ['sos', activeSOS?.id, 'live-state'],
    queryFn: () =>
      apiClient.get(`/api/sosalerts/${activeSOS!.id}/live-state`).then((r) => r.data),
    enabled: !!activeSOS?.id,
    refetchInterval: 30_000,
  });

  // Sync isStale from live-state
  useEffect(() => {
    if (liveState) setIsStale(liveState.isInitiatorLocationStale);
  }, [liveState]);

  // ── Location pinging ─────────────────────────────────────────────
  const sendLocation = useCallback(async (sosId: string, pos: GeolocationPosition) => {
    const payload: SOSBatchLocationItem = {
      latitude:       pos.coords.latitude,
      longitude:      pos.coords.longitude,
      accuracyMeters: pos.coords.accuracy ?? undefined,
      altitudeMeters: pos.coords.altitude ?? undefined,
      recordedAtUtc:  new Date().toISOString(),
    };

    if (!isConnected) {
      // Queue for batch upload later (max 50)
      locationQueue.current = [...locationQueue.current, payload].slice(-50);
      return;
    }

    try {
      await apiClient.post(`/api/sosalerts/${sosId}/location`, payload);
      setPingCount((n) => n + 1);
      setIsStale(false);
    } catch {
      locationQueue.current = [...locationQueue.current, payload].slice(-50);
    }
  }, [isConnected]);

  // Upload offline queue when connection restored
  const flushQueue = useCallback(async (sosId: string) => {
    if (!locationQueue.current.length) return;
    const batch = [...locationQueue.current];
    locationQueue.current = [];
    try {
      await apiClient.post(`/api/sosalerts/${sosId}/locations/batch`, { locations: batch });
      setPingCount((n) => n + batch.length);
    } catch {
      // Re-enqueue on failure
      locationQueue.current = [...batch, ...locationQueue.current].slice(-50);
    }
  }, []);

  useEffect(() => {
    if (isConnected && activeSOS) flushQueue(activeSOS.id);
  }, [isConnected, activeSOS, flushQueue]);

  // Start / stop GPS watch
  const startTracking = useCallback((sosId: string) => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendLocation(sosId, pos),
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, [sendLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    locationQueue.current = [];
  }, []);

  // ── Trigger SOS ──────────────────────────────────────────────────
  const triggerSOS = async () => {
    if (!defaultCommunity) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/api/sosalerts/trigger', {
        severity,
        message: message.trim() || undefined,
        communityId: defaultCommunity.id,
      });
      const alert = res.data;
      setActiveSOS({ id: alert.id ?? alert.sosAlertId, communityId: defaultCommunity.id, severity });
      startTracking(alert.id ?? alert.sosAlertId);
      setPingCount(0);
      addToast({ type: 'sos', title: '🚨 SOS Triggered', description: 'Help is on the way. Stay calm.', severity });
    } catch (e: any) {
      addToast({ type: 'error', title: 'SOS Failed', description: e?.response?.data?.message ?? 'Could not trigger SOS.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Cancel SOS ───────────────────────────────────────────────────
  const cancelSOS = async () => {
    if (!activeSOS) return;
    try {
      await apiClient.put(`/api/sosalerts/${activeSOS.id}/cancel`);
      stopTracking();
      setActiveSOS(null);
      setPingCount(0);
      setIsStale(false);
      addToast({ type: 'info', title: 'SOS Cancelled', description: 'Your alert has been cancelled.' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Cancel Failed', description: e?.response?.data?.message ?? 'Could not cancel.' });
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopTracking(), [stopTracking]);

  // ── Active SOS screen ────────────────────────────────────────────
  if (activeSOS) {
    const sevColor = SEVERITIES.find((s) => s.value === activeSOS.severity)?.color ?? SEVERITIES[0].color;
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Pulsing ring */}
          <div className="relative flex items-center justify-center mb-8">
            <div className={`absolute w-52 h-52 rounded-full bg-gradient-to-br ${sevColor} opacity-20 animate-ping`} />
            <div className={`absolute w-44 h-44 rounded-full bg-gradient-to-br ${sevColor} opacity-30 animate-pulse`} />
            <div className={`relative w-36 h-36 rounded-full bg-gradient-to-br ${sevColor} flex flex-col items-center justify-center shadow-2xl`}>
              <Siren className="w-10 h-10 text-white" />
              <p className="text-white text-xs font-bold mt-1">ACTIVE</p>
            </div>
          </div>

          {/* Status */}
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">SOS Active</h2>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                activeSOS.severity === 'Critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                activeSOS.severity === 'High'     ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                    'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}>
                {activeSOS.severity}
              </span>
            </div>

            {/* Location status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
              isStale
                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            }`}>
              {isStale ? <WifiOff className="w-3.5 h-3.5" /> : <Navigation className="w-3.5 h-3.5 animate-pulse" />}
              {isStale ? 'Location signal lost' : `Broadcasting location • ${pingCount} pings sent`}
            </div>

            {/* Connection status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isConnected
                ? 'Connected to real-time hub'
                : `Offline — ${locationQueue.current.length} locations queued`}
            </div>

            {/* Live state info */}
            {liveState && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                {liveState.activeMemberCount} active community members
              </div>
            )}

            {/* Cancel */}
            <button
              onClick={cancelSOS}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
            >
              <XCircle className="w-4 h-4" /> Cancel Alert
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-trigger screen ────────────────────────────────────────────
  const canTrigger = hasActiveMembership && defaultCommunity;
  const sevConfig  = SEVERITIES.find((s) => s.value === severity) ?? SEVERITIES[0];

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-black text-white">Emergency SOS</h1>
          <p className="text-sm text-gray-500 mt-1">Only use in genuine emergencies</p>
        </div>

        {/* LocationPending warning */}
        {hasPendingMembership && !hasActiveMembership && (
          <div className="flex items-start gap-3 px-4 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-300">Location Required</p>
              <p className="text-xs text-amber-400/80 mt-1">
                Your community membership is pending location verification. Share your location in Communities to activate SOS.
              </p>
            </div>
          </div>
        )}

        {/* No community warning */}
        {!hasAnyCommunity && (
          <div className="flex items-start gap-3 px-4 py-4 rounded-2xl bg-gray-800 border border-gray-700">
            <AlertTriangle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-gray-300">No Community Joined</p>
              <p className="text-xs text-gray-500 mt-1">
                Join a community to use the SOS feature.
              </p>
            </div>
          </div>
        )}

        {/* Community target */}
        {defaultCommunity && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-xs text-gray-400">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            Alert will be sent to: <span className="text-white font-semibold ml-1">{defaultCommunity.name}</span>
          </div>
        )}

        {/* Severity selector */}
        <div className="flex gap-2">
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSeverity(s.value)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                severity === s.value
                  ? `bg-gradient-to-br ${s.color} text-white border-transparent shadow-lg ${s.glow}`
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Message */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional: Describe your emergency…"
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-red-500 resize-none transition-colors"
        />

        {/* SOS button */}
        <div className="flex justify-center">
          <button
            onClick={triggerSOS}
            disabled={!canTrigger || loading}
            className={`relative w-44 h-44 rounded-full text-white font-black text-3xl transition-all
              bg-gradient-to-br ${sevConfig.color}
              shadow-2xl ${sevConfig.glow}
              hover:scale-105 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100
              ${canTrigger && !loading ? 'animate-none hover:shadow-[0_0_60px_rgba(220,38,38,0.6)]' : ''}
            `}
          >
            {loading ? (
              <span className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin inline-block" />
            ) : (
              <>
                <Siren className="w-12 h-12 mx-auto" />
                <p className="text-sm mt-1">SOS</p>
              </>
            )}
          </button>
        </div>

        {/* Info chips */}
        <div className="flex justify-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />GPS tracked</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Real-time</span>
          <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />Offline safe</span>
        </div>
      </div>
    </div>
  );
}