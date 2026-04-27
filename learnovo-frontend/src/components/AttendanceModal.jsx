import { useEffect, useState } from 'react'
import { X, Save, UserCheck } from 'lucide-react'
import { examsService } from '../services/examsService'
import toast from 'react-hot-toast'

const EMPTY = {
    term1WorkingDays: '',
    term1PresentDays: '',
    term2WorkingDays: '',
    term2PresentDays: ''
}

export default function AttendanceModal({ open, onClose, studentId, sessionId, studentName }) {
    const [form, setForm] = useState(EMPTY)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open || !studentId || !sessionId) return
        let cancelled = false
        setLoading(true)
        examsService.getAttendance(studentId, sessionId)
            .then(res => {
                if (cancelled) return
                const d = res?.data || {}
                setForm({
                    term1WorkingDays: d.term1WorkingDays ?? '',
                    term1PresentDays: d.term1PresentDays ?? '',
                    term2WorkingDays: d.term2WorkingDays ?? '',
                    term2PresentDays: d.term2PresentDays ?? ''
                })
            })
            .catch(() => {
                if (!cancelled) toast.error('Failed to load attendance')
            })
            .finally(() => !cancelled && setLoading(false))
        return () => { cancelled = true }
    }, [open, studentId, sessionId])

    const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

    const pct = (p, w) => {
        const wn = Number(w), pn = Number(p)
        if (!wn || isNaN(wn) || isNaN(pn)) return '—'
        return `${Math.round((pn / wn) * 1000) / 10}%`
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await examsService.saveAttendance(studentId, sessionId, form)
            toast.success('Attendance saved')
            onClose?.(true)
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Failed to save attendance')
        } finally {
            setSaving(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xl bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#38383A]">
                    <div className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-primary-500" />
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance</h3>
                            {studentName && <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">{studentName}</p>}
                        </div>
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
                            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-4">Saved attendance is shown automatically in this student's two-term report card (individual and bulk downloads).</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-gray-200 dark:border-[#38383A] p-4 bg-gray-50 dark:bg-[#2C2C2E]/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Term 1</h4>
                                        <span className="text-[11px] font-medium text-primary-600 dark:text-primary-400">{pct(form.term1PresentDays, form.term1WorkingDays)}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Working</label>
                                            <input type="number" min="0" className="input text-sm w-full mt-1" value={form.term1WorkingDays} onChange={e => update('term1WorkingDays', e.target.value)} placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Present</label>
                                            <input type="number" min="0" className="input text-sm w-full mt-1" value={form.term1PresentDays} onChange={e => update('term1PresentDays', e.target.value)} placeholder="0" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-200 dark:border-[#38383A] p-4 bg-gray-50 dark:bg-[#2C2C2E]/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Term 2</h4>
                                        <span className="text-[11px] font-medium text-primary-600 dark:text-primary-400">{pct(form.term2PresentDays, form.term2WorkingDays)}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Working</label>
                                            <input type="number" min="0" className="input text-sm w-full mt-1" value={form.term2WorkingDays} onChange={e => update('term2WorkingDays', e.target.value)} placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Present</label>
                                            <input type="number" min="0" className="input text-sm w-full mt-1" value={form.term2PresentDays} onChange={e => update('term2PresentDays', e.target.value)} placeholder="0" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-[#38383A]">
                    <button onClick={() => onClose?.(false)} className="btn btn-outline">Cancel</button>
                    <button onClick={handleSave} disabled={saving || loading} className="btn btn-primary gap-1.5">
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving…' : 'Save attendance'}
                    </button>
                </div>
            </div>
        </div>
    )
}
