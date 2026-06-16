import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Plus, Pencil, Trash2, Map, X, MapPin, Phone, Mail, Tag } from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import CoverageAreaMap from '../../components/Map/CoverageAreaMap';
import { createCustomIcon, TILE_URL } from '../../utils/map';
import { useNotificationStore } from '../../store/notificationStore';

/* ── Click-to-place marker helper ── */
function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/* ── Authority form slide-over ── */
interface AuthFormData {
  name:        string;
  description: string;
  type:        string;
  phone:       string;
  email:       string;
  latitude:    number | '';
  longitude:   number | '';
}

const EMPTY_FORM: AuthFormData = { name: '', description: '', type: '', phone: '', email: '', latitude: '', longitude: '' };

function AuthoritySlideOver({
  open, authority, onClose, onSave,
}: {
  open: boolean;
  authority: any | null;
  onClose: () => void;
  onSave: (data: AuthFormData) => void;
}) {
  const [form, setForm] = useState<AuthFormData>(
    authority
      ? { name: authority.name, description: authority.description ?? '', type: authority.type ?? '', phone: authority.phone ?? '', email: authority.email ?? '', latitude: authority.latitude ?? '', longitude: authority.longitude ?? '' }
      : EMPTY_FORM
  );

  const set = (field: keyof AuthFormData, value: any) => setForm((f) => ({ ...f, [field]: value }));

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-gray-900 border-l border-gray-700 h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-base font-bold text-white">{authority ? 'Edit Authority' : 'Create Authority'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors" />
          </div>

          {/* Type + Phone row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Type</label>
              <input value={form.type} onChange={(e) => set('type', e.target.value)} placeholder="e.g. Police, Fire…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Phone</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors" />
            </div>
          </div>

          {/* Email + Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors resize-none" />
          </div>

          {/* Location picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location — click map to set
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', parseFloat(e.target.value) || '')} placeholder="Latitude"
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
              <input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', parseFloat(e.target.value) || '')} placeholder="Longitude"
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
            </div>
            <div className="h-52 rounded-xl overflow-hidden border border-gray-700">
              <MapContainer
                center={[form.latitude || 30.0444, form.longitude || 31.2357]}
                zoom={12}
                className="h-full w-full"
                scrollWheelZoom
              >
                <TileLayer url={TILE_URL} attribution="© OpenStreetMap" />
                <LocationPicker onPick={(lat, lng) => { set('latitude', lat); set('longitude', lng); }} />
                {form.latitude && form.longitude && (
                  <Marker position={[+form.latitude, +form.longitude]} icon={createCustomIcon('#6366f1', 18)} />
                )}
              </MapContainer>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors">Cancel</button>
            <button
              onClick={() => onSave(form)}
              disabled={!form.name.trim()}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-40"
            >
              {authority ? 'Save Changes' : 'Create Authority'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Coverage modal ── */
function CoverageModal({ open, authority, onClose }: { open: boolean; authority: any | null; onClose: () => void }) {
  if (!open || !authority) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-white">Coverage Area — {authority.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <CoverageAreaMap authority={authority} height="380px" />
        </div>
      </div>
    </div>
  );
}

export default function AdminAuthorities() {
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [slideOver,   setSlideOver]   = useState<{ open: boolean; authority: any | null }>({ open: false, authority: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; name: string } | null>(null);
  const [coverage,    setCoverage]    = useState<{ open: boolean; authority: any | null }>({ open: false, authority: null });

  const { data, isLoading } = useQuery({
    queryKey: ['authorities'],
    queryFn:  () => apiClient.get('/api/authorities').then((r) => r.data),
  });

  const { mutate: saveAuthority } = useMutation({
    mutationFn: (vars: { id?: string; data: AuthFormData }) =>
      vars.id
        ? apiClient.put(`/api/authorities/${vars.id}`, vars.data)
        : apiClient.post('/api/authorities', vars.data),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Saved', description: 'Authority saved.' });
      qc.invalidateQueries({ queryKey: ['authorities'] });
      setSlideOver({ open: false, authority: null });
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Save failed.' }),
  });

  const { mutate: deleteAuth, isPending: deleting } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/authorities/${id}`),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Deleted', description: 'Authority deleted.' });
      qc.invalidateQueries({ queryKey: ['authorities'] });
      setDeleteModal(null);
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Delete failed.' }),
  });

  const authorities: any[] = data ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Authority Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">{authorities.length} authorities</p>
        </div>
        <button
          onClick={() => setSlideOver({ open: true, authority: null })}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Authority
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} type="table-row" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/60 border-b border-gray-800">
                  {['Name', 'Type', 'Contact', 'Specializations', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {authorities.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{a.name}</p>
                      {a.userId && <p className="text-[10px] text-emerald-400 mt-0.5">Linked</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{a.type ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      <div className="flex flex-col gap-0.5">
                        {a.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{a.phone}</span>}
                        {a.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{a.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Tag className="w-3.5 h-3.5" />
                        {a.specializations?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setSlideOver({ open: true, authority: a })}
                          className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setCoverage({ open: true, authority: a })}
                          className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Coverage">
                          <Map className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteModal({ open: true, id: a.id, name: a.name })}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {authorities.length === 0 && <p className="text-center py-12 text-gray-500 text-sm">No authorities found.</p>}
          </div>
        )}
      </div>

      <AuthoritySlideOver
        open={slideOver.open}
        authority={slideOver.authority}
        onClose={() => setSlideOver({ open: false, authority: null })}
        onSave={(formData) => saveAuthority({ id: slideOver.authority?.id, data: formData })}
      />

      <CoverageModal
        open={coverage.open}
        authority={coverage.authority}
        onClose={() => setCoverage({ open: false, authority: null })}
      />

      <ConfirmDialog
        open={!!deleteModal?.open}
        title="Delete Authority"
        message={<>Permanently delete <strong className="text-white">{deleteModal?.name}</strong>? This cannot be undone.</>}
        confirmText="Delete"
        isLoading={deleting}
        onConfirm={() => deleteModal && deleteAuth(deleteModal.id)}
        onCancel={() => setDeleteModal(null)}
      />
    </div>
  );
}