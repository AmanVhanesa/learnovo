import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, AlertCircle, AlertTriangle, IndianRupee, Loader2 } from 'lucide-react'
import studentsService from '../../services/studentsService'

const DeactivateStudentModal = ({ student, onConfirm, onCancel, isLoading }) => {
    const navigate = useNavigate()
    const [formData, setFormData] = useState({
        removalDate: new Date().toISOString().split('T')[0],
        removalReason: 'Other',
        removalNotes: ''
    })
    const [pendingFees, setPendingFees] = useState(null)
    const [feesLoading, setFeesLoading] = useState(true)
    const [feesSkipped, setFeesSkipped] = useState(false)

    // Fetch pending fees when modal opens
    useEffect(() => {
        let cancelled = false
        const fetchFees = async () => {
            try {
                const res = await studentsService.getPendingFees(student._id)
                if (!cancelled) setPendingFees(res.data)
            } catch {
                if (!cancelled) setPendingFees({ hasPending: false, totalAmount: 0, count: 0, breakdown: [] })
            } finally {
                if (!cancelled) setFeesLoading(false)
            }
        }
        fetchFees()
        return () => { cancelled = true }
    }, [student._id])

    const handleSubmit = (e) => {
        e.preventDefault()
        // If there are pending fees and user hasn't acknowledged them, show the fees first
        if (pendingFees?.hasPending && !feesSkipped) return
        onConfirm(formData)
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleCollectFees = () => {
        onCancel()
        navigate(`/app/fees?student=${student._id}`)
    }

    const handleSkipFees = () => {
        setFeesSkipped(true)
    }

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#38383A]">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Deactivate Student</h2>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 dark:text-[#8E8E93]"
                        disabled={isLoading}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1 min-h-0">
                    <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                        {/* Student Info */}
                        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-3">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">{student.fullName || student.name}</p>
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                                {student.class && student.section ? `${student.class}-${student.section}` : student.class || 'N/A'} •
                                Admission No: {student.admissionNumber || 'N/A'}
                            </p>
                        </div>

                        {/* Pending Fees Section */}
                        {feesLoading ? (
                            <div className="flex items-center justify-center gap-2 py-4 text-gray-500 dark:text-[#8E8E93]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Checking pending fees...</span>
                            </div>
                        ) : pendingFees?.hasPending ? (
                            <div className="border border-red-200 dark:border-red-800 rounded-2xl overflow-hidden">
                                {/* Fees Header */}
                                <div className="bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        <span className="text-sm font-semibold text-red-800 dark:text-red-300">Pending Fees Found</span>
                                    </div>
                                    <span className="text-base font-bold text-red-600 dark:text-red-400 flex items-center">
                                        <IndianRupee className="h-3.5 w-3.5" />
                                        {pendingFees.totalAmount?.toLocaleString('en-IN')}
                                    </span>
                                </div>

                                {/* Fees Breakdown */}
                                {pendingFees.breakdown?.length > 0 && (
                                    <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 dark:divide-[#38383A]">
                                        {pendingFees.breakdown.map((fee, i) => (
                                            <div key={fee.id || i} className="px-4 py-2 flex items-center justify-between text-sm">
                                                <div className="min-w-0 flex-1 mr-3">
                                                    <p className="text-gray-800 dark:text-gray-200 font-medium truncate">{fee.description}</p>
                                                    <p className="text-xs text-gray-400 dark:text-[#636366] capitalize">{fee.feeType} · {fee.status}</p>
                                                </div>
                                                <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap flex items-center">
                                                    <IndianRupee className="h-3 w-3" />{fee.balance?.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Fees Action Buttons */}
                                {!feesSkipped && (
                                    <div className="px-4 py-3 bg-gray-50 dark:bg-[#2C2C2E] flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleCollectFees}
                                            className="btn btn-primary flex-1 text-sm py-2"
                                        >
                                            Collect Fees
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSkipFees}
                                            className="btn flex-1 text-sm py-2 bg-amber-500 hover:bg-amber-600 text-white"
                                        >
                                            Skip & Proceed
                                        </button>
                                    </div>
                                )}

                                {feesSkipped && (
                                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                        Pending fees skipped — proceeding with deactivation
                                    </div>
                                )}
                            </div>
                        ) : pendingFees && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3 flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                                    <svg className="h-3 w-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <span className="text-sm text-emerald-800 dark:text-emerald-300">No pending fees</span>
                            </div>
                        )}

                        {/* Removal Date */}
                        <div>
                            <label htmlFor="removalDate" className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Removal Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                id="removalDate"
                                name="removalDate"
                                value={formData.removalDate}
                                onChange={handleChange}
                                max={new Date().toISOString().split('T')[0]}
                                required
                                className="input"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-[#8E8E93]">Date when student left the school</p>
                        </div>

                        {/* Removal Reason */}
                        <div>
                            <label htmlFor="removalReason" className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Reason for Leaving <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="removalReason"
                                name="removalReason"
                                value={formData.removalReason}
                                onChange={handleChange}
                                required
                                className="input"
                            >
                                <option value="Graduated">Graduated</option>
                                <option value="Transferred">Transferred to Another School</option>
                                <option value="Withdrawn">Withdrawn by Parent</option>
                                <option value="Expelled">Expelled</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* Additional Notes */}
                        <div>
                            <label htmlFor="removalNotes" className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Additional Notes
                            </label>
                            <textarea
                                id="removalNotes"
                                name="removalNotes"
                                value={formData.removalNotes}
                                onChange={handleChange}
                                rows={3}
                                placeholder="e.g., Moved to XYZ School in another city"
                                className="input"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-[#8E8E93]">Optional details about the removal</p>
                        </div>

                        {/* Warning */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-3 flex gap-2">
                            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-yellow-800 dark:text-yellow-300">
                                <p className="font-medium">This will mark the student as inactive</p>
                                <p className="mt-1 dark:text-yellow-400">The student will be hidden from the active student list and won't be able to login.</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E]">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn btn-ghost"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-danger"
                            disabled={isLoading || feesLoading || (pendingFees?.hasPending && !feesSkipped)}
                        >
                            {isLoading ? 'Deactivating...' : 'Deactivate Student'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    )
}

export default DeactivateStudentModal
