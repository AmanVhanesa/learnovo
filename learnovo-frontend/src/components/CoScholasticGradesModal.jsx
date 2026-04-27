import { useEffect, useState } from 'react'
import { X, Save, Plus, Trash2 } from 'lucide-react'
import { examsService } from '../services/examsService'
import toast from 'react-hot-toast'

const GRADE_OPTIONS = ['', 'A+', 'A', 'B+', 'B', 'C', 'D', 'E']

export default function CoScholasticGradesModal({ open, onClose, studentId, sessionId, studentName }) {
    const [areas, setAreas] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open || !studentId || !sessionId) return
        let cancelled = false
        setLoading(true)
        examsService.getCoScholasticGrades(studentId, sessionId)
            .then(res => {
                if (cancelled) return
                const list = res?.data?.areas || []
                setAreas(list.length ? list : [{ area: '', term1Grade: '', term2Grade: '' }])
            })
            .catch(() => {
                if (!cancelled) toast.error('Failed to load co-scholastic grades')
            })
            .finally(() => !cancelled && setLoading(false))
        return () => { cancelled = true }
    }, [open, studentId, sessionId])

    const update = (i, key, val) => setAreas(prev => prev.map((a, idx) => idx === i ? { ...a, [key]: val } : a))
    const addRow = () => setAreas(prev => [...prev, { area: '', term1Grade: '', term2Grade: '' }])
    const removeRow = (i) => setAreas(prev => prev.filter((_, idx) => idx !== i))

    const handleSave = async () => {
        const cleaned = areas.filter(a => a.area && a.area.trim())
        setSaving(true)
        try {
            await examsService.saveCoScholasticGrades(studentId, sessionId, cleaned)
            toast.success('Co-scholastic grades saved')
            onClose?.(true)
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Failed to save grades')
        } finally {
            setSaving(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#38383A]">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Co-Scholastic Grades</h3>
                        {studentName && <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">{studentName}</p>}
                    </div>
                    <button onClick={() => onClose?.(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E]">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-5 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading…</div>
                    ) : (
                        <>
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-2 mb-2">
                                <div className="col-span-6">AREA</div>
                                <div className="col-span-2 text-center">TERM 1</div>
                                <div className="col-span-2 text-center">TERM 2</div>
                                <div className="col-span-2"></div>
                            </div>
                            <div className="space-y-2">
                                {areas.map((a, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                        <input
                                            className="col-span-6 input text-sm"
                                            value={a.area}
                                            placeholder="e.g. Discipline, Art, Work Education"
                                            onChange={e => update(i, 'area', e.target.value)}
                                        />
                                        <select
                                            className="col-span-2 input text-sm text-center"
                                            value={a.term1Grade || ''}
                                            onChange={e => update(i, 'term1Grade', e.target.value)}
                                        >
                                            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g || '—'}</option>)}
                                        </select>
                                        <select
                                            className="col-span-2 input text-sm text-center"
                                            value={a.term2Grade || ''}
                                            onChange={e => update(i, 'term2Grade', e.target.value)}
                                        >
                                            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g || '—'}</option>)}
                                        </select>
                                        <button
                                            onClick={() => removeRow(i)}
                                            className="col-span-2 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 flex items-center justify-center"
                                            title="Remove"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={addRow}
                                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Add area
                            </button>
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-[#38383A]">
                    <button
                        onClick={() => onClose?.(false)}
                        className="btn btn-outline"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="btn btn-primary gap-1.5"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving…' : 'Save grades'}
                    </button>
                </div>
            </div>
        </div>
    )
}
