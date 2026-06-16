import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import Button from '../../components/Button';
import { useNotificationStore } from '../../store/notificationStore';
import { ShieldAlert } from 'lucide-react';

export default function RoleManagement() {
  const queryClient = useQueryClient();
  const addToast = useNotificationStore((state) => state.addToast);
  
  // States للـ Modal
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [actionType, setActionType] = useState<'promote' | 'demote' | null>(null);
  const [reason, setReason] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users', 'all-roles'],
    queryFn: async () => {
      const res = await apiClient.get('/api/admin/users');
      return res.data;
    }
  });

  const roleMutation = useMutation({
    mutationFn: async () => {
      const endpoint = actionType === 'promote' 
        ? `/api/superadmin/users/${selectedUser.id}/promote-to-admin`
        : `/api/superadmin/users/${selectedUser.id}/demote-to-citizen`;
      
      await apiClient.put(endpoint, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      addToast({ type: 'success', title: 'User role updated successfully' });
      closeModal();
    },
    onError: () => {
      addToast({ type: 'error', title: 'Action failed', description: 'Could not update user role.' });
    }
  });

  const openModal = (user: any, type: 'promote' | 'demote') => {
    setSelectedUser(user);
    setActionType(type);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setActionType(null);
    setReason('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">System Role Management</h1>
      <p className="text-gray-400 text-sm">Critical Actions: Promote citizens to administrators or revoke administrative privileges.</p>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {isLoading ? <Skeleton type="table-row" /> : (
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900 uppercase text-xs">
              <tr>
                <th className="px-6 py-3">Username</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Current Roles</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users?.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-700/30">
                  <td className="px-6 py-4 font-medium text-white">{user.userName}</td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">
                    {user.roles.map((r: string) => (
                      <span key={r} className={`px-2 py-0.5 rounded text-xs font-bold mr-1 ${r === 'Admin' || r === 'SuperAdmin' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {r}
                      </span>
                    ))}
                  </td>
                  <td className="px-6 py-4">
                    {user.roles.includes('Admin') ? (
                      <Button size="sm" variant="danger" onClick={() => openModal(user, 'demote')}>
                        Demote to Citizen
                      </Button>
                    ) : !user.roles.includes('SuperAdmin') ? (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => openModal(user, 'promote')}>
                        Promote to Admin
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-500">No Actions Allowed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-xl font-bold text-white">Confirm Role Change</h3>
            </div>
            
            <p className="text-sm text-gray-300 mb-4">
              Are you sure you want to {actionType === 'promote' ? 'PROMOTE' : 'DEMOTE'}{' '}
              <span className="text-white font-bold">{selectedUser.userName}</span>?
              {actionType === 'promote' && " This grants full administrative access to the system."}
            </p>

            <div className="flex flex-col gap-1 mb-6">
              <label className="text-xs text-gray-400">Reason for audit log (Required)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter justification..."
                className="bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white h-20 outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button 
                className={actionType === 'promote' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                disabled={!reason.trim() || roleMutation.isPending}
                onClick={() => roleMutation.mutate()}
              >
                Confirm Check
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}