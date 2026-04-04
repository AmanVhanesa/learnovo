import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2, X, User } from 'lucide-react'
import { studentsService } from '../../services/studentsService'
import { sortStudentsByRelevance, getMatchedField } from '../../utils/searchRelevance'

const StudentSearch = ({ onSelectStudent, placeholder = 'Search by name, admission number, phone...' }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (searchTerm.trim().length < 2) {
      setSearchResults([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await studentsService.list({ search: searchTerm.trim(), limit: 20 })
        const sorted = sortStudentsByRelevance(res.data || [], searchTerm.trim())
        setSearchResults(sorted)
        setIsOpen(sorted.length > 0)
      } catch (error) {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [searchTerm])

  const handleSelect = useCallback((student) => {
    onSelectStudent(student)
    setSearchResults([])
    setSearchTerm('')
    setIsOpen(false)
  }, [onSelectStudent])

  const handleClear = () => {
    setSearchTerm('')
    setSearchResults([])
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => { if (searchResults.length > 0) setIsOpen(true) }}
          className="input pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-primary-500" />
        )}
        {!isSearching && searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-full"
          >
            <X className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
          </button>
        )}
      </div>

      {isOpen && searchResults.length > 0 && (
        <div className="absolute z-20 w-full mt-1.5 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg max-h-72 overflow-y-auto ring-1 ring-white dark:ring-[#1C1C1E]">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-[#38383A]">
            <span className="text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wide">
              {searchResults.length} student{searchResults.length !== 1 ? 's' : ''} found
            </span>
          </div>
          {searchResults.map((student) => (
            <button
              key={student._id}
              onClick={() => handleSelect(student)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] border-b border-gray-50 dark:border-[#2C2C2E] last:border-0 flex items-center gap-3 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                {student.photo ? (
                  <img src={student.photo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <span className="text-xs font-bold text-primary-700 dark:text-primary-400">
                    {(student.fullName || student.name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {student.fullName || student.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93] truncate">
                  {student.admissionNumber || student.studentId || 'N/A'} &middot; {student.classId?.name || student.class || 'N/A'}
                  {(() => {
                    const match = getMatchedField(student, searchTerm.trim())
                    return match && match.label !== 'Name' && match.value !== String(student.admissionNumber)
                      ? <span className="ml-1 text-amber-600 dark:text-amber-400"> · Matched {match.label}: {match.value}</span>
                      : null
                  })()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && searchTerm.length >= 2 && !isSearching && searchResults.length === 0 && (
        <div className="absolute z-20 w-full mt-1.5 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg p-6 text-center">
          <User className="h-8 w-8 text-gray-300 dark:text-[#636366] mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No students found</p>
          <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">Try a different search term</p>
        </div>
      )}
    </div>
  )
}

export default StudentSearch
