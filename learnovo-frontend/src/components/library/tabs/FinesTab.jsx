import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Check, X as XIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../../services/libraryService';
import { formatDateShort } from '../../../utils/formatDate';

const FinesTab = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [payingId, setPayingId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [waiveId, setWaiveId] = useState(null);
  const [waiveReason, setWaiveReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['library-fines', tab, page],
    queryFn: () => libraryService.listFines({ status: tab, page, limit: 20 })
  });

  const payMutation = useMutation({
    mutationFn: () => libraryService.payFine(payingId, { paymentMethod }),
    onSuccess: () => {
      toast.success('Fine collected · Income recorded');
      qc.invalidateQueries({ queryKey: ['library-fines'] });
      qc.invalidateQueries({ queryKey: ['library-dashboard'] });
      setPayingId(null);
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const waiveMutation = useMutation({
    mutationFn: () => libraryService.waiveFine(waiveId, waiveReason),
    onSuccess: () => {
      toast.success('Fine waived');
      qc.invalidateQueries({ queryKey: ['library-fines'] });
      qc.invalidateQueries({ queryKey: ['library-dashboard'] });
      setWaiveId(null); setWaiveReason('');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const items = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Library Fines</h2>
        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Paid fines auto-sync to Income</p>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-glass overflow-hidden">
        <div className="px-4 pt-3 border-b border-gray-100 dark:border-[#38383A] flex gap-1">
          {['pending', 'paid', 'waived'].map(t => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                      tab === t ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>{t}</button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No {tab} fines</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Book</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  {tab === 'pending' && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {items.map(f => (
                  <tr key={f._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                    <td className="px-4 py-3">
                      <p className="font-medium">{f.userId?.name || `${f.userId?.firstName || ''} ${f.userId?.lastName || ''}`.trim()}</p>
                      <p className="text-xs text-gray-400">{f.userId?.admissionNumber || f.userId?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#E5E5EA]">{f.bookId?.title || '—'}</td>
                    <td className="px-4 py-3 capitalize text-gray-500">{f.reason}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDateShort(f.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{f.amount}</td>
                    {tab === 'pending' && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button onClick={() => setPayingId(f._id)} className="btn btn-sm btn-primary gap-1">
                            <Check className="h-3.5 w-3.5" /> Collect
                          </button>
                          <button onClick={() => setWaiveId(f._id)} className="btn btn-sm btn-outline gap-1">
                            <XIcon className="h-3.5 w-3.5" /> Waive
                          </button>
                        </div>
                      </td>
                    )}
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

      {payingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-4"><IndianRupee className="h-5 w-5 text-primary-600 dark:text-primary-400" /> Collect Fine</h2>
            <label className="block text-xs font-medium mb-1">Payment Method</label>
            <select className="input w-full" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option>Cash</option><option>Bank Transfer</option><option>UPI</option><option>Cheque</option><option>Card</option>
            </select>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPayingId(null)} className="btn btn-outline">Cancel</button>
              <button onClick={() => payMutation.mutate()} disabled={payMutation.isPending} className="btn btn-primary">Collect</button>
            </div>
          </div>
        </div>
      )}

      {waiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h2 className="font-semibold mb-4">Waive Fine</h2>
            <label className="block text-xs font-medium mb-1">Reason</label>
            <textarea rows={3} className="input w-full" value={waiveReason} onChange={e => setWaiveReason(e.target.value)} />
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setWaiveId(null); setWaiveReason(''); }} className="btn btn-outline">Cancel</button>
              <button onClick={() => waiveMutation.mutate()} disabled={waiveMutation.isPending || !waiveReason.trim()} className="btn btn-primary">Waive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinesTab;
