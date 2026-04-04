import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Search, Download, Award, Clock, User, Calendar, Eye } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { attendanceService } from '../../services/attendanceService'
import certificateService from '../../services/certificateService'
import toast from 'react-hot-toast'

const TeacherCertificates = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('generate')
  const [selectedType, setSelectedType] = useState('BONAFIDE')
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [purpose, setPurpose] = useState('')
  const [conduct, setConduct] = useState('Good')
  const [previewData, setPreviewData] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)

  // Fetch teacher's classes to get students
  const { data: myClasses = [] } = useQuery({
    queryKey: ['teacher-cert-classes'],
    queryFn: async () => {
      const res = await attendanceService.getTeacherClasses()
      return res?.data || []
    },
  })

  // Get students from teacher's classes for search
  const { data: allStudents = [] } = useQuery({
    queryKey: ['teacher-cert-students', myClasses.map(c => c._id).join(',')],
    queryFn: async () => {
      const studentPromises = myClasses.map(cls =>
        attendanceService.getStudentsByClass(cls._id).then(res => {
          const students = res?.data?.students || []
          return students.map(s => ({ ...s, className: cls.name || cls.grade }))
        }).catch(() => [])
      )
      const results = await Promise.all(studentPromises)
      return results.flat()
    },
    enabled: myClasses.length > 0,
  })

  // Certificate history (teacher's issued only)
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['teacher-cert-history'],
    queryFn: async () => {
      const res = await certificateService.getHistory()
      const certs = res?.data || []
      // Filter to only certificates issued by this teacher
      return certs.filter(c => {
        const issuerId = c.issuedBy?._id || c.issuedBy
        return issuerId === user._id || issuerId === user.id
      })
    },
  })
  const history = historyData || []

  // Filtered students based on search
  const filteredStudents = studentSearch.trim().length >= 2
    ? allStudents.filter(s => {
        const q = studentSearch.toLowerCase()
        return (s.name || s.fullName || '').toLowerCase().includes(q) ||
          (s.admissionNumber || '').toLowerCase().includes(q)
      }).slice(0, 10)
    : []

  const handleSelectStudent = (student) => {
    setSelectedStudent(student)
    setStudentSearch(student.name || student.fullName || '')
    setPreviewData(null)
  }

  const handlePreview = async () => {
    if (!selectedStudent) { toast.error('Select a student first'); return }
    try {
      setIsPreviewing(true)
      const res = await certificateService.previewCertificate(selectedStudent._id, selectedType)
      setPreviewData(res.data || res)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to preview certificate')
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedStudent || !previewData) { toast.error('Preview first'); return }
    try {
      setIsGenerating(true)
      const specificData = { purpose, conduct }
      const response = await certificateService.generateCertificate(
        selectedStudent._id, selectedType, specificData, false
      )
      // Trigger download
      const blob = response.data
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${selectedType}_${selectedStudent.name || 'certificate'}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('Certificate generated and downloaded!')
      queryClient.invalidateQueries({ queryKey: ['teacher-cert-history'] })
      // Reset form
      setSelectedStudent(null)
      setStudentSearch('')
      setPreviewData(null)
      setPurpose('')
      setConduct('Good')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to generate certificate'
      toast.error(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (cert) => {
    try {
      const filename = `${cert.type}_${cert.certificateNumber || 'certificate'}.pdf`
      await certificateService.downloadCertificate(cert._id, filename)
      toast.success('Certificate downloaded')
    } catch (err) {
      toast.error('Failed to download certificate')
    }
  }

  const tabs = [
    { id: 'generate', label: 'Generate Certificate', icon: Award },
    { id: 'history', label: 'Certificate History', icon: Clock },
  ]

  // Teacher can only generate BONAFIDE certificates
  const TEACHER_CERT_TYPES = [
    { value: 'BONAFIDE', label: 'Bonafide Certificate' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Certificates</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
          Generate bonafide certificates for your students
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4 sm:p-5 text-center">
          <FileText className="h-6 w-6 text-primary-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{history.length}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Total Issued</p>
        </div>
        <div className="card p-4 sm:p-5 text-center">
          <Award className="h-6 w-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {history.filter(c => c.type === 'BONAFIDE').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Bonafide</p>
        </div>
        <div className="card p-4 sm:p-5 text-center col-span-2 sm:col-span-1">
          <User className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{allStudents.length}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">My Students</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-[#38383A] overflow-x-auto overflow-y-hidden">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 whitespace-nowrap">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#38383A]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="space-y-4">
          <div className="card p-4 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Generate Certificate</h2>

            <div className="space-y-4">
              {/* Certificate Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  Certificate Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => { setSelectedType(e.target.value); setPreviewData(null) }}
                  className="w-full sm:w-64 px-3 py-2 input"
                >
                  {TEACHER_CERT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Student Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  Search Student <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value)
                      if (selectedStudent) { setSelectedStudent(null); setPreviewData(null) }
                    }}
                    placeholder="Search by name or admission number..."
                    className="w-full pl-10 pr-4 py-2 input"
                  />
                </div>
                {/* Dropdown */}
                {filteredStudents.length > 0 && !selectedStudent && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredStudents.map(s => (
                      <button
                        key={s._id}
                        onClick={() => handleSelectStudent(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name || s.fullName}</p>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                          {s.admissionNumber && `#${s.admissionNumber} · `}{s.className}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Student Info */}
              {selectedStudent && (
                <div className="bg-primary-50 dark:bg-[#1a3a35] border border-primary-200 dark:border-[#2a5a52] rounded-xl p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-[#8E8E93] text-xs">Name</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedStudent.name || selectedStudent.fullName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-[#8E8E93] text-xs">Class</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedStudent.className}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-[#8E8E93] text-xs">Admission No</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedStudent.admissionNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-[#8E8E93] text-xs">Roll Number</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedStudent.rollNumber || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Purpose Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  Purpose / Reason
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., For scholarship application"
                  className="w-full px-3 py-2 input"
                />
              </div>

              {/* Conduct Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  Student Conduct
                </label>
                <select
                  value={conduct}
                  onChange={(e) => setConduct(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 input"
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Satisfactory">Satisfactory</option>
                  <option value="Needs Improvement">Needs Improvement</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handlePreview}
                  disabled={!selectedStudent || isPreviewing}
                  className="btn btn-outline flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <Eye className="h-4 w-4" />
                  {isPreviewing ? 'Loading...' : 'Preview'}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!previewData || isGenerating}
                  className="btn btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <Download className="h-4 w-4" />
                  {isGenerating ? 'Generating...' : 'Generate & Download PDF'}
                </button>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          {previewData && (
            <div className="card p-4 sm:p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Certificate Preview</h3>
              <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-4 sm:p-6 space-y-3 text-sm">
                {Object.entries(previewData).map(([key, value]) => {
                  if (key === '_id' || key === '__v' || !value) return null
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
                  return (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <span className="text-gray-500 dark:text-[#8E8E93] w-40 flex-shrink-0 text-xs uppercase tracking-wide">{label}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyLoading ? (
            <div className="flex items-center justify-center h-48"><div className="loading-spinner" /></div>
          ) : history.length === 0 ? (
            <div className="card p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No certificates issued yet</p>
              <p className="text-sm text-gray-500 dark:text-[#636366] mt-1">Certificates you generate will appear here.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden dark:border dark:border-[#38383A]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Certificate</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-[#2C2C2E]">
                    {history.map(cert => (
                      <tr key={cert._id} className="hover:bg-primary-50 dark:hover:bg-[#2C2C2E]">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{cert.certificateNumber || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700 dark:text-white">{cert.student?.name || cert.student?.fullName || '-'}</p>
                          <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{cert.student?.admissionNumber || ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                            {cert.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">
                          {cert.issueDate ? new Date(cert.issueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDownload(cert)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-md hover:bg-primary-50 dark:hover:bg-primary-500/10"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TeacherCertificates
