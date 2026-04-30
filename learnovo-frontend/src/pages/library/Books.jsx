import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, BookOpen, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../services/libraryService';
import BookFormModal from '../../components/library/BookFormModal';

const Books = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['library-books', search, category, page],
    queryFn: () => libraryService.listBooks({ search, category, page, limit: 20 })
  });

  const { data: catRes } = useQuery({
    queryKey: ['library-categories'],
    queryFn: () => libraryService.listCategories()
  });
  const categories = catRes?.data || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => libraryService.deleteBook(id),
    onSuccess: () => {
      toast.success('Book archived');
      qc.invalidateQueries({ queryKey: ['library-books'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const books = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Books</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-0.5">Catalog and copies</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn btn-primary gap-2">
          <Plus className="h-4 w-4" /> Add Book
        </button>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, author or ISBN..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input w-full pl-9"
            />
          </div>
          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} className="input">
            <option value="">All categories</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-gray-300 dark:text-[#48484A]" />
            <p className="mt-3 text-sm text-gray-500 dark:text-[#8E8E93]">No books found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-xs text-gray-500 dark:text-[#8E8E93] uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Author</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-center">Available</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {books.map(b => (
                  <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                    <td className="px-4 py-3">
                      <Link to={`/app/library/books/${b._id}`} className="font-medium text-gray-900 dark:text-white hover:text-emerald-600">
                        {b.title}
                      </Link>
                      {b.isbn && <p className="text-xs text-gray-400">ISBN: {b.isbn}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#E5E5EA]">{b.author}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#E5E5EA]">{b.category?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-[#8E8E93] text-xs">
                      {b.location?.rack || b.location?.shelf ? `${b.location?.rack || '—'} / ${b.location?.shelf || '—'}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-md font-semibold ${
                        b.availableCopies > 0
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                      }`}>
                        {b.availableCopies}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-[#E5E5EA]">{b.totalCopies}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link to={`/app/library/books/${b._id}`} className="p-1.5 text-gray-400 hover:text-emerald-600" title="Copies">
                          <Copy className="h-4 w-4" />
                        </Link>
                        <button onClick={() => { setEditing(b); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600" title="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Archive this book?')) deleteMutation.mutate(b._id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600" title="Archive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      <BookFormModal open={showModal} onClose={() => setShowModal(false)} book={editing} />
    </div>
  );
};

export default Books;
