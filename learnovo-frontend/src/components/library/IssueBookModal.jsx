import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import libraryService from '../../services/libraryService';
import { studentsService } from '../../services/studentsService';
import employeesService from '../../services/employeesService';

const IssueBookModal = ({ open, onClose }) => {
  const qc = useQueryClient();
  const [bookSearch, setBookSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberType, setMemberType] = useState('student');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dueDate, setDueDate] = useState('');

  const { data: bookRes } = useQuery({
    queryKey: ['library-book-search', bookSearch],
    queryFn: () => libraryService.listBooks({ search: bookSearch, available: 'true', limit: 8 }),
    enabled: open && bookSearch.length > 1
  });

  const { data: studentRes } = useQuery({
    queryKey: ['library-student-search', memberSearch],
    queryFn: () => studentsService.list({ search: memberSearch, limit: 8 }),
    enabled: open && memberType === 'student' && memberSearch.length > 1
  });
  const { data: empRes } = useQuery({
    queryKey: ['library-emp-search', memberSearch],
    queryFn: () => employeesService.list({ search: memberSearch, limit: 8 }),
    enabled: open && memberType === 'employee' && memberSearch.length > 1
  });

  const issueMutation = useMutation({
    mutationFn: () => libraryService.issueBook({
      bookId: selectedBook._id,
      userId: selectedUser._id,
      ...(dueDate && { dueDate })
    }),
    onSuccess: () => {
      toast.success('Book issued successfully');
      qc.invalidateQueries({ queryKey: ['library-issues'] });
      qc.invalidateQueries({ queryKey: ['library-dashboard'] });
      reset();
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const reset = () => {
    setBookSearch(''); setMemberSearch(''); setSelectedBook(null);
    setSelectedUser(null); setDueDate('');
  };

  if (!open) return null;
  const books = bookRes?.data || [];
  const members = memberType === 'student' ? (studentRes?.data || []) : (empRes?.data || []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between sticky top-0 bg-white dark:bg-[#1C1C1E]">
          <h2 className="font-semibold text-gray-900 dark:text-white">Issue Book</h2>
          <button onClick={() => { reset(); onClose(); }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Book</label>
            {selectedBook ? (
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{selectedBook.title}</p>
                  <p className="text-xs text-gray-500">by {selectedBook.author} · {selectedBook.availableCopies} available</p>
                </div>
                <button onClick={() => setSelectedBook(null)} className="text-emerald-700 text-xs font-medium">Change</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input className="input w-full pl-9" placeholder="Search books..." value={bookSearch} onChange={e => setBookSearch(e.target.value)} />
                </div>
                {books.length > 0 && (
                  <div className="mt-2 border border-gray-200 dark:border-[#38383A] rounded-lg max-h-48 overflow-y-auto">
                    {books.map(b => (
                      <button key={b._id} onClick={() => { setSelectedBook(b); setBookSearch(''); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#2C2C2E] border-b last:border-0">
                        <p className="font-medium">{b.title}</p>
                        <p className="text-xs text-gray-500">{b.author} · {b.availableCopies} available</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA]">Member</label>
              <div className="inline-flex gap-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-md p-0.5">
                <button onClick={() => { setMemberType('student'); setSelectedUser(null); }}
                        className={`px-2.5 py-0.5 text-xs rounded ${memberType === 'student' ? 'bg-white dark:bg-[#1C1C1E] shadow' : ''}`}>Student</button>
                <button onClick={() => { setMemberType('employee'); setSelectedUser(null); }}
                        className={`px-2.5 py-0.5 text-xs rounded ${memberType === 'employee' ? 'bg-white dark:bg-[#1C1C1E] shadow' : ''}`}>Employee</button>
              </div>
            </div>
            {selectedUser ? (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-500/10 p-3 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{selectedUser.name || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim()}</p>
                  <p className="text-xs text-gray-500">{selectedUser.admissionNumber || selectedUser.employeeId || selectedUser.email}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-blue-700 text-xs font-medium">Change</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input className="input w-full pl-9" placeholder={`Search ${memberType}s...`} value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                </div>
                {members.length > 0 && (
                  <div className="mt-2 border border-gray-200 dark:border-[#38383A] rounded-lg max-h-48 overflow-y-auto">
                    {members.map(m => (
                      <button key={m._id} onClick={() => { setSelectedUser(m); setMemberSearch(''); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#2C2C2E] border-b last:border-0">
                        <p className="font-medium">{m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim()}</p>
                        <p className="text-xs text-gray-500">{m.admissionNumber || m.employeeId || m.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Due Date (optional — uses default 30 days)</label>
            <input type="date" className="input w-full" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { reset(); onClose(); }} className="btn btn-outline">Cancel</button>
            <button
              onClick={() => issueMutation.mutate()}
              disabled={!selectedBook || !selectedUser || issueMutation.isPending}
              className="btn btn-primary">
              {issueMutation.isPending ? 'Issuing...' : 'Issue Book'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueBookModal;
