import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Calendar, FileText, Check, AlertTriangle } from 'lucide-react'
import ModalWrapper from '../ModalWrapper'
import Button from '../Button'
import LoadingSpinner from '../LoadingSpinner'
import StatusBadge from '../StatusBadge'
import { activityInvoicesService, activityProgramsService } from '../../services/activityProgramsService'
import { academicSessionsService } from '../../services/academicsService'
import { formatCurrency } from '../../utils/formatCurrency'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const GenerateInvoicesModal = ({ initialProgramId = '', onClose, onGenerated }) => {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [academicSessionId, setAcademicSessionId] = useState('')
  const [activityProgramId, setActivityProgramId] = useState(initialProgramId)
  const [dueDay, setDueDay] = useState(10)
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Active session default
  useEffect(() => {
    academicSessionsService.getActive()
      .then(res => { if (res?.data?._id) setAcademicSessionId(res.data._id) })
      .catch(() => {})
  }, [])

  const { data: sessionsRes } = useQuery({
    queryKey: ['academic-sessions-list-gen-inv'],
    queryFn: () => academicSessionsService.list(),
    staleTime: 5 * 60 * 1000
  })
  const sessions = sessionsRes?.data || []

  const { data: programsRes } = useQuery({
    queryKey: ['activity-programs-for-gen', 'active'],
    queryFn: () => activityProgramsService.list({ status: 'active', limit: 200 }),
    staleTime: 60 * 1000
  })
  const programs = programsRes?.data || []

  const years = useMemo(() => {
    const y = today.getFullYear()
    return [y - 1, y, y + 1]
  }, [today])

  const handlePreview = async () => {
    setLoadingPreview(true)
    setPreview(null)
    try {
      const res = await activityInvoicesService.preview({
        month, year,
        academicSessionId: academicSessionId || undefined,
        activityProgramId: activityProgramId || undefined
      })
      setPreview(res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleGenerate = async () => {
    if (!preview || preview.toGenerate === 0) {
      return toast.error('Nothing to generate. Run preview first.')
    }
    setGenerating(true)
    try {
      const res = await activityInvoicesService.generate({
        month, year,
        academicSessionId: academicSessionId || undefined,
        activityProgramId: activityProgramId || undefined,
        dueDay: Number(dueDay) || 10
      })
      toast.success(`Created ${res.data.createdCount} invoice(s)`)
      onGenerated?.(res.data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invoices')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <ModalWrapper title="Generate Monthly Activity Invoices" onClose={onClose} maxWidth="max-w-3xl">
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="col-span-1">
            <label className="label">Month</label>
            <select className="input" value={month} onChange={e => { setMonth(Number(e.target.value)); setPreview(null) }}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <label className="label">Year</label>
            <select className="input" value={year} onChange={e => { setYear(Number(e.target.value)); setPreview(null) }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-2">
            <label className="label">Academic Session</label>
            <select className="input" value={academicSessionId} onChange={e => { setAcademicSessionId(e.target.value); setPreview(null) }}>
              <option value="">All sessions</option>
              {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Due Day</label>
            <input type="number" min="1" max="28" className="input" value={dueDay} onChange={e => setDueDay(e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-5">
            <label className="label">Activity (optional)</label>
            <select className="input" value={activityProgramId} onChange={e => { setActivityProgramId(e.target.value); setPreview(null) }}>
              <option value="">All active activities</option>
              {programs.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={handlePreview} loading={loadingPreview}>
            <Calendar className="w-4 h-4 mr-1.5" /> Preview
          </Button>
        </div>

        {loadingPreview && <LoadingSpinner />}

        {preview && (
          <div className="border border-gray-100 dark:border-[#2C2C2E] rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-[#2C2C2E]">
              <div className="bg-white dark:bg-[#1C1C1E] p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Will Generate</div>
                <div className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">{preview.toGenerate}</div>
              </div>
              <div className="bg-white dark:bg-[#1C1C1E] p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Already Exists</div>
                <div className="text-xl font-semibold text-amber-700 dark:text-amber-400">{preview.alreadyExists}</div>
              </div>
              <div className="bg-white dark:bg-[#1C1C1E] p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Total Amount</div>
                <div className="text-xl font-semibold text-primary-700 dark:text-primary-400">{formatCurrency(preview.totalAmount)}</div>
              </div>
            </div>

            {preview.items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-[#8E8E93]">
                No active enrollments match — nothing to do.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-[#1C1C1E] text-xs uppercase text-gray-500 dark:text-[#8E8E93] sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2">Student</th>
                      <th className="text-left px-4 py-2">Activity</th>
                      <th className="text-right px-4 py-2">Amount</th>
                      <th className="text-center px-4 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-gray-100 dark:border-[#2C2C2E]">
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900 dark:text-white">{it.studentName}</div>
                          <div className="text-xs text-gray-500 dark:text-[#8E8E93]">{it.admissionNumber || '—'}</div>
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-[#E5E5EA]">{it.activityName}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(it.amount)}</td>
                        <td className="px-4 py-2 text-center">
                          {it.action === 'create' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              <Check className="w-3 h-3" /> Create
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400" title={`Already invoiced: ${it.existingInvoiceNumber}`}>
                              <AlertTriangle className="w-3 h-3" /> Skip
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-gray-100 dark:border-[#2C2C2E]">
          <Button variant="ghost" type="button" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button
            variant="primary" type="button"
            loading={generating}
            disabled={!preview || preview.toGenerate === 0}
            onClick={handleGenerate}
          >
            <FileText className="w-4 h-4 mr-1.5" /> Generate {preview ? preview.toGenerate : ''} Invoice{preview?.toGenerate === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </ModalWrapper>
  )
}

export default GenerateInvoicesModal
