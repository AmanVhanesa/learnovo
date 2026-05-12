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

  const statCards = [
    {
      label: 'Currently Issued',
      value: `${member?.currentBooksIssued || 0} / ${member?.maxBooksAllowed || 0}`,
      icon: BookOpen,
      color: 'bg-primary-500'
    },
    {
      label: 'Total Issued',
      value: member?.totalBooksIssued || 0,
      icon: Bookmark,
      color: 'bg-blue-500'
    },
    {
      label: 'Pending Fines',
      value: `₹${totalFines}`,
      icon: IndianRupee,
      color: totalFines > 0 ? 'bg-amber-500' : 'bg-gray-400'
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <Library className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          My Library
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
          {member?.membershipNumber ? `Member #${member.membershipNumber}` : 'Welcome'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white dark:bg-white/[0.08] dark:border dark:border-white/[0.15] dark:shadow-[0_4px_24px_rgba(0,0,0,0.10)] rounded-2xl shadow-glass p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 dark:text-[#8E8E93]">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {isLoading ? '...' : stat.value}
                  </p>
                </div>
                <div className={`${stat.color} p-3 rounded-xl flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden">
        <div className="border-b border-gray-200 dark:border-[#38383A]">
          <nav className="flex space-x-6 sm:space-x-8 px-4 sm:px-6 overflow-x-auto whitespace-nowrap">
            {[
              { k: 'current', l: 'Current' },
              { k: 'history', l: 'History' },
              { k: 'reservations', l: 'Reservations' },
              { k: 'fines', l: 'Fines' },
              { k: 'browse', l: 'Browse' }
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                      className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                        tab === t.k
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
                      }`}>{t.l}</button>
            ))}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
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
                        <p className={`text-xs mt-1 ${b.availableCopies > 0 ? 'text-primary-600 dark:text-primary-400' : 'text-red-600'}`}>
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
