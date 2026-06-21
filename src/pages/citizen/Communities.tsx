/**
 * Communities — v2
 *
 * Tabs:
 *  My Communities  — list joined, show memberStatus (Active / LocationPending)
 *  Discover        — search all, join by invite code, nearby geo
 *
 * Creator actions (on My Communities you created):
 *  Regenerate invite code / Revoke invite code / Copy code / Remind pending member
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, UserMinus, MapPin, Search,
  Globe2, Key, RefreshCw, Trash2, Copy, CheckCheck,
  AlertTriangle, Navigation, Clock,
} from 'lucide-react';
import { communityApi, patchCommunityInviteCodeInCache, resolveCommunityInviteCode, resolveCommunityInviteCodeExpiresAt, forgetCommunityInviteCode } from '../../api/community';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNotificationStore } from '../../store/notificationStore';
import { useSignalR } from '../../providers/SignalRProvider';
import { useAuthStore } from '../../store/authStore';
import type { MemberStatus, CommunityType, JoinCommunityResponse } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────
const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  0: 'Neighborhood',
  1: 'Building',
  2: 'Private Group',
};

const COMMUNITY_TYPE_COLORS: Record<CommunityType, string> = {
  0: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  1: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  2: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
};

function MemberStatusBadge({ status }: { status?: MemberStatus }) {
  if (!status || status === 'Active') return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
      <Clock className="w-2.5 h-2.5" />
      Location Pending
    </span>
  );
}

function CommunityTypeBadge({ type }: { type?: CommunityType }) {
  const t = type ?? 0;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${COMMUNITY_TYPE_COLORS[t]}`}>
      {COMMUNITY_TYPE_LABELS[t]}
    </span>
  );
}

// ── Copy invite code button ───────────────────────────────────────
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-300 hover:text-white transition-colors">
      <span className="tracking-widest">{code}</span>
      {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── My community card ─────────────────────────────────────────────
function MyCommunityCard({
  community,
  userId,
  onLeave,
  onRegenerate,
  onRevoke,
}: {
  community: any;
  userId: string;
  onLeave: (id: string, name: string) => void;
  onRegenerate: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  const isCreator = community.createdById === userId;
  const inviteCode: string | null =
    resolveCommunityInviteCode(community.id, community.inviteCode ?? null);
  const inviteCodeExpiresAt =
    resolveCommunityInviteCodeExpiresAt(community.id, community.inviteCodeExpiresAt ?? null);
  const memberStatus: MemberStatus = community.userMemberStatus ?? 'Active';

  return (
    <div className={`bg-gray-900 border rounded-2xl p-5 flex flex-col gap-3 transition-colors ${
      memberStatus === 'LocationPending' ? 'border-amber-500/30' : 'border-gray-800 hover:border-gray-700'
    }`}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
          {community.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-1.5">
            <h3 className="font-bold text-white text-sm leading-tight">{community.name}</h3>
            <CommunityTypeBadge type={community.communityType} />
            <MemberStatusBadge status={memberStatus} />
          </div>
          {community.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{community.description}</p>
          )}
        </div>
      </div>

      {/* LocationPending warning */}
      {memberStatus === 'LocationPending' && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Location Required</p>
            <p className="text-[10px] text-amber-400/70 mt-0.5">
              Your SOS button is disabled until you share your location with this community.
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          {community.memberCount ?? 0} members
        </span>
        {community.centroidLatitude != null && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Located
          </span>
        )}
        {isCreator && <span className="text-indigo-400 font-semibold">Creator</span>}
      </div>

      {/* Creator: invite code section */}
      {isCreator && (
        <div className="pt-2 border-t border-gray-800 space-y-2">
          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Invite Code</p>
          {inviteCode ? (
            <div className="flex items-center justify-between gap-2">
              <CopyCode code={inviteCode} />
              {inviteCodeExpiresAt && (
                <span className="text-[10px] text-gray-500">
                  Expires {new Date(inviteCodeExpiresAt).toLocaleDateString()}
                </span>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => onRegenerate(community.id)}
                  title="Generate new code"
                  className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRevoke(community.id)}
                  title="Revoke invite code"
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onRegenerate(community.id)}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Key className="w-3.5 h-3.5" /> Generate invite code
            </button>
          )}
        </div>
      )}

      {/* Leave button */}
      <button
        onClick={() => onLeave(community.id, community.name)}
        className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 transition-colors"
      >
        <UserMinus className="w-3.5 h-3.5" /> Leave Community
      </button>
    </div>
  );
}

// ── Discover card ─────────────────────────────────────────────────
function DiscoverCard({ community, isMember, onJoin }: { community: any; isMember: boolean; onJoin: (id: string) => void }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gray-700 text-gray-300 flex items-center justify-center font-bold text-sm shrink-0">
          {community.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-1.5">
            <h3 className="font-bold text-white text-sm leading-tight truncate">{community.name}</h3>
            <CommunityTypeBadge type={community.communityType} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{community.memberCount ?? 0}</span>
            {community.distanceMeters != null && (
              <span className="flex items-center gap-1 text-indigo-400">
                <Navigation className="w-3 h-3" />
                {community.distanceMeters < 1000
                  ? `${Math.round(community.distanceMeters)}m away`
                  : `${(community.distanceMeters / 1000).toFixed(1)}km away`}
              </span>
            )}
          </div>
        </div>
      </div>
      {isMember ? (
        <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
          <CheckCheck className="w-3.5 h-3.5" /> Joined
        </div>
      ) : (
        <button
          onClick={() => onJoin(community.id)}
          className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 hover:bg-indigo-400/20 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" /> Join
        </button>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function Communities() {
  const qc       = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const user     = useAuthStore((s) => s.user);
  const userId   = (user as any)?.id ?? '';
  const { joinCommunityGroup, leaveCommunityGroup } = useSignalR();

  const [tab,        setTab]        = useState<'mine' | 'discover'>('mine');
  const [search,     setSearch]     = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [leaveModal, setLeaveModal] = useState<{ id: string; name: string } | null>(null);
  const [joinResult, setJoinResult] = useState<JoinCommunityResponse | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // My communities
  const { data: myData, isLoading: loadingMine } = useQuery({
    queryKey: ['communities', 'my'],
    queryFn: () => apiClient.get('/api/community').then((r) => r.data ?? []),
  });
  const myCommunities: any[] = Array.isArray(myData) ? myData : myData?.communities ?? myData?.items ?? [];
  const myIds = new Set(myCommunities.map((c: any) => c.id));

  // All communities (discover tab)
  const { data: allData, isLoading: loadingAll } = useQuery({
    queryKey: ['communities', 'all', { search }],
    queryFn: () =>
      apiClient.get('/api/community/all', { params: { search: search || undefined, pageSize: 30 } })
        .then((r) => r.data?.communities ?? r.data ?? []),
    enabled: tab === 'discover',
  });
  const allCommunities: any[] = Array.isArray(allData) ? allData : [];

  // Invalidate helper
  const refetch = () => {
    qc.invalidateQueries({ queryKey: ['communities', 'my'] });
    qc.invalidateQueries({ queryKey: ['communities', 'all'] });
  };

  // ── Mutations ──────────────────────────────────────────────────
  const { mutate: joinById } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/community/${id}/join`),
    onSuccess: (_d, id) => {
      addToast({ type: 'success', title: 'Joined!', description: 'You joined the community.' });
      refetch();
      joinCommunityGroup(id);
    },
    onError: () => addToast({ type: 'error', title: 'Join failed' }),
  });

  const { mutate: joinByCode, isPending: joiningCode } = useMutation<JoinCommunityResponse>({
    mutationFn: () =>
      apiClient.post('/api/community/join', { inviteCode: inviteCode.trim().toUpperCase() })
        .then((r) => r.data),
    onSuccess: (res) => {
      setJoinResult(res);
      setInviteCode('');
      refetch();
      joinCommunityGroup(res.communityId);
      if (res.requiresLocation) {
        addToast({ type: 'warning', title: `Joined "${res.communityName}"`, description: 'Please share your location to activate SOS.' });
      } else {
        addToast({ type: 'success', title: `Joined "${res.communityName}"!` });
      }
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Invalid code', description: e?.response?.data?.message ?? 'The invite code is invalid or expired.' }),
  });

  const { mutate: leaveMutation } = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/community/${id}/leave`),
    onSuccess: (_d, id) => {
      addToast({ type: 'info', title: 'Left community' });
      refetch();
      leaveCommunityGroup(id);
      setLeaveModal(null);
    },
    onError: () => addToast({ type: 'error', title: 'Could not leave community' }),
  });

  const { mutate: regenerateCode } = useMutation({
    mutationFn: (id: string) => communityApi.regenerateInviteCode(id),
    onSuccess: (result, id) => {
      patchCommunityInviteCodeInCache(
        qc,
        result.communityId || id,
        result.inviteCode,
        result.inviteCodeExpiresAt,
      );
      addToast({
        type: 'success',
        title: 'New invite code generated',
        description: result.inviteCode ? `Code: ${result.inviteCode}` : undefined,
      });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to regenerate code' }),
  });

  const { mutate: revokeCode } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/community/${id}/invite-code`),
    onSuccess: (_d, id) => {
      forgetCommunityInviteCode(id);
      addToast({ type: 'info', title: 'Invite code revoked' });
      refetch();
    },
    onError: () => addToast({ type: 'error', title: 'Failed to revoke code' }),
  });


  const isLoading = tab === 'mine' ? loadingMine : loadingAll;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Communities</h1>
          <p className="text-sm text-gray-500 mt-0.5">Connect with your neighborhood groups</p>
        </div>
        <span className="flex items-center gap-1.5 text-sm text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-3 py-1.5 rounded-xl">
          <Users className="w-4 h-4" />
          {myCommunities.length} joined
        </span>
      </div>

      {/* Invite code join panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5" /> Join via Invite Code
        </p>
        <div className="flex gap-2">
          <input
            ref={codeInputRef}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={6}
            placeholder="XXXXXX"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-white placeholder-gray-600 outline-none focus:border-indigo-500 tracking-widest uppercase transition-colors"
          />
          <button
            onClick={() => joinByCode()}
            disabled={inviteCode.length < 6 || joiningCode}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            {joiningCode ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : 'Join'}
          </button>
        </div>

        {/* Join result banner */}
        {joinResult && (
          <div className={`mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs font-medium ${
            joinResult.requiresLocation
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
          }`}>
            {joinResult.requiresLocation ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCheck className="w-4 h-4 shrink-0" />}
            <span>
              {joinResult.requiresLocation
                ? `Joined "${joinResult.communityName}" as Location Pending. Share your location to activate SOS.`
                : `Welcome to "${joinResult.communityName}"! You're now an active member.`}
            </span>
          </div>
        )}
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {([['mine', 'My Communities', Users], ['discover', 'Discover', Globe2]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === 'discover' && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="card" className="h-48" />)}
        </div>
      ) : tab === 'mine' ? (
        myCommunities.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Users className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-400 font-semibold">You haven't joined any communities yet.</p>
            <button onClick={() => setTab('discover')} className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              Discover communities →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myCommunities.map((c: any) => (
              <MyCommunityCard
                key={c.id}
                community={c}
                userId={userId}
                onLeave={(id, name) => setLeaveModal({ id, name })}
                onRegenerate={(id) => regenerateCode(id)}
                onRevoke={(id) => revokeCode(id)}
              />
            ))}
          </div>
        )
      ) : (
        allCommunities.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Globe2 className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-400 font-semibold">No communities found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {allCommunities.map((c: any) => (
              <DiscoverCard key={c.id} community={c} isMember={myIds.has(c.id)} onJoin={(id) => joinById(id)} />
            ))}
          </div>
        )
      )}

      {/* Leave confirm */}
      <ConfirmDialog
        open={!!leaveModal}
        title="Leave Community"
        message={<>Leave <strong className="text-white">{leaveModal?.name}</strong>? You can rejoin anytime.</>}
        confirmText="Leave"
        onConfirm={() => leaveModal && leaveMutation(leaveModal.id)}
        onCancel={() => setLeaveModal(null)}
      />
    </div>
  );
}