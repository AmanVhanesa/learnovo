import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

const DeactivateStudentModal = ({ student, onConfirm, onCancel, isLoading }) => {
    const [formData, setFormData] = useState({
        removalDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
        removalReason: 'Other',
        removalNotes: ''
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        onConfirm(formData)
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-xl max-w-md w-full">
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
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        {/* Student Info */}
                        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">{student.fullName || student.name}</p>
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                                {student.class && student.section ? `${student.class}-${student.section}` : student.class || 'N/A'} •
                                Admission No: {student.admissionNumber || 'N/A'}
                            </p>
                        </div>

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
                                max={new Date().toISOString().split('T')[0]} // Can't be in future
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
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 flex gap-2">
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
                            disabled={isLoading}
                        >
                            {isLoading ? 'Deactivating...' : 'Deactivate Student'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default DeactivateStudentModal
