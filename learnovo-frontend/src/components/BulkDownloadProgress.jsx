import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Download, X, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { examsService } from '../services/examsService'

const POLL_INTERVAL = 1500 // ms

export default function BulkDownloadProgress({ jobId, totalStudents, onClose }) {
    const [status, setStatus] = useState(null)
    const [downloading, setDownloading] = useState(false)
    const intervalRef = useRef(null)
    const closedRef = useRef(false)

    useEffect(() => {
        if (!jobId) return

        const poll = async () => {
            if (closedRef.current) return
            try {
                const res = await examsService.getBulkDownloadStatus(jobId)
                if (closedRef.current) return
                setStatus(res.data)

                if (res.data.status === 'completed' || res.data.status === 'failed') {
                    clearInterval(intervalRef.current)
                    intervalRef.current = null
                }
            } catch {
                // Silently ignore polling errors
            }
        }

        poll()
        intervalRef.current = setInterval(poll, POLL_INTERVAL)

        return () => {
            closedRef.current = true
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [jobId])

    const handleDownloadZip = async () => {
        setDownloading(true)
        try {
            const blob = await examsService.downloadBulkZip(jobId)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Report_Cards_${jobId.slice(0, 8)}.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
            toast.success('Report cards downloaded!')
        } catch {
            toast.error('Failed to download zip file')
        } finally {
            setDownloading(false)
        }
    }

    const completed = status?.completed || 0
    const failed = status?.failed || 0
    const total = status?.total || totalStudents || 0
    const processed = completed + failed
    const progress = total > 0 ? Math.round((processed / total) * 100) : 0
    const isDone = status?.status === 'completed'
    const isFailed = status?.status === 'failed'
    const isProcessing = !isDone && !isFailed

    return ReactDOM.createPortal(
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
        >
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
                    <div className="flex items-center gap-2.5">
                        <Download className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Bulk Report Cards</h3>
                    </div>
                    <button
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                        onClick={onClose}
                    >
                        <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {/* Progress bar */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {isProcessing && <Loader className="inline h-4 w-4 mr-1.5 animate-spin" />}
                                {isDone && <CheckCircle className="inline h-4 w-4 mr-1.5 text-green-500" />}
                                {isFailed && <AlertCircle className="inline h-4 w-4 mr-1.5 text-red-500" />}
                                {isDone ? 'Complete!' : isFailed ? 'Failed' : 'Generating PDFs...'}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">
                                {processed} of {total}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-[#38383A] rounded-full h-2.5">
                            <div
                                className={`h-2.5 rounded-full transition-all duration-500 ${
                                    isFailed ? 'bg-red-500' : isDone ? 'bg-green-500' : 'bg-primary-600'
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-[#8E8E93]">
                        <span>Generated: <strong className="text-gray-700 dark:text-gray-300">{completed}</strong></span>
                        {failed > 0 && (
                            <span className="text-red-500">Failed: <strong>{failed}</strong></span>
                        )}
                    </div>

                    {/* Errors */}
                    {status?.errors?.length > 0 && (
                        <div className="max-h-24 overflow-y-auto bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                            {status.errors.map((err, i) => (
                                <p key={i} className="text-xs text-red-600 dark:text-red-400">{err}</p>
                            ))}
                        </div>
                    )}

                    {/* Download button */}
                    {isDone && (
                        <button
                            className="btn btn-primary w-full gap-2"
                            onClick={handleDownloadZip}
                            disabled={downloading}
                        >
                            <Download className="h-4 w-4" />
                            {downloading ? 'Downloading...' : 'Download ZIP'}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
