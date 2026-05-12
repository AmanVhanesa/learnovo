import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../services/libraryService';
import { formatDateShort } from '../../utils/formatDate';

const COPY_STATUS_COLORS = {
  available: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400',
  issued: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  reserved: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  damaged: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  lost: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  retired: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400'
};

const BookDetail = () => {
  const { id } = useParams();
  const qc = useQueryClient();
  const [count, setCount] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['library-book', id],
    queryFn: () => libraryService.getBook(id)
  });

  const addMutation = useMutation({
    mutationFn: () => libraryService.addCopies(id, { count }),
    onSuccess: () => { toast.success(`${count} copies added`); qc.invalidateQueries({ queryKey: ['library-book', id] }); setCount(1); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const retireMutation = useMutation({
    mutationFn: (copyId) => libraryService.retireCopy(copyId),
    onSuccess: () => { toast.success('Copy retired'); qc.invalidateQueries({ queryKey: ['library-book', id] }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  if (isLoading) return <div className="p-12 text-center text-gray-500">Loading...</div>;
  const { book, copies = [], activeIssues = [], reservations = [] } = data?.data || {};
  if (!book) return <div className="p-12 text-center text-gray-500">Not found</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Link to="/app/library?tab=books" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 dark:hover:text-primary-400">
        <ArrowLeft className="h-4 w-4" /> Back to books
      </Link>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-6 shadow-glass">
        <div className="flex items-start gap-4">
          <div className="bg-primary-500 p-3 rounded-xl flex-shrink-0">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{book.title}</h1>
            <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">by {book.author}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
              <div><p className="text-xs text-gray-400 uppercase">Total</p><p className="font-semibold">{book.totalCopies}</p></div>
              <div><p className="text-xs text-gray-400 uppercase">Available</p><p className="font-semibold text-primary-600 dark:text-primary-400">{book.availableCopies}</p></div>
              <div><p className="text-xs text-gray-400 uppercase">Category</p><p className="font-semibold">{book.category?.name || '—'}</p></div>
              <div><p className="text-xs text-gray-400 uppercase">Price</p><p className="font-semibold">₹{book.price || 0}</p></div>
            </div>
            {book.description && <p className="mt-4 text-sm text-gray-600 dark:text-[#E5E5EA]">{book.description}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-glass">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-900 dark:text-white">Copies ({copies.length})</h2>
          <div className="flex items-center gap-2">
            <input type="number" min="1" max="100" value={count} onChange={e => setCount(parseInt(e.target.value, 10) || 1)} className="input w-20" />
            <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="btn btn-primary gap-2">
              <Plus className="h-4 w-4" /> Add Copies
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Accession #</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Condition</th>
                <th className="px-4 py-2 text-left">Acquired</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
              {copies.map(c => (
                <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                  <td className="px-4 py-2 font-mono text-xs">{c.accessionNumber}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 text-xs rounded-md font-semibold ${COPY_STATUS_COLORS[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-2 capitalize">{c.condition}</td>
                  <td className="px-4 py-2 text-gray-500">{formatDateShort(c.acquiredDate)}</td>
                  <td className="px-4 py-2 text-right">
                    {c.status === 'available' && (
                      <button onClick={() => { if (confirm('Retire this copy?')) retireMutation.mutate(c._id); }}
                              className="p-1.5 text-gray-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeIssues.length > 0 && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-glass">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A]">
            <h2 className="font-semibold text-gray-900 dark:text-white">Currently Issued ({activeIssues.length})</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {activeIssues.map(i => (
              <div key={i._id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span>{i.userId?.name || `${i.userId?.firstName || ''} ${i.userId?.lastName || ''}`.trim()}</span>
                <span className="text-gray-500">Due {formatDateShort(i.dueDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reservations.length > 0 && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-glass">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A]">
            <h2 className="font-semibold text-gray-900 dark:text-white">Reservation Queue ({reservations.length})</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {reservations.map(r => (
              <div key={r._id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span>{r.userId?.name || `${r.userId?.firstName || ''} ${r.userId?.lastName || ''}`.trim()}</span>
                <span className="text-gray-500">Reserved {formatDateShort(r.reservedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookDetail;
