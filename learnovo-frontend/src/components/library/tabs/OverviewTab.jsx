import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, RefreshCw, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../../services/libraryService';
import { formatDateShort } from '../../../utils/formatDate';

const OverviewTab = ({ onNavigate }) => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['library-dashboard'],
    queryFn: () => libraryService.getDashboard()
  });

  const sweepMutation = useMutation({
    mutationFn: () => libraryService.sweepOverdue(),
    onSuccess: (res) => {
      toast.success(`Marked ${res?.data?.updated || 0} issues as overdue`);
      qc.invalidateQueries({ queryKey: ['library-dashboard'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed')
  });

  const stats = data?.data?.stats || {};
  const recent = data?.data?.recentIssues || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Library Overview</h2>
        <button
          onClick={() => sweepMutation.mutate()}
          disabled={sweepMutation.isPending}
          className="btn btn-outline gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${sweepMutation.isPending ? 'animate-spin' : ''}`} />
          Sweep overdue
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 text-white rounded-2xl p-5 shadow-glass">
          <IndianRupee className="h-6 w-6 mb-2 opacity-90" />
          <p className="text-xs uppercase tracking-wider opacity-80">Pending Fines</p>
          <p className="text-3xl font-bold mt-1">₹{(stats.pendingFinesAmount || 0).toLocaleString('en-IN')}</p>
          <p className="text-sm mt-1 opacity-90">{stats.pendingFinesCount || 0} unpaid</p>
          <button onClick={() => onNavigate('fines')} className="inline-flex items-center gap-1 mt-3 text-sm font-medium hover:underline">
            View fines <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-glass">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Issues</h3>
            <button onClick={() => onNavigate('issues')} className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">View all</button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {recent.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-[#8E8E93]">No issues yet</div>
            ) : recent.map(issue => (
              <div key={issue._id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{issue.bookId?.title || 'Book'}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                    {issue.userId?.name || `${issue.userId?.firstName || ''} ${issue.userId?.lastName || ''}`.trim() || 'Member'}
                    {' · '}
                    {formatDateShort(issue.issueDate)}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                  issue.status === 'returned' ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400' :
                  issue.status === 'overdue' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                  'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                }`}>
                  {issue.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
