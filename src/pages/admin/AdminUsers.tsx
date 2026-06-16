import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, ChevronLeft, ChevronRight, MoreVertical,
  UserCheck, UserX, Shield, Link2, Flag, Unlink,
  CheckCircle, XCircle,
} from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import LinkAuthorityModal from '../../components/LinkAuthorityModal';
import { useNotificationStore } from '../../store/notificationStore';

const ROLES = ['All', 'Citizen', 'Authority', 'Admin'];
const LINKED = ['All', 'Linked', 'Unlinked'];

type ModalState =
  | { type: 'none' }
  | { type: 'deactivate';  userId: string; name: string }
  | { type: 'reactivate';  userId: string; name: string }
  | { type: 'role';        userId: string; name: string; currentRole: string }
  | { type: 'flag';        userId: string; name: string }
  | { type: 'unlink';      userId: string; name: string }
  | { type: 'link';        userId: string };

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    Admin: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    SuperAdmin: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Authority: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    Citizen: 'bg-gray-500/20 text-gray-300 border-gray-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${colors[role] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}>
      {role}
    </span>
  );
}

function KebabMenu({ user, onAction }: { user: any; onAction: (modal: ModalState) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const items = [
    { icon: user.isLocked ? UserCheck : UserX, label: user.isLocked ? 'Reactivate' : 'Deactivate',
      action: () => onAction(user.isLocked
        ? { type: 'reactivate', userId: user.id, name: user.displayName ?? user.userName }
        : { type: 'deactivate', userId: user.id, name: user.displayName ?? user.userName }) },
    { icon: Shield, label: 'Change Role',
      action: () => onAction({ type: 'role', userId: user.id, name: user.displayName ?? user.userName, currentRole: user.roles?.[0] ?? 'Citizen' }) },
    { icon: Flag, label: 'Flag User',
      action: () => onAction({ type: 'flag', userId: user.id, name: user.displayName ?? user.userName }) },
    ...(user.linkedAuthority
      ? [{ icon: Unlink, label: 'Unlink Authority',
          action: () => onAction({ type: 'unlink', userId: user.id, name: user.displayName ?? user.userName }) }]
      : [{ icon: Link2, label: 'Link to Authority',
          action: () => onAction({ type: 'link', userId: user.id }) }]),
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {items.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={() => { action(); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-left"
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [search,       setSearch]       = useState('');
  const [role,         setRole]         = useState('All');
  const [linkedStatus, setLinkedStatus] = useState('All');
  const [page,         setPage]         = useState(1);
  const [modal,        setModal]        = useState<ModalState>({ type: 'none' });
  const [roleInput,    setRoleInput]    = useState('Citizen');
  const [flagReason,   setFlagReason]   = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', { search, role, linkedStatus, page }],
    queryFn:  () =>
      apiClient.get('/api/admin/users', {
        params: {
          search:       search || undefined,
          role:         role === 'All' ? undefined : role,
          linkedStatus: linkedStatus === 'All' ? undefined : linkedStatus.toLowerCase(),
          page,
          pageSize:     20,
        },
      }).then((r) => r.data),
  });

  const users      = data?.users ?? data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const mutate = (fn: () => Promise<any>, successMsg: string) =>
    fn()
      .then(() => {
        addToast({ type: 'success', title: 'Done', description: successMsg });
        qc.invalidateQueries({ queryKey: ['admin', 'users'] });
        setModal({ type: 'none' });
      })
      .catch((e: any) =>
        addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Action failed' })
      );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <div className="text-sm text-gray-400">{data?.totalCount ?? 0} users</div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, or phone…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Role tabs */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => { setRole(r); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${role === r ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Linked filter */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {LINKED.map((l) => (
            <button
              key={l}
              onClick={() => { setLinkedStatus(l); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${linkedStatus === l ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="table-row" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/60 border-b border-gray-800">
                  {['User', 'Phone', 'Roles', 'Linked Authority', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-800/30 transition-colors group">
                    {/* Avatar + name/email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {(u.displayName ?? u.userName ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{u.displayName ?? u.userName}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.phoneNumber ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).map((r: string) => <RoleBadge key={r} role={r} />)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.linkedAuthority ? (
                        <span className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg">
                          {u.linkedAuthority.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.isLocked ? (
                        <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                          <XCircle className="w-3.5 h-3.5" /> Locked
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <KebabMenu user={u} onAction={setModal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="text-center py-12 text-gray-500 text-sm">No users found.</p>
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

      {/* ── Modals ── */}
      <ConfirmDialog
        open={modal.type === 'deactivate'}
        title="Deactivate User"
        message={<>Deactivate <strong className="text-white">{modal.type === 'deactivate' ? modal.name : ''}</strong>? They will be locked out immediately.</>}
        confirmText="Deactivate"
        onConfirm={() => modal.type === 'deactivate' && mutate(() => apiClient.put(`/api/admin/users/${modal.userId}/deactivate`), 'User deactivated.')}
        onCancel={() => setModal({ type: 'none' })}
      />

      <ConfirmDialog
        open={modal.type === 'reactivate'}
        title="Reactivate User"
        message={<>Reactivate <strong className="text-white">{modal.type === 'reactivate' ? modal.name : ''}</strong>? They will regain access.</>}
        confirmText="Reactivate"
        danger={false}
        onConfirm={() => modal.type === 'reactivate' && mutate(() => apiClient.put(`/api/admin/users/${modal.userId}/reactivate`), 'User reactivated.')}
        onCancel={() => setModal({ type: 'none' })}
      />

      <ConfirmDialog
        open={modal.type === 'unlink'}
        title="Unlink Authority"
        message={<>Unlink <strong className="text-white">{modal.type === 'unlink' ? modal.name : ''}</strong> from their authority? They will be demoted to Citizen.</>}
        confirmText="Unlink"
        onConfirm={() => modal.type === 'unlink' && mutate(() => apiClient.post('/api/admin/unlink-authority-user', { userId: modal.userId }), 'User unlinked.')}
        onCancel={() => setModal({ type: 'none' })}
      />

      {/* Change Role Modal */}
      {modal.type === 'role' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal({ type: 'none' })} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-white mb-4">Change Role — {modal.name}</h3>
            <select
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 mb-4"
            >
              {['Citizen', 'Authority', 'Admin'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal({ type: 'none' })} className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>
              <button
                onClick={() => mutate(() => apiClient.put(`/api/admin/users/${modal.userId}/role`, { role: roleInput }), `Role changed to ${roleInput}.`)}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Modal */}
      {modal.type === 'flag' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal({ type: 'none' })} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-white mb-1">Flag User — {modal.name}</h3>
            <p className="text-xs text-gray-400 mb-4">Provide a reason for flagging this user.</p>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              rows={3}
              placeholder="Reason for flagging…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal({ type: 'none' })} className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>
              <button
                disabled={!flagReason.trim()}
                onClick={() => mutate(() => apiClient.post(`/api/admin/users/${modal.userId}/flag`, { reason: flagReason }), 'User flagged.')}
                className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-40"
              >
                Flag User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      <LinkAuthorityModal
        open={modal.type === 'link'}
        preselectedUserId={modal.type === 'link' ? modal.userId : undefined}
        onClose={() => setModal({ type: 'none' })}
      />
    </div>
  );
}