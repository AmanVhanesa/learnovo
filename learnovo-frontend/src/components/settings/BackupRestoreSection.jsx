import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Upload, Clock, AlertTriangle, CheckCircle, XCircle, Loader, HardDrive, Cloud, CloudOff } from 'lucide-react'
import { backupService } from '../../services/backupService'
import toast from 'react-hot-toast'

const BackupRestoreSection = () => {
  const queryClient = useQueryClient()
  const [restoreConfirmation, setRestoreConfirmation] = useState('')
  const [cloudRestoreConfirmation, setCloudRestoreConfirmation] = useState('')
  const [showRestoreSection, setShowRestoreSection] = useState(false)
  const [restoreData, setRestoreData] = useState(null)

  // Fetch backup history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['backup-history'],
    queryFn: async () => {
      const res = await backupService.getHistory()
      return res.success ? res.data : []
    },
  })
  const backupHistory = historyData || []

  // Fetch cloud backup status
  const { data: cloudData } = useQuery({
    queryKey: ['cloud-backup-status'],
    queryFn: async () => {
      const res = await backupService.getCloudStatus()
      return res.success ? res.data : { configured: false }
    },
  })
  const cloudStatus = cloudData || { configured: false }

  // Backup to cloud mutation
  const cloudBackupMutation = useMutation({
    mutationFn: () => backupService.backupToCloud(),
    onSuccess: (data) => {
      toast.success(data.message || 'Backed up to Google Drive!')
      queryClient.invalidateQueries({ queryKey: ['backup-history'] })
      queryClient.invalidateQueries({ queryKey: ['cloud-backup-status'] })
      queryClient.invalidateQueries({ queryKey: ['last-backup'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Cloud backup failed.')
    }
  })

  // Download backup mutation
  const downloadMutation = useMutation({
    mutationFn: () => backupService.downloadBackup(),
    onSuccess: (response) => {
      const blob = new Blob([response.data], { type: 'application/gzip' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const disposition = response.headers?.['content-disposition']
      let filename = `learnovo-backup-${new Date().toISOString().split('T')[0]}.json.gz`
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/)
        if (match) filename = match[1]
      }
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Backup downloaded!')
      queryClient.invalidateQueries({ queryKey: ['backup-history'] })
      queryClient.invalidateQueries({ queryKey: ['last-backup'] })
    },
    onError: async (error) => {
      let message = 'Download failed.'
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text()
          const json = JSON.parse(text)
          message = json.message || message
        } catch { /* ignore */ }
      } else if (error.response?.data?.message) {
        message = error.response.data.message
      }
      toast.error(message)
    }
  })

  // Restore from file mutation
  const restoreMutation = useMutation({
    mutationFn: ({ backupData, confirmation }) => backupService.restore(backupData, confirmation),
    onSuccess: (data) => {
      setRestoreConfirmation('')
      setRestoreData(null)
      setShowRestoreSection(false)
      // Only show ONE toast for restore
      toast.success(data.message || 'Data restored successfully!', { duration: 5000 })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Restore failed.')
    }
  })

  // Restore from cloud mutation
  const cloudRestoreMutation = useMutation({
    mutationFn: (confirmation) => backupService.restoreFromCloud(confirmation),
    onSuccess: (data) => {
      setCloudRestoreConfirmation('')
      setShowRestoreSection(false)
      // Only show ONE toast for restore — no backup-related invalidations
      toast.success(data.message || 'Data restored from cloud successfully!', { duration: 5000 })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Cloud restore failed.')
    }
  })

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      let text
      if (file.name.endsWith('.gz')) {
        const arrayBuffer = await file.arrayBuffer()
        const ds = new DecompressionStream('gzip')
        const decompressedStream = new Blob([arrayBuffer]).stream().pipeThrough(ds)
        const decompressedBlob = await new Response(decompressedStream).blob()
        text = await decompressedBlob.text()
      } else {
        text = await file.text()
      }
      const parsed = JSON.parse(text)
      setRestoreData(parsed)
      toast.success(`Backup file loaded: ${Object.keys(parsed).length} collections found`)
    } catch {
      toast.error('Invalid backup file.')
      setRestoreData(null)
    }
    e.target.value = ''
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="space-y-8">
      {/* Cloud Backup Status */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-500" />
          Google Drive Backup
        </h3>

        {cloudStatus.configured ? (
          <div className="mt-3 space-y-3">
            {cloudStatus.file ? (
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-[#8E8E93]">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Last cloud backup: <strong className="text-gray-900 dark:text-white">{formatDate(cloudStatus.file.modifiedTime)}</strong></span>
                <span className="text-gray-400">•</span>
                <span>{formatBytes(cloudStatus.file.size)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                No cloud backup found yet. Take your first backup below.
              </div>
            )}

            <p className="text-xs text-gray-400 dark:text-[#636366]">
              Automatic daily backups run at 2:00 AM IST. One file per school, overwritten each time.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => cloudBackupMutation.mutate()}
                disabled={cloudBackupMutation.isPending}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                {cloudBackupMutation.isPending ? (
                  <><Loader className="h-4 w-4 animate-spin" /> Backing up...</>
                ) : (
                  <><Cloud className="h-4 w-4" /> Backup to Cloud Now</>
                )}
              </button>

              <button
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
                className="btn btn-outline inline-flex items-center gap-2"
              >
                {downloadMutation.isPending ? (
                  <><Loader className="h-4 w-4 animate-spin" /> Downloading...</>
                ) : (
                  <><Download className="h-4 w-4" /> Download to Device</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-3 p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl">
            <CloudOff className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Google Drive is not configured.</p>
              <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">
                Contact your administrator to set up Google Drive credentials for automatic cloud backups.
              </p>
              <div className="mt-3">
                <button
                  onClick={() => downloadMutation.mutate()}
                  disabled={downloadMutation.isPending}
                  className="btn btn-primary btn-sm inline-flex items-center gap-2"
                >
                  {downloadMutation.isPending ? (
                    <><Loader className="h-4 w-4 animate-spin" /> Downloading...</>
                  ) : (
                    <><Download className="h-4 w-4" /> Download Local Backup</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backup History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Backup History</h3>
        {historyLoading ? (
          <div className="flex items-center gap-2 py-4 text-gray-500 dark:text-[#8E8E93]">
            <Loader className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : backupHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-[#8E8E93]">
            <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No backups taken yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-[#38383A]">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Storage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Docs</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-[#38383A]">
                {backupHistory.slice(0, 10).map((log) => (
                  <tr key={log._id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/20 dark:text-green-400 px-2 py-0.5 rounded-full">
                          <CheckCircle className="h-3 w-3" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400 px-2 py-0.5 rounded-full">
                          <XCircle className="h-3 w-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${log.type === 'scheduled' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93]'}`}>
                        {log.type === 'scheduled' ? 'Auto' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.storageLocation === 'google_drive' ? (
                        <Cloud className="h-4 w-4 text-blue-500" title="Google Drive" />
                      ) : (
                        <HardDrive className="h-4 w-4 text-gray-400" title="Local" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#8E8E93]">{formatBytes(log.sizeBytes)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#8E8E93]">{log.documentsCount || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#8E8E93]">{log.performedBy?.name || (log.type === 'scheduled' ? 'System' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore Section */}
      <div className="border-t border-gray-200 dark:border-[#38383A] pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Restore from Backup</h3>
            <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Restore your data from a cloud or local backup.</p>
          </div>
          <button
            onClick={() => setShowRestoreSection(!showRestoreSection)}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
          >
            {showRestoreSection ? 'Cancel' : 'Show Restore Options'}
          </button>
        </div>

        {showRestoreSection && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 rounded-xl p-5 space-y-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-400">
                <p className="font-semibold">Warning: This will OVERWRITE all current data.</p>
                <p className="mt-1">This action cannot be undone.</p>
              </div>
            </div>

            {/* Restore from Cloud */}
            {cloudStatus.configured && cloudStatus.file && (
              <div className="p-4 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-blue-500" /> Restore from Google Drive
                </h4>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                  Last cloud backup: {formatDate(cloudStatus.file.modifiedTime)} ({formatBytes(cloudStatus.file.size)})
                </p>
                <div className="flex items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                      Type <span className="font-bold text-red-600">RESTORE</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={cloudRestoreConfirmation}
                      onChange={(e) => setCloudRestoreConfirmation(e.target.value)}
                      placeholder="Type RESTORE"
                      className="input max-w-[200px]"
                    />
                  </div>
                  <button
                    onClick={() => cloudRestoreMutation.mutate(cloudRestoreConfirmation)}
                    disabled={cloudRestoreConfirmation !== 'RESTORE' || cloudRestoreMutation.isPending}
                    className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {cloudRestoreMutation.isPending ? (
                      <><Loader className="h-4 w-4 animate-spin" /> Restoring...</>
                    ) : (
                      <><Cloud className="h-4 w-4" /> Restore from Cloud</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Restore from File */}
            <div className="p-4 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] space-y-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-gray-500" /> Restore from File
              </h4>
              <input
                type="file"
                accept=".json,.gz"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-red-50 file:text-red-700 hover:file:bg-red-100 dark:file:bg-red-900/20 dark:file:text-red-400"
              />
              {restoreData && (
                <>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    File loaded: {Object.keys(restoreData).length} collections ready
                  </p>
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                        Type <span className="font-bold text-red-600">RESTORE</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={restoreConfirmation}
                        onChange={(e) => setRestoreConfirmation(e.target.value)}
                        placeholder="Type RESTORE"
                        className="input max-w-[200px]"
                      />
                    </div>
                    <button
                      onClick={() => restoreMutation.mutate({ backupData: restoreData, confirmation: restoreConfirmation })}
                      disabled={restoreConfirmation !== 'RESTORE' || restoreMutation.isPending}
                      className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      {restoreMutation.isPending ? (
                        <><Loader className="h-4 w-4 animate-spin" /> Restoring...</>
                      ) : (
                        <><Upload className="h-4 w-4" /> Restore from File</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BackupRestoreSection
