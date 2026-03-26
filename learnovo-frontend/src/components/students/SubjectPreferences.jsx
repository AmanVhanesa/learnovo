import React, { useState, useEffect } from 'react'
import { BookOpen, AlertTriangle, Save, Loader2, Info } from 'lucide-react'
import { studentsService } from '../../services/studentsService'
import toast from 'react-hot-toast'

/**
 * SubjectPreferences — per-student opt-out of optional subjects.
 *
 * Shows all optional subjects for the tenant with toggles to include/exclude.
 * Toggling OFF adds the subject name to the student's `skippedSubjects` array.
 * Skipped subjects are excluded from marks entry, results, and report cards
 * but existing marks are never deleted — only ignored.
 */
const SubjectPreferences = ({ studentId, studentName, studentClass }) => {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [optionalSubjects, setOptionalSubjects] = useState([])
    const [skippedSet, setSkippedSet] = useState(new Set())
    const [originalSkippedSet, setOriginalSkippedSet] = useState(new Set())
    const [hasChanges, setHasChanges] = useState(false)

    const fetchPreferences = async () => {
        try {
            setLoading(true)
            const res = await studentsService.getSubjectPreferences(studentId)
            const data = res.data || res
            setOptionalSubjects(data.optionalSubjects || [])
            const skipped = new Set(data.skippedSubjects || [])
            setSkippedSet(skipped)
            setOriginalSkippedSet(new Set(skipped))
            setHasChanges(false)
        } catch (err) {
            toast.error('Failed to load subject preferences')
        } finally {
            setLoading(false)
        }
    }

    // Fetch preferences when studentId changes
    useEffect(() => {
        fetchPreferences()
    }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

    const toggleSubject = (subjectName) => {
        setSkippedSet(prev => {
            const next = new Set(prev)
            if (next.has(subjectName)) {
                next.delete(subjectName)
            } else {
                next.add(subjectName)
            }
            // Track if changes differ from original
            setHasChanges(
                next.size !== originalSkippedSet.size ||
                [...next].some(s => !originalSkippedSet.has(s))
            )
            return next
        })
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            await studentsService.updateSubjectPreferences(studentId, [...skippedSet])
            setOriginalSkippedSet(new Set(skippedSet))
            setHasChanges(false)
            toast.success('Subject preferences saved')
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save preferences')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-40">
                <div className="loading-spinner" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                    <BookOpen className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
                    Subject Preferences
                </h3>
                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                    Manage which optional subjects are included for {studentName || 'this student'}.
                </p>
            </div>

            {/* Helper text */}
            <div className="flex items-start gap-2.5 p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-400 rounded-xl text-sm border border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Students from other states may skip optional subjects like Punjabi. Skipping a subject excludes it from marks entry, results, and report cards. Existing marks are never deleted.</span>
            </div>

            {optionalSubjects.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-[#636366]">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">No Optional Subjects</p>
                    <p className="text-xs mt-1">
                        Mark subjects as optional in Settings → Academics to enable per-student opt-out.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {optionalSubjects.map((subj) => {
                        const isSkipped = skippedSet.has(subj.name)
                        const isIncluded = !isSkipped
                        // Show warning if toggling off a subject that has marks
                        const showWarning = isSkipped && subj.hasMarks

                        return (
                            <div
                                key={subj._id}
                                className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                                    isIncluded
                                        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-gray-50 dark:bg-[#2C2C2E] border-gray-200 dark:border-[#38383A]'
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${
                                            isIncluded
                                                ? 'text-emerald-900 dark:text-emerald-300'
                                                : 'text-gray-500 dark:text-[#8E8E93] line-through'
                                        }`}>
                                            {subj.name}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-[#636366] font-mono">
                                            {subj.subjectCode}
                                        </span>
                                    </div>

                                    {/* Warning: marks exist for a skipped subject */}
                                    {showWarning && (
                                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                            <span>This student has marks recorded for {subj.name}. Skipping will exclude them from results. Existing marks are retained but ignored.</span>
                                        </div>
                                    )}
                                </div>

                                {/* Toggle switch */}
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isIncluded}
                                    onClick={() => toggleSubject(subj.name)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-[#1C1C1E] ${
                                        isIncluded ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-[#48484A]'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                                            isIncluded ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Save button — only visible when there are changes */}
            {hasChanges && (
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn btn-primary gap-2"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {saving ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>
            )}
        </div>
    )
}

export default SubjectPreferences
