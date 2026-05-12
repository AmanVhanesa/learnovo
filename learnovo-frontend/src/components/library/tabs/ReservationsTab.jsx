import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../../services/libraryService';
import { formatDateShort } from '../../../utils/formatDate';

const ReservationsTab = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState('active');

  const { data, isLoading } = useQuery({
    queryKey: ['library-reservations', tab],
    queryFn: () => libraryService.listReservations({ status: tab })
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => libraryService.cancelReservation(id),
    onSuccess: () => { toast.success('Cancelled'); qc.invalidateQueries({ queryKey: ['library-reservations'] }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const items = data?.data || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Reservations</h2>
        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Manage book reservation queue</p>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-glass overflow-hidden">
        <div className="px-4 pt-3 border-b border-gray-100 dark:border-[#38383A] flex gap-1">
          {['active', 'fulfilled', 'cancelled', 'expired'].map(t => (
            <button key={t} onClick={() => setTab(t)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${
                      tab === t ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>{t}</button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No {tab} reservations</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Book</th>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Reserved</th>
                  <th className="px-4 py-3 text-left">Expires</th>
                  {tab === 'active' && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {items.map(r => (
                  <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                    <td className="px-4 py-3 font-medium">{r.bookId?.title}</td>
                    <td className="px-4 py-3">{r.userId?.name || `${r.userId?.firstName || ''} ${r.userId?.lastName || ''}`.trim()}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDateShort(r.reservedAt)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDateShort(r.expiresAt)}</td>
                    {tab === 'active' && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => cancelMutation.mutate(r._id)} className="btn btn-sm btn-outline gap-1">
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReservationsTab;
