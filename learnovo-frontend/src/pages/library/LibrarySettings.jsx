import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Tag, Plus, Trash2, Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../services/libraryService';

const LibrarySettings = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [newCategory, setNewCategory] = useState('');

  const { data } = useQuery({ queryKey: ['library-settings'], queryFn: () => libraryService.getSettings() });
  const { data: catData } = useQuery({ queryKey: ['library-categories'], queryFn: () => libraryService.listCategories() });

  useEffect(() => { if (data?.data) setForm(data.data); }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => libraryService.updateSettings(form),
    onSuccess: () => { toast.success('Settings saved'); qc.invalidateQueries({ queryKey: ['library-settings'] }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const addCatMutation = useMutation({
    mutationFn: () => libraryService.createCategory({ name: newCategory }),
    onSuccess: () => { toast.success('Category added'); setNewCategory(''); qc.invalidateQueries({ queryKey: ['library-categories'] }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const delCatMutation = useMutation({
    mutationFn: (id) => libraryService.deleteCategory(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['library-categories'] }); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  if (!form) return <div className="p-12 text-center text-gray-500">Loading...</div>;
  const categories = catData?.data || [];

  const Field = ({ label, k, type = 'number', ...rest }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-[#E5E5EA] mb-1">{label}</label>
      <input type={type} className="input w-full" value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value })} {...rest} />
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          Library Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Fine rules, issue limits, and reservation config</p>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-5 shadow-glass space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">General</h2>
        <Field label="Library Name" k="libraryName" type="text" />
        <h2 className="font-semibold text-gray-900 dark:text-white pt-2">Issue Rules</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Max issue period (days)" k="maxIssuePeriodDays" />
          <Field label="Max renewals" k="maxRenewalsAllowed" />
          <Field label="Fine per day (₹)" k="finePerDay" />
        </div>

        <h2 className="font-semibold text-gray-900 dark:text-white pt-2">Member Limits</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Max books / student" k="maxBooksPerStudent" />
          <Field label="Max books / teacher" k="maxBooksPerTeacher" />
          <Field label="Max books / staff" k="maxBooksPerStaff" />
        </div>

        <h2 className="font-semibold text-gray-900 dark:text-white pt-2">Reservations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Reservation expiry (days)" k="reservationExpiryDays" />
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="self-res" checked={!!form.allowSelfReservation} onChange={e => setForm({ ...form, allowSelfReservation: e.target.checked })} />
            <label htmlFor="self-res" className="text-sm">Allow self-reservation</label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="auto-sync" checked={!!form.autoSyncFinesToIncome} onChange={e => setForm({ ...form, autoSyncFinesToIncome: e.target.checked })} />
            <label htmlFor="auto-sync" className="text-sm">Auto-sync fines to Income</label>
          </div>
        </div>

        <div className="pt-3">
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn btn-primary gap-2">
            <Save className="h-4 w-4" /> Save Settings
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-5 shadow-glass">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <Tag className="h-4 w-4" /> Categories
        </h2>
        <div className="flex gap-2 mb-3">
          <input className="input flex-1" placeholder="New category name..." value={newCategory} onChange={e => setNewCategory(e.target.value)} />
          <button onClick={() => addCatMutation.mutate()} disabled={!newCategory.trim() || addCatMutation.isPending} className="btn btn-primary gap-1">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
          {categories.map(c => (
            <div key={c._id} className="py-2 flex items-center justify-between">
              <span className="text-sm">{c.name}</span>
              <button onClick={() => { if (confirm(`Delete ${c.name}?`)) delCatMutation.mutate(c._id); }} className="p-1.5 text-gray-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LibrarySettings;
