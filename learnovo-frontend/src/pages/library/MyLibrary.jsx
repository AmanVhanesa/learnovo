import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Library, BookOpen, Search, AlertTriangle, RotateCcw, Bookmark, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../services/libraryService';
import { formatDateShort } from '../../utils/formatDate';

const MyLibrary = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState('current');
  const [bookSearch, setBookSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-library'],
    queryFn: () => libraryService.myLibrary()
  });

  const { data: bookData } = useQuery({
    queryKey: ['my-library-search', bookSearch],
    queryFn: () => libraryService.listBooks({ search: bookSearch, limit: 12 }),
    enabled: tab === 'browse' && bookSearch.length > 1
  });

  const { data: resData } = useQuery({
    queryKey: ['my-library-reservations'],
    queryFn: () => libraryService.listReservations({ status: 'active' }),
    enabled: tab === 'reservations'
  });

  const renewMutation = useMutation({
    mutationFn: (id) => libraryService.renewIssue(id),
    onSuccess: () => { toast.success('Renewed'); qc.invalidateQueries({ queryKey: ['my-library'] }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const reserveMutation = useMutation({
    mutationFn: (bookId) => libraryService.createReservation({ bookId }),
    onSuccess: () => { toast.success('Reserved'); qc.invalidateQueries({ queryKey: ['my-library-reservations'] }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => libraryService.cancelReservation(id),
    onSuccess: () => { toast.success('Cancelled'); qc.invalidateQueries({ queryKey: ['my-library-reservations'] }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const member = data?.data?.member;
  const active = data?.data?.activeIssues || [];
  const history = data?.data?.history || [];
  const fines = data?.data?.fines || [];
  const books = bookData?.data || [];
  const reservations = resData?.data || [];

  const totalFines = fines.reduce((sum, f) => sum + (f.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <Library className="h-6 w-6 text-emerald-600" /> My Library
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-0.5">
          {member?.membershipNumber ? `Member #${member.membershipNumber}` : 'Welcome'}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-[#1C1C1E] animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-4 shadow-sm">
            <BookOpen className="h-5 w-5 text-emerald-600 mb-2" />
            <p className="text-xs text-gray-500 uppercase">Currently Issued</p>
            <p className="text-2xl font-bold mt-1">{member?.currentBooksIssued || 0} <span className="text-xs text-gray-400">/ {member?.maxBooksAllowed || 0}</span></p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-4 shadow-sm">
            <Bookmark className="h-5 w-5 text-blue-600 mb-2" />
            <p className="text-xs text-gray-500 uppercase">Total Issued</p>
            <p className="text-2xl font-bold mt-1">{member?.totalBooksIssued || 0}</p>
          </div>
          <div className={`rounded-2xl border p-4 shadow-sm ${totalFines > 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30' : 'bg-white dark:bg-[#1C1C1E] border-gray-100 dark:border-[#38383A]'}`}>
            <IndianRupee className={`h-5 w-5 mb-2 ${totalFines > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
            <p className="text-xs text-gray-500 uppercase">Pending Fines</p>
            <p className="text-2xl font-bold mt-1">₹{totalFines}</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-sm overflow-hidden">
        <div className="px-4 pt-3 border-b border-gray-100 dark:border-[#38383A] flex gap-1 overflow-x-auto">
          {[
            { k: 'current', l: 'Current' },
            { k: 'history', l: 'History' },
            { k: 'reservations', l: 'Reservations' },
            { k: 'fines', l: 'Fines' },
            { k: 'browse', l: 'Browse' }
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      tab === t.k ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>{t.l}</button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'current' && (
            active.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">No books currently issued</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {active.map(i => {
                  const overdue = new Date(i.dueDate) < new Date();
                  return (
                    <div key={i._id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{i.bookId?.title}</p>
                        <p className="text-xs text-gray-500">by {i.bookId?.author}</p>
                        <p className={`text-xs mt-1 flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {overdue && <AlertTriangle className="h-3 w-3" />}
                          Due {formatDateShort(i.dueDate)}
                        </p>
                      </div>
                      <button onClick={() => renewMutation.mutate(i._id)}
                              disabled={renewMutation.isPending}
                              className="btn btn-sm btn-outline gap-1">
                        <RotateCcw className="h-3.5 w-3.5" /> Renew
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {tab === 'history' && (
            history.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">No history yet</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {history.map(i => (
                  <div key={i._id} className="py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{i.bookId?.title}</p>
                    <p className="text-xs text-gray-500">
                      Returned {formatDateShort(i.returnDate)} · {i.fineAmount > 0 ? `Fine ₹${i.fineAmount}` : 'No fine'}
                    </p>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'reservations' && (
            reservations.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">No active reservations</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {reservations.map(r => (
                  <div key={r._id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{r.bookId?.title}</p>
                      <p className="text-xs text-gray-500">Reserved {formatDateShort(r.reservedAt)} · expires {formatDateShort(r.expiresAt)}</p>
                    </div>
                    <button onClick={() => cancelMutation.mutate(r._id)} className="btn btn-sm btn-outline">Cancel</button>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'fines' && (
            fines.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">No pending fines</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {fines.map(f => (
                  <div key={f._id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{f.bookId?.title || 'Library Fine'}</p>
                      <p className="text-xs text-gray-500 capitalize">{f.reason} · {f.description}</p>
                    </div>
                    <p className="font-semibold text-amber-600">₹{f.amount}</p>
                  </div>
                ))}
                <div className="pt-3 text-xs text-gray-500">Visit the library counter to pay outstanding fines.</div>
              </div>
            )
          )}

          {tab === 'browse' && (
            <div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input className="input w-full pl-9" placeholder="Search books..." value={bookSearch} onChange={e => setBookSearch(e.target.value)} />
              </div>
              {books.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">{bookSearch ? 'No matches' : 'Type to search'}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {books.map(b => (
                    <div key={b._id} className="border border-gray-100 dark:border-[#38383A] rounded-xl p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{b.title}</p>
                        <p className="text-xs text-gray-500 truncate">by {b.author}</p>
                        <p className={`text-xs mt-1 ${b.availableCopies > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {b.availableCopies > 0 ? `${b.availableCopies} available` : 'Not available'}
                        </p>
                      </div>
                      <button onClick={() => reserveMutation.mutate(b._id)} disabled={reserveMutation.isPending} className="btn btn-sm btn-outline">
                        Reserve
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyLibrary;
