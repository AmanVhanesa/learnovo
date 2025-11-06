import React, { useState, useEffect } from 'react'
import { Search as SearchIcon, Users, GraduationCap, CreditCard, BookOpen, User } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { studentsService } from '../services/studentsService'
import { teachersService } from '../services/teachersService'
import { feesService } from '../services/feesService'
import { assignmentsService } from '../services/assignmentsService'

const Search = () => {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ students: [], teachers: [], fees: [], assignments: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const navigate = useNavigate()

  // Load query from URL on mount
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
    }
  }, [searchParams])

  useEffect(() => {
    // Auto-search when query changes (debounced)
    const timeoutId = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query.trim())
      } else {
        setResults({ students: [], teachers: [], fees: [], assignments: [] })
        setHasSearched(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query])

  const performSearch = async (searchQuery) => {
    setIsLoading(true)
    setHasSearched(true)

    try {
      const [studentsRes, teachersRes, feesRes, assignmentsRes] = await Promise.allSettled([
        studentsService.list({ search: searchQuery, limit: 5 }),
        teachersService.list({ search: searchQuery, limit: 5 }),
        feesService.list({ limit: 5 }).catch(() => ({ data: [] })),
        assignmentsService.list({ limit: 5 }).catch(() => ({ data: [] }))
      ])

      // Extract data array from API responses
      const extractData = (response) => {
        if (response.status === 'fulfilled') {
          // Handle both { success: true, data: [...] } and { data: [...] } formats
          return response.value?.data || response.value || []
        }
        return []
      }

      setResults({
        students: extractData(studentsRes),
        teachers: extractData(teachersRes),
        fees: extractData(feesRes),
        assignments: extractData(assignmentsRes)
      })
    } catch (error) {
      console.error('Search error:', error)
      setResults({ students: [], teachers: [], fees: [], assignments: [] })
    } finally {
      setIsLoading(false)
    }
  }

  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Search Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
              placeholder="Search students, teachers, fees, assignments..."
              autoFocus
            />
          </div>
        </div>

        {query && (
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <span>{totalResults} results found</span>
            {isLoading && (
              <span className="text-primary-600">Searching...</span>
            )}
          </div>
        )}
      </div>

      {/* Search Results */}
      {hasSearched && totalResults === 0 && !isLoading && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <SearchIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-600">
            Try searching with different keywords or check your spelling
          </p>
        </div>
      )}

      {hasSearched && totalResults > 0 && (
        <div className="space-y-6">
          {/* Students Results */}
          {results.students.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Students ({results.students.length})</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {results.students.map((student) => (
                  <div
                    key={student._id || student.id}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate('/app/students')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.email}</p>
                          {student.class && <p className="text-xs text-gray-500">Class: {student.class}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Student
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
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Teachers ({results.teachers.length})</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {results.teachers.map((teacher) => (
                  <div
                    key={teacher._id || teacher.id}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate('/app/teachers')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                          <GraduationCap className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{teacher.name}</p>
                          <p className="text-xs text-gray-500">{teacher.email}</p>
                          {teacher.subjects && teacher.subjects.length > 0 && (
                            <p className="text-xs text-gray-500">Subjects: {teacher.subjects.slice(0, 3).join(', ')}</p>
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
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Fees ({results.fees.length})</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {results.fees.map((fee) => (
                  <div
                    key={fee._id || fee.id}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate('/app/fees')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{fee.description || 'Fee'}</p>
                        <p className="text-xs text-gray-500">{fee.student?.name || 'Student'}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {fee.currency} {fee.amount?.toLocaleString() || 0}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          fee.status === 'paid' ? 'bg-green-100 text-green-800' :
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
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900">Assignments ({results.assignments.length})</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {results.assignments.map((assignment) => (
                  <div
                    key={assignment._id || assignment.id}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate('/app/assignments')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{assignment.title}</p>
                        <p className="text-xs text-gray-500">{assignment.subject} - {assignment.class}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500">
                          Due: {new Date(assignment.dueDate).toLocaleDateString()}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          assignment.status === 'active' ? 'bg-green-100 text-green-800' :
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
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <SearchIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Start your search</h3>
          <p className="text-gray-600 mb-6">
            Search for students, teachers, fees, assignments, and more
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4" />
              <span>Students</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <GraduationCap className="h-4 w-4" />
              <span>Teachers</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <CreditCard className="h-4 w-4" />
              <span>Fees</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
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

