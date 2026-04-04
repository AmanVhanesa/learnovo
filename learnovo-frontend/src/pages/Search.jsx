import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, Users, GraduationCap, CreditCard, BookOpen, User, ArrowLeft } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { studentsService } from '../services/studentsService'
import { teachersService } from '../services/teachersService'
import { feesService } from '../services/feesService'
import { assignmentsService } from '../services/assignmentsService'
import { sortStudentsByRelevance, sortByRelevance, getMatchedField } from '../utils/searchRelevance'
import { formatDate } from '../utils/formatDate'

const Search = () => {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const navigate = useNavigate()

  // Load query from URL on mount
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      setDebouncedQuery(q)
    }
  }, [searchParams])

  // Debounce the query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length >= 2) {
        setDebouncedQuery(query.trim())
      } else {
        setDebouncedQuery('')
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [query])

  const { data: results = { students: [], teachers: [], fees: [], assignments: [] }, isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      const [studentsRes, teachersRes, feesRes, assignmentsRes] = await Promise.allSettled([
        studentsService.list({ search: debouncedQuery, limit: 10 }),
        teachersService.list({ search: debouncedQuery, limit: 10 }),
        feesService.list({ limit: 10 }).catch(() => ({ data: [] })),
        assignmentsService.list({ limit: 10 }).catch(() => ({ data: [] }))
      ])

      const extractData = (response) => {
        if (response.status === 'fulfilled') {
          const val = response.value
          if (Array.isArray(val?.data)) return val.data
          if (Array.isArray(val)) return val
          return []
        }
        return []
      }

      return {
        students: sortStudentsByRelevance(extractData(studentsRes), debouncedQuery),
        teachers: sortByRelevance(extractData(teachersRes), debouncedQuery, [
          { key: 'name', weight: 1 },
          { key: 'fullName', weight: 1 },
          { key: 'email', weight: 0.5 },
          { key: 'employeeId', weight: 0.8 }
        ]),
        fees: extractData(feesRes),
        assignments: sortByRelevance(extractData(assignmentsRes), debouncedQuery, [
          { key: 'title', weight: 1 },
          { key: 'subject', weight: 0.7 }
        ])
      }
    },
    enabled: debouncedQuery.length >= 2,
  })

  const hasSearched = debouncedQuery.length >= 2
  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Back</span>
      </button>

      {/* Search Header */}
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-[#38383A] rounded-lg leading-5 bg-white dark:bg-[#1C1C1E] dark:text-white placeholder-gray-500 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
              placeholder="Search students, teachers, fees, assignments..."
              autoFocus
            />
          </div>
        </div>

        {query && (
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600 dark:text-[#8E8E93]">
            <span>{totalResults} results found</span>
            {isLoading && (
              <span className="text-primary-600">Searching...</span>
            )}
          </div>
        )}
      </div>

      {/* Search Results */}
      {hasSearched && totalResults === 0 && !isLoading && (
        <div className="card p-12 text-center">
          <SearchIcon className="h-16 w-16 text-gray-300 dark:text-[#636366] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No results found</h3>
          <p className="text-gray-600 dark:text-[#8E8E93]">
            Try searching with different keywords or check your spelling
          </p>
        </div>
      )}

      {hasSearched && totalResults > 0 && (
        <div className="space-y-6">
          {/* Students Results */}
          {results.students.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-200 dark:border-[#38383A] flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Students ({results.students.length})</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-[#38383A]">
                {results.students.map((student) => (
                  <div
                    key={student._id || student.id}
                    className="px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors"
                    onClick={() => navigate(`/app/students/${student._id || student.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">
                            {(student.fullName || student.name || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{student.fullName || student.name || 'Unknown'}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#8E8E93] flex-wrap">
                            {student.admissionNumber && <span className="font-mono font-semibold text-teal-600">#{student.admissionNumber}</span>}
                            {student.class && <span>Class {student.class}{student.section ? `-${student.section}` : ''}</span>}
                            {student.rollNumber && <span>Roll: {student.rollNumber}</span>}
                            {(() => {
                              const match = getMatchedField(student, debouncedQuery)
                              return match && match.label !== 'Name' && match.value !== String(student.admissionNumber)
                                ? <span className="text-amber-600 dark:text-amber-400">· Matched {match.label}: {match.value}</span>
                                : null
                            })()}
                          </div>
                          {student.guardians?.[0]?.name && (
                            <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">{student.guardians[0].name}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${student.isActive !== false ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                          {student.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teachers Results */}
          {results.teachers.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-200 dark:border-[#38383A] flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-green-600" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Teachers ({results.teachers.length})</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-[#38383A]">
                {results.teachers.map((teacher) => (
                  <div
                    key={teacher._id || teacher.id}
                    className="px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors"
                    onClick={() => navigate('/app/teachers')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-green-600">
                            {(teacher.name || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{teacher.name || teacher.fullName}</p>
                          {teacher.email && <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{teacher.email}</p>}
                          {teacher.subjects && teacher.subjects.length > 0 && (
                            <p className="text-xs text-gray-400 dark:text-[#636366]">Subjects: {teacher.subjects.slice(0, 3).join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Teacher
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fees Results */}
          {results.fees.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-200 dark:border-[#38383A] flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-purple-600" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Fees ({results.fees.length})</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-[#38383A]">
                {results.fees.map((fee) => (
                  <div
                    key={fee._id || fee.id}
                    className="px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors"
                    onClick={() => navigate('/app/fees')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{fee.description || 'Fee'}</p>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{fee.student?.name || 'Student'}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {fee.currency} {fee.amount?.toLocaleString() || 0}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${fee.status === 'paid' ? 'bg-green-100 text-green-800' :
                          fee.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                          {fee.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignments Results */}
          {results.assignments.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-200 dark:border-[#38383A] flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-orange-600" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Assignments ({results.assignments.length})</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-[#38383A]">
                {results.assignments.map((assignment) => (
                  <div
                    key={assignment._id || assignment.id}
                    className="px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors"
                    onClick={() => navigate('/app/assignments')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{assignment.title}</p>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{assignment.subject} - {assignment.class}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                          Due: {formatDate(assignment.dueDate)}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${assignment.status === 'active' ? 'bg-green-100 text-green-800' :
                          assignment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                          {assignment.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!hasSearched && !query && (
        <div className="card p-12 text-center">
          <SearchIcon className="h-16 w-16 text-gray-300 dark:text-[#636366] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Start your search</h3>
          <p className="text-gray-600 dark:text-[#8E8E93] mb-6">
            Search for students, teachers, fees, assignments, and more
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-[#8E8E93]">
              <Users className="h-4 w-4" />
              <span>Students</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-[#8E8E93]">
              <GraduationCap className="h-4 w-4" />
              <span>Teachers</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-[#8E8E93]">
              <CreditCard className="h-4 w-4" />
              <span>Fees</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-[#8E8E93]">
              <BookOpen className="h-4 w-4" />
              <span>Assignments</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Search
