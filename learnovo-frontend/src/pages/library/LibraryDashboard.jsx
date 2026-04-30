import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Users, AlertTriangle, IndianRupee, Library, ArrowRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import libraryService from '../../services/libraryService';
import { formatDateShort } from '../../utils/formatDate';

const StatCard = ({ icon: Icon, label, value, sub, color = 'emerald' }) => (
  <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">{label}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="mt-1 text-xs text-gray-400 dark:text-[#636366]">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl bg-${color}-50 dark:bg-${color}-500/10`}>
        <Icon className={`h-5 w-5 text-${color}-600 dark:text-${color}-400`} />
      </div>
    </div>
  </div>
);

const LibraryDashboard = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Library className="h-6 w-6 text-emerald-600" />
            Library
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-0.5">Books, issues, fines and members</p>
        </div>
        <button
          onClick={() => sweepMutation.mutate()}
          disabled={sweepMutation.isPending}
          className="btn btn-outline gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${sweepMutation.isPending ? 'animate-spin' : ''}`} />
          Sweep overdue
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-[#1C1C1E] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BookOpen} label="Total Books" value={stats.totalBooks || 0} sub={`${stats.totalCopies || 0} copies`} />
          <StatCard icon={Users} label="Active Members" value={stats.totalMembers || 0} color="blue" />
          <StatCard icon={BookOpen} label="Issued" value={stats.currentlyIssued || 0} sub={`${stats.issuedToday || 0} today`} color="indigo" />
          <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue || 0} color="amber" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
          <IndianRupee className="h-6 w-6 mb-2 opacity-90" />
          <p className="text-xs uppercase tracking-wider opacity-80">Pending Fines</p>
          <p className="text-3xl font-bold mt-1">₹{(stats.pendingFinesAmount || 0).toLocaleString('en-IN')}</p>
          <p className="text-sm mt-1 opacity-90">{stats.pendingFinesCount || 0} unpaid</p>
          <Link to="/app/library/fines" className="inline-flex items-center gap-1 mt-3 text-sm font-medium hover:underline">
            View fines <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Issues</h2>
            <Link to="/app/library/issues" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all</Link>
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
                  issue.status === 'returned' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/app/library/books" className="bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] rounded-xl p-4 transition-colors">
          <BookOpen className="h-5 w-5 text-emerald-600 mb-2" />
          <p className="font-semibold text-sm text-gray-900 dark:text-white">Books</p>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Manage catalog</p>
        </Link>
        <Link to="/app/library/issues" className="bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] rounded-xl p-4 transition-colors">
          <ArrowRight className="h-5 w-5 text-blue-600 mb-2" />
          <p className="font-semibold text-sm text-gray-900 dark:text-white">Issue / Return</p>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Daily operations</p>
        </Link>
        <Link to="/app/library/members" className="bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] rounded-xl p-4 transition-colors">
          <Users className="h-5 w-5 text-indigo-600 mb-2" />
          <p className="font-semibold text-sm text-gray-900 dark:text-white">Members</p>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Students & staff</p>
        </Link>
        <Link to="/app/library/fines" className="bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] rounded-xl p-4 transition-colors">
          <IndianRupee className="h-5 w-5 text-amber-600 mb-2" />
          <p className="font-semibold text-sm text-gray-900 dark:text-white">Fines</p>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Collect & waive</p>
        </Link>
      </div>
    </div>
  );
};

export default LibraryDashboard;
