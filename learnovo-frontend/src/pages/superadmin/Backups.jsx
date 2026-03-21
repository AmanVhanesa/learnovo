import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import {
  HardDrive, Download, Trash2, Plus, Cloud, Clock, CheckCircle2, XCircle,
  RefreshCw, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle
} from 'lucide-react'

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const Backups = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const { data: backupsData, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-backups', page],
    queryFn: async () => {
      const res = await superAdminService.getBackups({ page, limit: 20 })
      return res.success ? res : { data: [], pagination: { total: 0, pages: 1 } }
    },
  })

  const triggerBackupMutation = useMutation({
    mutationFn: () => superAdminService.triggerBackup(),
    onSuccess: () => {
      toast.success('Backup triggered successfully')
      queryClient.invalidateQueries({ queryKey: ['superadmin-backups'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to trigger backup')
    },
  })

  const deleteBackupMutation = useMutation({
    mutationFn: (id) => superAdminService.deleteBackup(id),
    onSuccess: () => {
      toast.success('Backup deleted')
      queryClient.invalidateQueries({ queryKey: ['superadmin-backups'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete backup')
    },
  })

  const backups = backupsData?.data || []
  const totalPages = backupsData?.pagination?.pages || 1

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-[-0.025em]">Backup Management</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">View and manage platform data backups</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => refetch()}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold rounded-xl border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => triggerBackupMutation.mutate()}
            disabled={triggerBackupMutation.isPending}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold rounded-xl bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black hover:bg-primary-500 dark:hover:bg-[#35a89a] shadow-md active:scale-[0.97] transition-all disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {triggerBackupMutation.isPending ? 'Creating...' : 'Trigger Backup'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error.response?.data?.message || 'Failed to load backups'}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}
        </div>
      ) : backups.length === 0 ? (
        /* Empty state */
        <div className="card p-12 text-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-3">
            <HardDrive className="h-6 w-6 text-gray-400 dark:text-[#636366]" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">No backups found</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Trigger a manual backup to get started</p>
          <button
            onClick={() => triggerBackupMutation.mutate()}
            disabled={triggerBackupMutation.isPending}
            className="mt-4 inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold rounded-xl bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black hover:bg-primary-500 dark:hover:bg-[#35a89a] shadow-md active:scale-[0.97] transition-all disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Create First Backup
          </button>
        </div>
      ) : (
        <>
          {/* Backups Table — Desktop */}
          <div className="card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Filename</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Size</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Type</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Storage</th>
                    <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[#2C2C2E]">
                  {backups.map((backup) => (
                    <tr key={backup._id} className="hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {formatDate(backup.createdAt)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-[#8E8E93] font-mono truncate max-w-[200px]">
                        {backup.filename || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-white">
                        {formatBytes(backup.sizeBytes)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          backup.type === 'scheduled'
                            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-[rgba(59,130,246,0.12)] dark:text-[#64D2FF] dark:ring-0'
                            : 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-[rgba(175,82,222,0.12)] dark:text-[#BF5AF2] dark:ring-0'
                        }`}>
                          {backup.type === 'scheduled' ? 'Scheduled' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          backup.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158] dark:ring-0'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A] dark:ring-0'
                        }`}>
                          {backup.status === 'success' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {backup.status === 'success' ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-[#8E8E93]">
                          {backup.storageLocation === 'google_drive' ? <Cloud className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
                          {backup.storageLocation === 'google_drive' ? 'Google Drive' : 'Local'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {backup.driveFileId && (
                            <a
                              href={`https://drive.google.com/file/d/${backup.driveFileId}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-500/20 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" /> Drive
                            </a>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this backup?')) deleteBackupMutation.mutate(backup._id)
                            }}
                            className="inline-flex items-center px-2 py-1.5 text-xs font-semibold rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Backups Cards — Mobile */}
          <div className="md:hidden space-y-2.5">
            {backups.map((backup) => (
              <div key={backup._id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(backup.createdAt)}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                    backup.status === 'success'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]'
                      : 'bg-red-50 text-red-700 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A]'
                  }`}>
                    {backup.status === 'success' ? 'Success' : 'Failed'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93] font-mono truncate">{backup.filename}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-[#636366]">
                  <span>{formatBytes(backup.sizeBytes)}</span>
                  <span>{backup.type === 'scheduled' ? 'Scheduled' : 'Manual'}</span>
                  <span className="flex items-center gap-1">
                    {backup.storageLocation === 'google_drive' ? <Cloud className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
                    {backup.storageLocation === 'google_drive' ? 'Drive' : 'Local'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl border border-gray-200 dark:border-[#38383A] text-gray-500 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-xl border border-gray-200 dark:border-[#38383A] text-gray-500 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Backups
