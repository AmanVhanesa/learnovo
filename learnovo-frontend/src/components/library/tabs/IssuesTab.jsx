import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../../services/libraryService';
import { formatDateShort } from '../../../utils/formatDate';
import IssueBookModal from '../IssueBookModal';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'issued', label: 'Issued' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'returned', label: 'Returned' },
  { key: 'lost', label: 'Lost' }
];

const IssuesTab = () => {
  const qc = useQueryClient();
  const [status, setStatus] = useState('issued');
  const [page, setPage] = useState(1);
  const [showIssue, setShowIssue] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['library-issues', status, page],
    queryFn: () => libraryService.listIssues({ ...(status && { status }), page, limit: 20 })
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, condition }) => libraryService.returnBook(id, { condition }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['library-issues'] });
      qc.invalidateQueries({ queryKey: ['library-dashboard'] });
      const fine = res?.data?.fine?.amount;
      toast.success(fine ? `Returned · Fine: ₹${fine}` : 'Book returned');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const renewMutation = useMutation({
    mutationFn: (id) => libraryService.renewIssue(id),
    onSuccess: () => { toast.success('Renewed'); qc.invalidateQueries({ queryKey: ['library-issues'] }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const items = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Issue & Return</h2>
        <button onClick={() => setShowIssue(true)} className="btn btn-primary gap-2">
          <Plus className="h-4 w-4" /> Issue Book
        </button>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-glass overflow-hidden">
        <div className="px-4 pt-3 border-b border-gray-100 dark:border-[#38383A] overflow-x-auto">
          <div className="flex gap-1">
            {STATUS_TABS.map(t => (
              <button key={t.key}
                      onClick={() => { setStatus(t.key); setPage(1); }}
                      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                        status === t.key
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-[#8E8E93]'
                      }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No issues found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Book</th>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Issued</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Fine</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {items.map(i => {
                  const overdue = i.status === 'overdue' || (i.status === 'issued' && new Date(i.dueDate) < new Date());
                  return (
                    <tr key={i._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{i.bookId?.title || '—'}</p>
                        <p className="text-xs text-gray-400">{i.copyId?.accessionNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 dark:text-[#E5E5EA]">{i.userId?.name || `${i.userId?.firstName || ''} ${i.userId?.lastName || ''}`.trim()}</p>
                        <p className="text-xs text-gray-400">{i.userId?.admissionNumber || i.userId?.role}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDateShort(i.issueDate)}</td>
                      <td className={`px-4 py-3 ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{formatDateShort(i.dueDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-md font-semibold ${
                          i.status === 'returned' ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400' :
                          i.status === 'overdue' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                          i.status === 'lost' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                          'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                        }`}>{i.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-[#E5E5EA]">
                        {i.fineAmount > 0 ? `₹${i.fineAmount}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(i.status === 'issued' || i.status === 'overdue') && (
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => renewMutation.mutate(i._id)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Renew">
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <button onClick={() => returnMutation.mutate({ id: i._id, condition: 'good' })} className="btn btn-sm btn-primary gap-1">
                              <RefreshCw className="h-3.5 w-3.5" /> Return
                            </button>
                            <button onClick={() => { if (confirm('Mark this book as damaged?')) returnMutation.mutate({ id: i._id, condition: 'damaged' }); }}
                                    className="btn btn-sm btn-outline">Damaged</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-[#38383A] flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {pagination.page} of {pagination.pages} · {pagination.total} total</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-outline btn-sm">Prev</button>
              <button disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} className="btn btn-outline btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      <IssueBookModal open={showIssue} onClose={() => setShowIssue(false)} />
    </div>
  );
};

export default IssuesTab;
