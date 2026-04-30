import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertTriangle, Package, BarChart3 } from 'lucide-react';
import libraryService from '../../services/libraryService';
import { formatDateShort } from '../../utils/formatDate';

const LibraryReports = () => {
  const { data: most } = useQuery({ queryKey: ['lib-most'], queryFn: () => libraryService.mostIssued(15) });
  const { data: defaulters } = useQuery({ queryKey: ['lib-def'], queryFn: () => libraryService.defaulters() });
  const { data: inv } = useQuery({ queryKey: ['lib-inv'], queryFn: () => libraryService.inventoryValue() });

  const mostList = most?.data || [];
  const defList = defaulters?.data || [];
  const invList = inv?.data || [];
  const totalValue = invList.reduce((s, i) => s + (i.value || 0), 0);
  const totalCopies = invList.reduce((s, i) => s + (i.count || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-emerald-600" /> Library Reports
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-0.5">Insights, defaulters, inventory valuation</p>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-5 shadow-sm">
        <h2 className="font-semibold flex items-center gap-2 mb-4"><Package className="h-4 w-4 text-emerald-600" /> Inventory Valuation</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
            <p className="text-xs text-gray-500 uppercase">Total Copies</p>
            <p className="text-xl font-bold mt-1">{totalCopies}</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
            <p className="text-xs text-gray-500 uppercase">Total Value</p>
            <p className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">₹{totalValue.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {invList.map(i => (
            <div key={i._id} className="p-3 border border-gray-100 dark:border-[#38383A] rounded-lg flex items-center justify-between">
              <span className="capitalize text-sm">{i._id}</span>
              <div className="text-right">
                <p className="text-sm font-semibold">{i.count}</p>
                <p className="text-xs text-gray-500">₹{(i.value || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A]">
            <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-600" /> Most Issued Books</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {mostList.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No data yet</div>
            ) : mostList.map((m, idx) => (
              <div key={m.bookId} className="px-5 py-3 flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{idx + 1}. {m.title}</p>
                  <p className="text-xs text-gray-500 truncate">by {m.author}</p>
                </div>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 rounded text-xs font-semibold">{m.count}×</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A]">
            <h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Defaulters ({defList.length})</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-[#38383A] max-h-96 overflow-y-auto">
            {defList.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No defaulters</div>
            ) : defList.map(d => (
              <div key={d._id} className="px-5 py-3 text-sm">
                <p className="font-medium">{d.userId?.name || `${d.userId?.firstName || ''} ${d.userId?.lastName || ''}`.trim()}</p>
                <p className="text-xs text-gray-500">{d.bookId?.title} · Due {formatDateShort(d.dueDate)}</p>
                {d.userId?.phone && <p className="text-xs text-gray-400">{d.userId.phone}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryReports;
