import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import libraryService from '../../services/libraryService';

const empty = {
  title: '', author: '', isbn: '', publisher: '', edition: '', language: 'English',
  category: '', description: '', price: 0, copies: 1,
  location: { rack: '', shelf: '' }
};

const BookFormModal = ({ open, onClose, book }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const isEdit = !!book?._id;

  const { data: catRes } = useQuery({
    queryKey: ['library-categories'],
    queryFn: () => libraryService.listCategories(),
    enabled: open
  });
  const categories = catRes?.data || [];

  useEffect(() => {
    if (book) {
      setForm({
        ...empty,
        ...book,
        category: book.category?._id || book.category || '',
        location: book.location || { rack: '', shelf: '' },
        copies: 0
      });
    } else {
      setForm(empty);
    }
  }, [book, open]);

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? libraryService.updateBook(book._id, data) : libraryService.createBook(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Book updated' : 'Book added');
      qc.invalidateQueries({ queryKey: ['library-books'] });
      qc.invalidateQueries({ queryKey: ['library-dashboard'] });
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.author.trim()) {
      toast.error('Title and author required');
      return;
    }
    const payload = { ...form };
    if (!payload.category) delete payload.category;
    mutation.mutate(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between sticky top-0 bg-white dark:bg-[#1C1C1E]">
          <h2 className="font-semibold text-gray-900 dark:text-white">{isEdit ? 'Edit Book' : 'Add Book'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Title *</label>
              <input className="input w-full" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Author *</label>
              <input className="input w-full" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">ISBN</label>
              <input className="input w-full" value={form.isbn} onChange={e => setForm({ ...form, isbn: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Publisher</label>
              <input className="input w-full" value={form.publisher} onChange={e => setForm({ ...form, publisher: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Edition</label>
              <input className="input w-full" value={form.edition} onChange={e => setForm({ ...form, edition: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Language</label>
              <input className="input w-full" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Category</label>
              <select className="input w-full" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">— None —</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Price (₹)</label>
              <input type="number" min="0" className="input w-full" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Rack</label>
              <input className="input w-full" value={form.location?.rack || ''} onChange={e => setForm({ ...form, location: { ...form.location, rack: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Shelf</label>
              <input className="input w-full" value={form.location?.shelf || ''} onChange={e => setForm({ ...form, location: { ...form.location, shelf: e.target.value } })} />
            </div>
            {!isEdit && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Initial copies</label>
                <input type="number" min="0" className="input w-full" value={form.copies} onChange={e => setForm({ ...form, copies: parseInt(e.target.value, 10) || 0 })} />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">Description</label>
            <textarea rows={3} className="input w-full" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn btn-primary">
              {mutation.isPending ? 'Saving...' : (isEdit ? 'Save' : 'Add Book')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookFormModal;
