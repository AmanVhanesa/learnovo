import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Plus, Music, Search, Users, FileText, MoreVertical,
  Edit2, Trash2, PowerOff, Power, X, LayoutGrid, List as ListIcon,
  PauseCircle, PlayCircle, UserMinus, Calendar
} from 'lucide-react'

import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Button from '../components/Button'
import { formatCurrency } from '../utils/formatCurrency'
import { activityProgramsService, activityEnrollmentsService } from '../services/activityProgramsService'

import ActivityProgramFormModal from '../components/activities/ActivityProgramFormModal'
import EnrollStudentsModal from '../components/activities/EnrollStudentsModal'
import WithdrawEnrollmentModal from '../components/activities/WithdrawEnrollmentModal'
import GenerateInvoicesModal from '../components/activities/GenerateInvoicesModal'

const TABS = [
  { id: 'programs', label: 'Activities', icon: LayoutGrid },
  { id: 'enrollments', label: 'Enrollments', icon: Users }
]

const CATEGORIES = ['Sports', 'Music', 'Dance', 'Arts', 'Academic', 'Other']

const CategoryPill = ({ category }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 ring-1 ring-inset ring-primary-100 dark:ring-primary-800">
    {category}
  </span>
)

const ProgramCard = ({ program, onView, onEdit, onToggle, onDelete, onEnroll }) => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={`group relative bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#2C2C2E] hover:shadow-glass transition-shadow overflow-hidden ${!program.isActive ? 'opacity-70' : ''}`}>
      <button onClick={onView} className="block w-full text-left">
        <div className="aspect-[16/10] bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center overflow-hidden">
          {program.photo ? (
            <img src={program.photo} alt={program.name} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-12 h-12 text-primary-400" />
          )}
        </div>
      </button>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onView} className="text-left flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-1">{program.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <CategoryPill category={program.category || 'Other'} />
              {!program.isActive && <StatusBadge status="Inactive" />}
            </div>
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-[#1C1C1E] rounded-xl shadow-glass-lg border border-gray-100 dark:border-[#2C2C2E] z-20 overflow-hidden">
                  <button onClick={() => { setMenuOpen(false); onEdit(program) }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#2C2C2E] flex items-center gap-2 text-gray-700 dark:text-white">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => { setMenuOpen(false); onToggle(program) }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#2C2C2E] flex items-center gap-2 text-gray-700 dark:text-white">
                    {program.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    {program.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => { setMenuOpen(false); onDelete(program) }} className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 dark:hover:bg-red-900/20 flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {program.schedule && (
          <div className="text-xs text-gray-500 dark:text-[#8E8E93] line-clamp-1">{program.schedule}</div>
        )}

        <div className="flex items-end justify-between pt-1">
          <div>
            <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Monthly fee</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(program.monthlyFee)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Enrolled</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {program.enrollmentCount}{program.capacity ? <span className="text-gray-400 dark:text-[#636366]"> / {program.capacity}</span> : ''}
            </div>
          </div>
        </div>

        <Button variant="secondary" size="sm" className="w-full" onClick={onEnroll} disabled={!program.isActive}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Enroll Students
        </Button>
      </div>
    </div>
  )
}

const ActivityPrograms = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('programs')

  // Programs filters
  const [pSearch, setPSearch] = useState('')
  const [pCategory, setPCategory] = useState('')
  const [pStatus, setPStatus] = useState('all')

  // Enrollments filters
  const [eSearch, setESearch] = useState('')
  const [eActivity, setEActivity] = useState('')
  const [eStatus, setEStatus] = useState('active')
  const [ePage, setEPage] = useState(1)

  // Modals
  const [editingProgram, setEditingProgram] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [enrollFor, setEnrollFor] = useState(null)
  const [withdrawing, setWithdrawing] = useState(null)
  const [showGenInv, setShowGenInv] = useState(false)

  const programsQuery = useQuery({
    queryKey: ['activity-programs', pSearch, pCategory, pStatus],
    queryFn: () => activityProgramsService.list({
      search: pSearch.trim() || undefined,
      category: pCategory || undefined,
      status: pStatus !== 'all' ? pStatus : undefined,
      limit: 100
    }),
    keepPreviousData: true
  })
  const programs = programsQuery.data?.data || []

  const enrollmentsQuery = useQuery({
    queryKey: ['activity-enrollments', eSearch, eActivity, eStatus, ePage],
    queryFn: () => activityEnrollmentsService.list({
      search: eSearch.trim() || undefined,
      activityProgram: eActivity || undefined,
      status: eStatus,
      page: ePage,
      limit: 50
    }),
    keepPreviousData: true,
    enabled: activeTab === 'enrollments'
  })
  const enrollments = enrollmentsQuery.data?.data || []
  const enrollmentsPagination = enrollmentsQuery.data?.pagination

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['activity-programs'] })
    queryClient.invalidateQueries({ queryKey: ['activity-enrollments'] })
  }

  const handleToggle = async (program) => {
    try {
      await activityProgramsService.toggle(program._id)
      toast.success(`Activity ${program.isActive ? 'deactivated' : 'activated'}`)
      programsQuery.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle')
    }
  }

  const handleDelete = async (program) => {
    if (!confirm(`Delete "${program.name}"? Active enrollments must be withdrawn first.`)) return
    try {
      await activityProgramsService.remove(program._id)
      toast.success('Activity deleted')
      programsQuery.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    }
  }

  const handlePauseResume = async (enrollment) => {
    try {
      if (enrollment.status === 'active') {
        await activityEnrollmentsService.pause(enrollment._id)
        toast.success('Enrollment paused')
      } else if (enrollment.status === 'paused') {
        await activityEnrollmentsService.resume(enrollment._id)
        toast.success('Enrollment resumed')
      }
      refreshAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Activities</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage extra-curricular activities and monthly fees</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setShowGenInv(true)}>
            <Calendar className="w-4 h-4 mr-1.5" /> Generate Monthly Invoices
          </Button>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Activity
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-[#2C2C2E]">
        <nav className="-mb-px flex gap-6">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 py-2.5 px-1 border-b-2 text-sm font-medium transition-colors ${active
                  ? 'border-primary-500 text-primary-700 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'}`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Programs tab */}
      {activeTab === 'programs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="input pl-10"
                placeholder="Search activities..."
                value={pSearch}
                onChange={e => setPSearch(e.target.value)}
              />
            </div>
            <select className="input sm:w-40" value={pCategory} onChange={e => setPCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input sm:w-36" value={pStatus} onChange={e => setPStatus(e.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {programsQuery.isLoading ? (
            <LoadingSpinner />
          ) : programs.length === 0 ? (
            <EmptyState
              icon={Music}
              title="No activities yet"
              description="Create your first extra-curricular activity to start enrolling students."
              action={<Button variant="primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" /> New Activity</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {programs.map(p => (
                <ProgramCard
                  key={p._id}
                  program={p}
                  onView={() => navigate(`/app/activity-programs/${p._id}`)}
                  onEdit={() => setEditingProgram(p)}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEnroll={() => setEnrollFor(p)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enrollments tab */}
      {activeTab === 'enrollments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="input pl-10"
                placeholder="Search students..."
                value={eSearch}
                onChange={e => { setEPage(1); setESearch(e.target.value) }}
              />
            </div>
            <select className="input sm:w-56" value={eActivity} onChange={e => { setEPage(1); setEActivity(e.target.value) }}>
              <option value="">All activities</option>
              {programs.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <select className="input sm:w-40" value={eStatus} onChange={e => { setEPage(1); setEStatus(e.target.value) }}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Withdrawn</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
          </div>

          {enrollmentsQuery.isLoading ? (
            <LoadingSpinner />
          ) : enrollments.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No enrollments"
              description="Once you enroll students from the Activities tab, they'll appear here."
            />
          ) : (
            <div className="rounded-2xl border border-gray-100 dark:border-[#2C2C2E] overflow-hidden bg-white dark:bg-[#1C1C1E]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-[#1C1C1E] text-xs uppercase text-gray-500 dark:text-[#8E8E93]">
                    <tr>
                      <th className="text-left px-4 py-3">Student</th>
                      <th className="text-left px-4 py-3">Activity</th>
                      <th className="text-right px-4 py-3">Fee</th>
                      <th className="text-left px-4 py-3">Enrolled</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map(e => {
                      const eff = e.discountType === 'percent'
                        ? Math.round((e.monthlyFee || 0) * (100 - (e.discountValue || 0)) / 100)
                        : e.discountType === 'fixed'
                          ? Math.max(0, (e.monthlyFee || 0) - (e.discountValue || 0))
                          : (e.monthlyFee || 0)
                      const isOngoing = e.status === 'active' || e.status === 'paused'
                      return (
                        <tr key={e._id} className="border-t border-gray-100 dark:border-[#2C2C2E] hover:bg-gray-50/60 dark:hover:bg-[#2C2C2E]/40">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{e.student?.name || '—'}</div>
                            <div className="text-xs text-gray-500 dark:text-[#8E8E93]">
                              {e.student?.admissionNumber || '—'}{e.student?.class ? ` · ${e.student.class}` : ''}{e.student?.section ? `-${e.student.section}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-[#E5E5EA]">
                            {e.activityProgram?.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(eff)}</div>
                            {eff !== e.monthlyFee && (
                              <div className="text-xs text-gray-400 line-through">{formatCurrency(e.monthlyFee)}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-[#8E8E93] text-xs">
                            {new Date(e.enrolledFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {e.enrolledTo && <div>→ {new Date(e.enrolledTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={e.status === 'active' ? 'Active' : e.status === 'paused' ? 'Pending' : e.status === 'completed' ? 'Inactive' : 'Inactive'} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {isOngoing && (
                                <button
                                  onClick={() => handlePauseResume(e)}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-[#2C2C2E]"
                                  title={e.status === 'active' ? 'Pause' : 'Resume'}
                                >
                                  {e.status === 'active' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                                </button>
                              )}
                              {isOngoing && (
                                <button
                                  onClick={() => setWithdrawing(e)}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Withdraw"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {enrollmentsPagination && enrollmentsPagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-[#2C2C2E] text-xs text-gray-500 dark:text-[#8E8E93]">
                  <div>Page {enrollmentsPagination.page} of {enrollmentsPagination.pages} · {enrollmentsPagination.total} total</div>
                  <div className="flex gap-1">
                    <button className="px-2 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-40" disabled={ePage <= 1} onClick={() => setEPage(p => Math.max(1, p - 1))}>Prev</button>
                    <button className="px-2 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-40" disabled={ePage >= enrollmentsPagination.pages} onClick={() => setEPage(p => p + 1)}>Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {(showCreate || editingProgram) && (
        <ActivityProgramFormModal
          program={editingProgram}
          onClose={() => { setShowCreate(false); setEditingProgram(null) }}
          onSaved={() => programsQuery.refetch()}
        />
      )}
      {enrollFor && (
        <EnrollStudentsModal
          program={enrollFor}
          onClose={() => setEnrollFor(null)}
          onEnrolled={() => { refreshAll() }}
        />
      )}
      {withdrawing && (
        <WithdrawEnrollmentModal
          enrollment={withdrawing}
          onClose={() => setWithdrawing(null)}
          onWithdrawn={() => { refreshAll() }}
        />
      )}
      {showGenInv && (
        <GenerateInvoicesModal
          onClose={() => setShowGenInv(false)}
          onGenerated={() => { refreshAll() }}
        />
      )}
    </div>
  )
}

export default ActivityPrograms
