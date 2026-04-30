import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Edit, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../services/libraryService';

const Members = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['library-members', search, page],
    queryFn: () => libraryService.listMembers({ search, page, limit: 20 })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => libraryService.updateMember(id, payload),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['library-members'] }); setEditing(null); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const items = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Library Members</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-0.5">Auto-enrolled when first issued a book</p>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input w-full pl-9" placeholder="Search by name, email or admission #..."
                 value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No members yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Member #</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-center">Current</th>
                  <th className="px-4 py-3 text-center">Limit</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {items.map(m => (
                  <tr key={m._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                    <td className="px-4 py-3 font-mono text-xs">{m.membershipNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{m.userId?.name || `${m.userId?.firstName || ''} ${m.userId?.lastName || ''}`.trim()}</p>
                      <p className="text-xs text-gray-400">{m.userId?.admissionNumber || m.userId?.employeeId || m.userId?.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{m.memberType}</td>
                    <td className="px-4 py-3 text-center">{m.currentBooksIssued}</td>
                    <td className="px-4 py-3 text-center">{m.maxBooksAllowed}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-md font-semibold ${
                        m.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400'
                      }`}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditing(m)} className="p-1.5 text-gray-400 hover:text-blue-600">
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-[#38383A] flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-outline btn-sm">Prev</button>
              <button disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} className="btn btn-outline btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-md w-full p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Edit Member</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Max Books Allowed</label>
                <input type="number" min="0" className="input w-full" defaultValue={editing.maxBooksAllowed}
                       onChange={e => setEditing({ ...editing, maxBooksAllowed: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <select className="input w-full" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="btn btn-outline">Cancel</button>
              <button onClick={() => updateMutation.mutate({
                id: editing._id,
                payload: { maxBooksAllowed: editing.maxBooksAllowed, status: editing.status }
              })} disabled={updateMutation.isPending} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
