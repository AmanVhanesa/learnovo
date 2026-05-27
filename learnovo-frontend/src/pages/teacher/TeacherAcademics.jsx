import React from 'react'
import { Calendar, BookOpen, Users, Star, Lock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { academicSessionsService, subjectsService, teacherAssignmentsService } from '../../services/academicsService'
import { teachersService } from '../../services/teachersService'
import { useAuth } from '../../contexts/AuthContext'

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const formatGrade = (grade) => {
  const n = parseInt(grade)
  if (isNaN(n)) return grade
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]
  return `${n}${suffix}`
}

const gradeOrder = {
  'Nursery': 0, 'LKG': 1, 'UKG': 2,
  '1': 3, '2': 4, '3': 5, '4': 6, '5': 7, '6': 8,
  '7': 9, '8': 10, '9': 11, '10': 12, '11': 13, '12': 14
}

const TeacherAcademics = () => {
  const { user } = useAuth()

  const { data: sessionsData, isLoading: loadingSessions } = useQuery({
    queryKey: ['teacher-academic-sessions'],
    queryFn: async () => {
      const [sessionsRes, activeRes] = await Promise.all([
        academicSessionsService.list(),
        academicSessionsService.getActive().catch(() => ({ data: null }))
      ])
      return { sessions: sessionsRes.data || [], activeSession: activeRes.data }
    },
  })
  const sessions = sessionsData?.sessions || []
  const activeSession = sessionsData?.activeSession || null

  const { data: myClasses = [] } = useQuery({
    queryKey: ['teacher-my-classes'],
    queryFn: async () => {
      const res = await teachersService.myClasses({ strict: true })
      return (res.data || []).sort((a, b) => (gradeOrder[a.grade] ?? 99) - (gradeOrder[b.grade] ?? 99))
    },
  })

  const { data: subjects = [] } = useQuery({
    queryKey: ['teacher-academic-subjects'],
    queryFn: async () => {
      const res = await subjectsService.list()
      return res.data || []
    },
  })

  const teacherId = user?.id || user?._id

  const { data: myAssignments = [] } = useQuery({
    queryKey: ['teacher-my-assignments', activeSession?._id, teacherId],
    queryFn: async () => {
      const res = await teacherAssignmentsService.list({
        teacherId,
        academicSessionId: activeSession?._id
      })
      return res.data || []
    },
    enabled: !!teacherId,
  })

  const userId = teacherId?.toString()
  const idOf = (v) => (v && typeof v === 'object' ? v._id : v)?.toString()

  // myClasses comes from /api/teachers/my-classes — already authoritative
  // (same logic the dashboard uses). Determine "my sections" per class: if
  // the teacher is class teacher of that class, all sections are theirs;
  // otherwise restrict to sections where they're the section teacher or
  // have a section-scoped subject assignment.
  const mySectionIdsByClass = new Map() // cid → Set<sectionId> | 'all'
  myAssignments.forEach(a => {
    const cid = idOf(a.classId)
    const sid = idOf(a.sectionId)
    if (!cid) return
    const existing = mySectionIdsByClass.get(cid)
    if (!sid) {
      mySectionIdsByClass.set(cid, 'all')
    } else if (existing !== 'all') {
      const set = existing instanceof Set ? existing : new Set()
      set.add(sid)
      mySectionIdsByClass.set(cid, set)
    }
  })

  myClasses.forEach(cls => {
    const cid = idOf(cls._id)
    const isClassTeacher = idOf(cls.classTeacher) === userId
    const hasSubjectTeacher = (cls.subjects || []).some(s => idOf(s.teacher) === userId)
    if (userId && (isClassTeacher || hasSubjectTeacher)) {
      mySectionIdsByClass.set(cid, 'all')
    }
    ;(cls.sections || []).forEach(sec => {
      if (userId && idOf(sec.sectionTeacher) === userId) {
        const existing = mySectionIdsByClass.get(cid)
        if (existing !== 'all') {
          const set = existing instanceof Set ? existing : new Set()
          set.add(idOf(sec._id))
          mySectionIdsByClass.set(cid, set)
        }
      }
    })
  })

  const isSectionMine = (cid, sec) => {
    const entry = mySectionIdsByClass.get(cid)
    if (entry === 'all') return true
    if (entry instanceof Set) return entry.has(idOf(sec._id))
    // No specific section info — fall back to showing all sections of this class.
    return true
  }

  const mySubjectIds = new Set(
    myAssignments.map(a => idOf(a.subjectId)).filter(Boolean)
  )
  myClasses.forEach(cls => {
    ;(cls.subjects || []).forEach(s => {
      if (userId && idOf(s.teacher) === userId) {
        const subjId = idOf(s.subject) || idOf(s)
        if (subjId) mySubjectIds.add(subjId)
      } else if (s && !s.teacher && s._id) {
        // my-classes endpoint returns flattened subjects (no teacher field) — these are subjects assigned to the teacher's class
        mySubjectIds.add(idOf(s._id))
      }
    })
  })

  if (loadingSessions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Academics</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
          View academic structure, your assigned classes and subjects
        </p>
      </div>

      {/* Active Session Banner */}
      {activeSession ? (
        <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-[#1a3a35] dark:to-[#162e2a] border border-primary-200 dark:border-[#2a5a52] rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-600 rounded-xl flex-shrink-0">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-900 dark:text-primary-300">Active Academic Session</p>
                <p className="text-base sm:text-lg font-bold text-primary-700 dark:text-white">{activeSession.name}</p>
              </div>
            </div>
            <div className="text-left sm:text-right ml-12 sm:ml-0">
              <p className="text-xs text-primary-600 dark:text-primary-400">
                {formatDate(activeSession.startDate)} — {formatDate(activeSession.endDate)}
              </p>
              {activeSession.isLocked && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-yellow-100 dark:bg-[#332d1a] text-yellow-800 dark:text-yellow-400 text-xs rounded-lg">
                  <Lock className="h-3 w-3" />
                  Locked
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-[#332d1a] border border-amber-200 dark:border-[#5a4a2a] rounded-2xl p-4 text-center">
          <p className="text-sm text-amber-700 dark:text-amber-400">No active academic session. Please contact admin.</p>
        </div>
      )}

      {/* My Assignment Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4 sm:p-5 text-center">
          <Users className="h-6 w-6 text-primary-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{myClasses.length}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">My Classes</p>
        </div>
        <div className="card p-4 sm:p-5 text-center">
          <BookOpen className="h-6 w-6 text-secondary-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{mySubjectIds.size}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">My Subjects</p>
        </div>
        <div className="card p-4 sm:p-5 text-center col-span-2 sm:col-span-1">
          <Star className="h-6 w-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{myAssignments.length}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Total Assignments</p>
        </div>
      </div>

      {/* My Assigned Classes & Subjects */}
      {myAssignments.length > 0 && (
        <div className="card">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">My Teaching Assignments</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-3">
              {myAssignments.map((assignment) => (
                <div
                  key={assignment._id}
                  className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-[#1a3a35] border border-primary-200 dark:border-[#2a5a52] rounded-xl"
                >
                  <div className="p-2 bg-primary-100 dark:bg-[#2a5a52] rounded-lg flex-shrink-0">
                    <BookOpen className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {assignment.subjectId?.name || 'Subject'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-[#8E8E93]">
                      Class {assignment.classId?.grade || ''} {assignment.sectionId?.name ? `- Section ${assignment.sectionId.name}` : ''}
                    </p>
                  </div>
                  {assignment.isPrimary && (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-amber-100 text-amber-700 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A]">
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* My Classes (filtered to teacher's assignments only) */}
      <div className="card">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">My Classes</h2>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Classes and sections assigned to you</p>
        </div>
        <div className="p-4 sm:p-6">
          {(() => {
            if (myClasses.length === 0) {
              return (
                <div className="text-center py-8">
                  <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-[#8E8E93]">You have not been assigned to any classes yet</p>
                </div>
              )
            }

            const grouped = myClasses.reduce((acc, cls) => {
              const g = cls.grade || 'Unknown'
              if (!acc[g]) acc[g] = []
              acc[g].push(cls)
              return acc
            }, {})
            const sortedGrades = Object.keys(grouped).sort((a, b) => (gradeOrder[a] ?? 99) - (gradeOrder[b] ?? 99))

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedGrades.map(grade => {
                  const gradeClasses = grouped[grade]
                  const mySectionsInGrade = gradeClasses.flatMap(cls => {
                    const cid = idOf(cls._id)
                    return (cls.sections || []).filter(sec => isSectionMine(cid, sec))
                  })
                  const totalStudents = mySectionsInGrade.reduce((sum, sec) => sum + (sec.studentCount || 0), 0)

                  return (
                    <div
                      key={grade}
                      className="border rounded-2xl p-4 border-primary-300 dark:border-[#2a5a52] bg-primary-50/50 dark:bg-[#1a3a35]/50 ring-1 ring-primary-200 dark:ring-[#2a5a52]"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{formatGrade(grade)}</h3>
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-primary-100 text-primary-700 dark:bg-[rgba(62,196,177,0.12)] dark:text-[#3EC4B1]">
                              MY CLASS
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{gradeClasses[0]?.academicYear || ''}</p>
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm mb-3">
                        <span className="text-gray-500 dark:text-[#8E8E93]"><strong className="text-gray-800 dark:text-white">{totalStudents}</strong> Students</span>
                        <span className="text-gray-500 dark:text-[#8E8E93]"><strong className="text-gray-800 dark:text-white">{mySectionsInGrade.length}</strong> Sections</span>
                      </div>
                      {mySectionsInGrade.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Sections</p>
                          {mySectionsInGrade.map(section => (
                            <div key={section._id} className="flex items-center justify-between bg-gray-50 dark:bg-[#2C2C2E] rounded px-2.5 py-1.5">
                              <div>
                                <span className="text-sm font-medium text-gray-800 dark:text-white uppercase">{section.name}</span>
                                {(section.sectionTeacher?.fullName || section.sectionTeacher?.name || section.sectionTeacherName) && (
                                  <p className="text-xs text-gray-400 dark:text-[#636366]">
                                    {section.sectionTeacher?.fullName || section.sectionTeacher?.name || section.sectionTeacherName}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] tabular-nums">
                                {section.studentCount ?? 0}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

      {/* All Subjects (read-only, teacher's highlighted) */}
      <div className="card">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">School Subjects</h2>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Your assigned subjects are highlighted</p>
        </div>
        <div className="p-4 sm:p-6">
          {subjects.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No subjects found</p>
            </div>
          ) : (() => {
            const typeGroups = { 'Theory': [], 'Practical': [], 'Both': [] }
            subjects.forEach(s => {
              const t = s.type || 'Theory'
              if (!typeGroups[t]) typeGroups[t] = []
              typeGroups[t].push(s)
            })
            const typeIcons = { 'Theory': '📖', 'Practical': '🔬', 'Both': '📚' }
            const activeTypes = Object.keys(typeGroups).filter(t => typeGroups[t].length > 0)

            return (
              <div className="space-y-6">
                {activeTypes.map(type => (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">{typeIcons[type]}</span>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] uppercase tracking-wide">{type}</h3>
                      <span className="text-xs text-gray-400 dark:text-[#636366]">({typeGroups[type].length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {typeGroups[type].filter(s => s.isActive).map(subject => {
                        const isMine = mySubjectIds.has(subject._id)
                        return (
                          <div
                            key={subject._id}
                            className={`border rounded-2xl p-4 transition-all ${
                              isMine
                                ? 'border-primary-300 dark:border-[#2a5a52] bg-primary-50 dark:bg-[#1a3a35] ring-1 ring-primary-200 dark:ring-[#2a5a52]'
                                : 'border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">{subject.name}</h4>
                                  {isMine && (
                                    <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" fill="currentColor" />
                                  )}
                                </div>
                                <span className="font-mono text-xs text-gray-500 dark:text-[#8E8E93]">{subject.subjectCode}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-[#8E8E93]">
                              <span>Max: <strong className="text-gray-800 dark:text-white">{subject.maxMarks || 100}</strong></span>
                              <span className="text-gray-300 dark:text-[#636366]">|</span>
                              <span>Pass: <strong className="text-gray-800 dark:text-white">{subject.passingMarks || 33}</strong></span>
                            </div>
                            {isMine && (
                              <p className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold mt-2 uppercase">Assigned to you</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Academic Sessions List (read-only) */}
      <div className="card">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Academic Sessions</h2>
        </div>
        <div className="p-4 sm:p-6">
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No academic sessions found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session._id}
                  className={`border rounded-2xl p-4 ${
                    session.isActive
                      ? 'border-primary-300 dark:border-[#2a5a52] bg-primary-50 dark:bg-[#1a3a35]'
                      : 'border-gray-200 dark:border-[#38383A] dark:bg-[#2C2C2E]'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{session.name}</h3>
                    {session.isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158] dark:ring-0 text-xs font-semibold rounded-lg">
                        Active
                      </span>
                    )}
                    {session.isLocked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A] dark:ring-0 text-xs font-semibold rounded-lg">
                        <Lock className="h-3 w-3" />
                        Locked
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-1">
                    {formatDate(session.startDate)} — {formatDate(session.endDate)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TeacherAcademics
