import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNotificationStore } from '../../store/notificationStore';

interface Spec { id: string; name: string; description?: string; iconName?: string; categoryId?: string; categoryName?: string }

function SpecFormModal({
  open, spec, categories, onClose, onSave,
}: { open: boolean; spec: Spec | null; categories: any[]; onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState(
    spec
      ? { name: spec.name, description: spec.description ?? '', iconName: spec.iconName ?? '', categoryId: spec.categoryId ?? '' }
      : { name: '', description: '', iconName: '', categoryId: '' }
  );
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-white mb-4">{spec ? 'Edit Specialization' : 'Add Specialization'}</h3>

        <div className="space-y-3">
          {(['name', 'iconName', 'description'] as const).map((f) => (
            <div key={f}>
              <label className="block text-xs font-semibold text-gray-400 mb-1 capitalize">
                {f === 'iconName' ? 'Icon Name' : f}{f === 'name' ? ' *' : ''}
              </label>
              <input
                value={form[f]}
                onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
                placeholder={f === 'iconName' ? 'e.g. shield, fire…' : ''}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((s) => ({ ...s, categoryId: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
            >
              <option value="">— Select category —</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>
          <button
            disabled={!form.name.trim()}
            onClick={() => onSave(form)}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-40"
          >
            {spec ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSpecializations() {
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [formModal,    setFormModal]    = useState<{ open: boolean; spec: Spec | null }>({ open: false, spec: null });
  const [deleteModal,  setDeleteModal]  = useState<{ open: boolean; id: string; name: string } | null>(null);

  const { data: specs, isLoading } = useQuery<Spec[]>({
    queryKey: ['specializations'],
    queryFn:  () => apiClient.get('/api/specializations').then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => apiClient.get('/api/categories').then((r) => r.data),
  });

  const mutate = (fn: () => Promise<any>, msg: string) =>
    fn()
      .then(() => {
        addToast({ type: 'success', title: 'Done', description: msg });
        qc.invalidateQueries({ queryKey: ['specializations'] });
        setFormModal({ open: false, spec: null });
        setDeleteModal(null);
      })
      .catch((e: any) =>
        addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Failed.' })
      );

  const catList: any[] = categories ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Specializations</h1>
          <p className="text-sm text-gray-400 mt-0.5">{specs?.length ?? 0} specializations</p>
        </div>
        <button
          onClick={() => setFormModal({ open: true, spec: null })}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Specialization
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
                  {['Name', 'Icon', 'Description', 'Category', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {(specs ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{s.iconName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{s.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      {s.categoryName && (
                        <span className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded-full">
                          {s.categoryName}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setFormModal({ open: true, spec: s })}
                          className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ open: true, id: s.id, name: s.name })}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {specs?.length === 0 && <p className="text-center py-12 text-gray-500 text-sm">No specializations yet.</p>}
          </div>
        )}
      </div>

      <SpecFormModal
        open={formModal.open}
        spec={formModal.spec}
        categories={catList}
        onClose={() => setFormModal({ open: false, spec: null })}
        onSave={(d) => {
          const fn = formModal.spec
            ? () => apiClient.put(`/api/specializations/${formModal.spec!.id}`, d)
            : () => apiClient.post('/api/specializations', d);
          mutate(fn, formModal.spec ? 'Specialization updated.' : 'Specialization added.');
        }}
      />

      <ConfirmDialog
        open={!!deleteModal?.open}
        title="Delete Specialization"
        message={<>Delete <strong className="text-white">{deleteModal?.name}</strong>?</>}
        confirmText="Delete"
        onConfirm={() => deleteModal && mutate(() => apiClient.delete(`/api/specializations/${deleteModal.id}`), 'Specialization deleted.')}
        onCancel={() => setDeleteModal(null)}
      />
    </div>
  );
}