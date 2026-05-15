import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Edit2, Plus, Music, Users, Calendar, Clock,
  IndianRupee, User, UserMinus, PauseCircle, PlayCircle
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

const Stat = ({ label, value, sub }) => (
  <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-gray-100 dark:border-[#2C2C2E]">
    <div className="text-xs text-gray-500 dark:text-[#8E8E93] mb-1">{label}</div>
    <div className="text-xl font-semibold text-gray-900 dark:text-white">{value}</div>
    {sub && <div className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">{sub}</div>}
  </div>
)

const ActivityProgramDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)
  const [withdrawing, setWithdrawing] = useState(null)
  const [statusFilter, setStatusFilter] = useState('active')

  const programQuery = useQuery({
    queryKey: ['activity-program', id],
    queryFn: () => activityProgramsService.get(id),
    enabled: Boolean(id)
  })
  const program = programQuery.data?.data

  const enrollmentsQuery = useQuery({
    queryKey: ['activity-program-enrollments', id, statusFilter],
    queryFn: () => activityProgramsService.listEnrollments(id, { status: statusFilter }),
    enabled: Boolean(id)
  })
  const enrollments = enrollmentsQuery.data?.data || []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['activity-program', id] })
    queryClient.invalidateQueries({ queryKey: ['activity-program-enrollments', id] })
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
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    }
  }

  if (programQuery.isLoading) return <LoadingSpinner />
  if (!program) {
    return (
      <EmptyState
        icon={Music}
        title="Activity not found"
        description="It may have been deleted."
        action={<Link to="/app/activity-programs" className="text-primary-600 text-sm">Back to activities</Link>}
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate('/app/activity-programs')} className="inline-flex items-center gap-1 text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> All activities
        </button>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#2C2C2E] overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-64 aspect-[16/10] sm:aspect-square bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center flex-shrink-0">
            {program.photo ? (
              <img src={program.photo} alt={program.name} className="w-full h-full object-cover" />
            ) : (
              <Music className="w-16 h-16 text-primary-400" />
            )}
          </div>
          <div className="flex-1 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 ring-1 ring-inset ring-primary-100 dark:ring-primary-800">
                    {program.category || 'Other'}
                  </span>
                  {!program.isActive && <StatusBadge status="Inactive" />}
                </div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">{program.name}</h1>
                {program.description && (
                  <p className="text-sm text-gray-600 dark:text-[#E5E5EA] mt-2 max-w-2xl">{program.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                <Button variant="primary" size="sm" disabled={!program.isActive} onClick={() => setShowEnroll(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Enroll Students
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="flex items-start gap-2">
                <IndianRupee className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Monthly fee</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(program.monthlyFee)}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Enrolled</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {program.enrollmentCount}{program.capacity ? <span className="text-gray-400 dark:text-[#636366]"> / {program.capacity}</span> : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Schedule</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{program.schedule || '—'}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Instructor</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{program.instructor?.name || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enrollments */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#2C2C2E]">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 dark:border-[#2C2C2E]">
          <div className="text-sm font-semibold text-gray-800 dark:text-white">Enrolled Students</div>
          <select className="input !py-1.5 sm:w-40 text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Withdrawn</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
        </div>

        {enrollmentsQuery.isLoading ? (
          <div className="p-6"><LoadingSpinner /></div>
        ) : enrollments.length === 0 ? (
          <EmptyState icon={Users} title="No students yet" description="Click Enroll Students to add the first batch." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#1C1C1E] text-xs uppercase text-gray-500 dark:text-[#8E8E93]">
                <tr>
                  <th className="text-left px-4 py-2">Student</th>
                  <th className="text-right px-4 py-2">Fee</th>
                  <th className="text-left px-4 py-2">Enrolled</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Actions</th>
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
                    <tr key={e._id} className="border-t border-gray-100 dark:border-[#2C2C2E]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{e.student?.name || '—'}</div>
                        <div className="text-xs text-gray-500 dark:text-[#8E8E93]">
                          {e.student?.admissionNumber || '—'}{e.student?.class ? ` · ${e.student.class}` : ''}{e.student?.section ? `-${e.student.section}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(eff)}</div>
                        {eff !== e.monthlyFee && (
                          <div className="text-xs text-gray-400 line-through">{formatCurrency(e.monthlyFee)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-[#8E8E93]">
                        {new Date(e.enrolledFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {e.enrolledTo && <div>→ {new Date(e.enrolledTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={e.status === 'active' ? 'Active' : e.status === 'paused' ? 'Pending' : 'Inactive'} />
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
        )}
      </div>

      {showEdit && (
        <ActivityProgramFormModal
          program={program}
          onClose={() => setShowEdit(false)}
          onSaved={() => refresh()}
        />
      )}
      {showEnroll && (
        <EnrollStudentsModal
          program={program}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => refresh()}
        />
      )}
      {withdrawing && (
        <WithdrawEnrollmentModal
          enrollment={withdrawing}
          onClose={() => setWithdrawing(null)}
          onWithdrawn={() => refresh()}
        />
      )}
    </div>
  )
}

export default ActivityProgramDetail
