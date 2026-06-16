import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCircle, Phone, Mail, Shield, Camera,
  Edit3, Save, X, Star, BadgeCheck,
} from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';

function TrustBadge({ badge }: { badge?: string }) {
  const styles: Record<string, { bg: string; text: string; icon: React.ReactElement }> = {
    Newcomer:    { bg: 'bg-gray-500/15',   text: 'text-gray-400',   icon: <Star className="w-3.5 h-3.5" />      },
    Trusted:     { bg: 'bg-blue-500/15',   text: 'text-blue-400',   icon: <BadgeCheck className="w-3.5 h-3.5" /> },
    Verified:    { bg: 'bg-emerald-500/15',text: 'text-emerald-400',icon: <Shield className="w-3.5 h-3.5" />     },
    Contributor: { bg: 'bg-purple-500/15', text: 'text-purple-400', icon: <Star className="w-3.5 h-3.5" />      },
  };
  const key = badge ?? 'Newcomer';
  const s   = styles[key] ?? styles.Newcomer;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-current/20 ${s.bg} ${s.text}`}>
      {s.icon}
      {key}
    </span>
  );
}

export default function Profile() {
  const qc       = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const user     = useAuthStore((s) => s.user);

  const [editing,      setEditing]      = useState(false);
  const [displayName,  setDisplayName]  = useState('');
  const [phoneNumber,  setPhoneNumber]  = useState('');

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get('/api/profile/my-profile').then((r) => r.data),
  });
  const data = rawData as any;

  // Seed form fields when data loads
  useState(() => {
    if (data?.displayName) setDisplayName(data.displayName);
    if (data?.phoneNumber) setPhoneNumber(data.phoneNumber);
  });

  const { mutate: updateProfile, isPending: saving } = useMutation({
    mutationFn: () => apiClient.put('/api/profile/update', { displayName, phoneNumber }),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Profile updated', description: 'Your profile has been saved.' });
      qc.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Update failed', description: e?.response?.data?.message ?? 'Please try again.' }),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton type="card" className="h-40" />
        <Skeleton type="card" className="h-52" />
      </div>
    );
  }

  const initials = (data?.displayName ?? user?.displayName ?? 'U')[0].toUpperCase();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-white">My Profile</h1>

      {/* Profile hero card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-black">
              {initials}
            </div>
            <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors">
              <Camera className="w-3 h-3 text-white" />
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">{data?.displayName ?? 'Unknown'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{data?.email ?? user?.email}</p>
              </div>
              <button
                onClick={() => { setEditing((e) => !e); if (!editing) { setDisplayName(data?.displayName ?? ''); setPhoneNumber(data?.phoneNumber ?? ''); } }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  editing ? 'text-red-400 bg-red-400/10 border border-red-400/20' : 'text-indigo-400 bg-indigo-400/10 border border-indigo-400/20'
                }`}
              >
                {editing ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Edit3 className="w-3.5 h-3.5" /> Edit</>}
              </button>
            </div>
            <div className="mt-3">
              <TrustBadge badge={data?.trustBadge} />
            </div>
          </div>
        </div>
      </div>

      {/* Details form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <h3 className="text-sm font-bold text-white">Personal Information</h3>

        {/* Display Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
            <UserCircle className="w-3.5 h-3.5" /> Display Name
          </label>
          {editing ? (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-gray-800 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
            />
          ) : (
            <p className="text-sm text-white bg-gray-800/50 border border-gray-800 rounded-xl px-4 py-2.5">
              {data?.displayName ?? '—'}
            </p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Phone Number
          </label>
          {editing ? (
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              type="tel"
              className="w-full bg-gray-800 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
            />
          ) : (
            <p className="text-sm text-white bg-gray-800/50 border border-gray-800 rounded-xl px-4 py-2.5">
              {data?.phoneNumber ?? '—'}
            </p>
          )}
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email
          </label>
          <p className="text-sm text-gray-400 bg-gray-800/30 border border-gray-800 rounded-xl px-4 py-2.5">
            {data?.email ?? user?.email ?? '—'}
          </p>
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Role
          </label>
          <p className="text-sm text-gray-400 bg-gray-800/30 border border-gray-800 rounded-xl px-4 py-2.5">
            {Array.isArray(user?.role) ? user.role.join(', ') : (user?.role ?? 'Citizen')}
          </p>
        </div>

        {/* Save button */}
        {editing && (
          <div className="pt-2 flex justify-end gap-3">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => updateProfile()}
              disabled={saving || !displayName.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-40"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Stats card */}
      {data && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4">Activity</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Reports Filed',  value: data.totalReports      ?? 0 },
              { label: 'Resolved',       value: data.resolvedReports   ?? 0 },
              { label: 'Communities',    value: data.communityCount    ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-white tabular-nums">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}