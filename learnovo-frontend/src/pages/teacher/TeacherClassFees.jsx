import React, { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, AlertTriangle, CheckCircle, Users, Search } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { teachersService } from '../../services/teachersService'
import { formatCurrency } from '../../utils/formatCurrency'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const TeacherClassFees = () => {
  const { user } = useAuth()
  const [selectedClassId, setSelectedClassId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | pending | paid

  // Pull every class this teacher is linked to via any allocation method —
  // matches the dashboard's broader lookup so inactive classes and legacy
  // assignedClasses entries are also picked up.
  const { data: myClasses = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['teacher-class-fees-classes'],
    queryFn: async () => {
      const res = await teachersService.myAssignedClasses()
      return res.data || []
    },
    enabled: !!(user?.id || user?._id)
  })

  const { data: classFees, isLoading: loadingFees, error: feesError } = useQuery({
    queryKey: ['teacher-class-pending-fees', selectedClassId],
    queryFn: async () => {
      const res = await teachersService.myClassPendingFees(selectedClassId)
      return res.data
    },
    enabled: !!selectedClassId
  })

  // Auto-select when the teacher has exactly one class — no point making
  // them click a single-option dropdown.
  useEffect(() => {
    if (myClasses.length === 1 && !selectedClassId) {
      setSelectedClassId(myClasses[0]._id)
    }
  }, [myClasses, selectedClassId])

  const students = classFees?.students || []
  const totals = classFees?.totals || { totalInvoiced: 0, totalPaid: 0, totalBalance: 0, pendingCount: 0, studentCount: 0, byQuarter: {} }
  const quarters = classFees?.quarters || []
  // Compact label for narrow columns: e.g. "Q1 2026 (Apr-Jun)" -> "Q1 Apr–Jun"
  const shortQuarterLabel = (label) => {
    if (!label) return ''
    const m = label.match(/^(Q\d)\b.*\(([^)]+)\)/)
    if (m) return `${m[1]} ${m[2].replace(/-/g, '–')}`
    return label
  }

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter(s => {
      if (filter === 'pending' && !(s.totalBalance > 0)) return false
      if (filter === 'paid' && s.totalBalance > 0) return false
      if (!q) return true
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.admissionNumber || '').toLowerCase().includes(q) ||
        (s.rollNumber || '').toLowerCase().includes(q)
      )
    })
  }, [students, search, filter])

  if (!loadingClasses && myClasses.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] p-8 text-center">
          <Users className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No assigned classes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You don't have any classes assigned to you. Ask an admin to assign you as a class teacher,
            section teacher, or subject teacher.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Class Fee Status</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pending fee summary for students of classes assigned to you.
        </p>
      </div>

      {/* Class picker — hidden when teacher only has one class */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Class:</label>
        {myClasses.length === 1 ? (
          <span className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] font-medium text-gray-900 dark:text-white">
            {myClasses[0].name}
          </span>
        ) : (
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">— Select a class —</option>
            {myClasses.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        )}
        {classFees?.session?.name && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            Session: <span className="font-medium text-gray-700 dark:text-gray-300">{classFees.session.name}</span>
          </span>
        )}
      </div>

      {!selectedClassId && myClasses.length > 1 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-[#38383A] bg-gray-50 dark:bg-[#1C1C1E] p-8 text-center">
          <CreditCard className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Pick a class to see its pending fee summary.</p>
        </div>
      )}

      {selectedClassId && loadingFees && (
        <div className="flex items-center justify-center py-12">
          <div className="loading-spinner" />
        </div>
      )}

      {selectedClassId && feesError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          {feesError?.response?.data?.message || 'Could not load fee data for this class.'}
        </div>
      )}

      {selectedClassId && !loadingFees && classFees && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              icon={Users}
              label="Students"
              value={totals.studentCount}
              tone="neutral"
            />
            <SummaryCard
              icon={AlertTriangle}
              label="With pending dues"
              value={totals.pendingCount}
              tone="warn"
            />
            <SummaryCard
              icon={CheckCircle}
              label="Total collected"
              value={formatCurrency(totals.totalPaid)}
              tone="ok"
            />
            <SummaryCard
              icon={CreditCard}
              label="Total pending"
              value={formatCurrency(totals.totalBalance)}
              tone={totals.totalBalance > 0 ? 'danger' : 'ok'}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, admission no, roll no…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex rounded-lg border border-gray-200 dark:border-[#38383A] overflow-hidden">
              {['all', 'pending', 'paid'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
                    filter === f
                      ? 'bg-primary-500 text-white'
                      : 'bg-white dark:bg-[#1C1C1E] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Per-quarter totals */}
          {quarters.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] p-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                Quarter-wise pending
              </div>
              <div className={`grid gap-2 ${quarters.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
                {quarters.map(q => {
                  const t = totals.byQuarter?.[q.label] || { invoiced: 0, paid: 0, balance: 0, pendingCount: 0 }
                  const danger = t.balance > 0
                  return (
                    <div key={q.label} className="rounded-lg border border-gray-200 dark:border-[#38383A] p-3">
                      <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{shortQuarterLabel(q.label)}</div>
                      <div className={`mt-1 text-base font-semibold tabular-nums ${danger ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatCurrency(t.balance)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t.pendingCount} pending · paid {formatCurrency(t.paid)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-gray-50 dark:bg-[#2C2C2E] z-10">Student</th>
                    <th className="px-3 py-3 text-left font-semibold">Section</th>
                    {quarters.map(q => (
                      <th key={q.label} className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                        {shortQuarterLabel(q.label)}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Total pending</th>
                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Last payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#2C2C2E]">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4 + quarters.length} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No students match your filters.
                      </td>
                    </tr>
                  ) : filteredStudents.map(s => (
                    <tr key={s.studentId} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                      <td className="px-4 py-3 sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">
                        <div className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{s.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {s.admissionNumber || '—'}{s.rollNumber ? ` · Roll ${s.rollNumber}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{s.sectionName || '—'}</td>
                      {quarters.map(q => {
                        const cell = s.byQuarter?.[q.label] || { invoiced: 0, paid: 0, balance: 0 }
                        const noInvoice = !cell.invoiced && !cell.paid && !cell.balance
                        const paidFully = !noInvoice && cell.balance <= 0
                        return (
                          <td key={q.label} className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                            {noInvoice ? (
                              <span className="text-gray-400 dark:text-gray-500">—</span>
                            ) : paidFully ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">Paid</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400 font-semibold">{formatCurrency(cell.balance)}</span>
                            )}
                          </td>
                        )
                      })}
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                        s.totalBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {formatCurrency(s.totalBalance)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">{fmtDate(s.lastPaymentDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const toneClasses = {
  neutral: 'bg-gray-50 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-200',
  warn: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  ok: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  danger: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
}

const SummaryCard = ({ icon: Icon, label, value, tone = 'neutral' }) => (
  <div className="rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={`p-1.5 rounded-lg ${toneClasses[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <div className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums">{value}</div>
  </div>
)

export default TeacherClassFees
