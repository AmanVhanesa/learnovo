import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, CheckCircle, XCircle, X, AlertTriangle } from 'lucide-react'
import { admissionsService } from '../services/admissionsService'

const Admissions = () => {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    student: '',
    personalInfo: { firstName: '', lastName: '', dateOfBirth: '', gender: 'male' },
    contactInfo: { email: '', phone: '', address: { street: '', city: '', state: '', pincode: '', country: 'India' } },
    academicInfo: { classApplied: '' },
    documents: { photo: 'placeholder.jpg', birthCertificate: 'placeholder.pdf' }
  })

  const { data: admissions = [], isLoading, error } = useQuery({
    queryKey: ['admissions', statusFilter],
    queryFn: async () => {
      const { data } = await admissionsService.list({ status: statusFilter, limit: 100 })
      return data || []
    },
  })

  const createMutation = useMutation({
    mutationFn: (formData) => admissionsService.create(formData),
    onSuccess: () => {
      setShowModal(false)
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
    },
    onError: (err) => {
      console.error('Create admission error:', err)
      alert(err?.response?.data?.message || 'Failed to submit admission')
    }
  })

  const approveMutation = useMutation({
    mutationFn: (ad) => admissionsService.approve(ad._id || ad.id, { comments: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admissions'] }),
    onError: (err) => alert(err?.response?.data?.message || 'Approve failed')
  })

  const rejectMutation = useMutation({
    mutationFn: ({ ad, reason }) => admissionsService.reject(ad._id || ad.id, { reason, comments: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admissions'] }),
    onError: (err) => alert(err?.response?.data?.message || 'Reject failed')
  })

  const openNew = () => {
    setForm({
      student: '',
      personalInfo: { firstName: '', lastName: '', dateOfBirth: '', gender: 'male' },
      contactInfo: { email: '', phone: '', address: { street: '', city: '', state: '', pincode: '', country: 'India' } },
      academicInfo: { classApplied: '' },
      documents: { photo: 'placeholder.jpg', birthCertificate: 'placeholder.pdf' }
    })
    setShowModal(true)
  }

  const createAdmission = (e) => {
    e.preventDefault()
    createMutation.mutate(form)
  }

  const approve = (ad) => approveMutation.mutate(ad)

  const reject = (ad) => {
    const reason = prompt('Reason for rejection?')
    if (!reason) return
    rejectMutation.mutate({ ad, reason })
  }

  const errorMessage = error?.response?.data?.message || (error ? 'Failed to load admissions. Please check your connection and try again.' : null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Admission Management</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="waitlisted">Waitlisted</option>
          </select>
          <button className="btn btn-primary w-full sm:w-auto justify-center" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Admission
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admissions'] })}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto table-scroll">
        <table className="table min-w-[640px]">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Student Name</th>
              <th>Class</th>
              <th>Applied Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admissions.map((admission) => (
              <tr key={admission._id || admission.id}>
                <td className="text-sm font-medium text-gray-900 dark:text-white">{admission.applicationNumber}</td>
                <td className="text-sm text-gray-900 dark:text-white">{admission?.personalInfo ? `${admission.personalInfo.firstName} ${admission.personalInfo.lastName}` : ''}</td>
                <td className="text-sm text-gray-900 dark:text-white">{admission.academicInfo?.classApplied}</td>
                <td className="text-sm text-gray-900 dark:text-white">
                  {new Date(admission.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <span className={`status-badge status-${admission.status}`}>
                    {admission.status}
                  </span>
                </td>
                <td>
                  <div className="flex space-x-2">
                    <button className="btn-icon hover:text-blue-600">
                      <Eye className="h-4 w-4" />
                    </button>
                    {admission.status === 'pending' && (
                      <>
                        <button className="btn-icon hover:text-green-600" onClick={() => approve(admission)}>
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button className="btn-icon hover:text-red-600" onClick={() => reject(admission)}>
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* New Admission */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Admission</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="p-4 space-y-4" onSubmit={createAdmission}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input className="input" value={form.personalInfo.firstName} onChange={(e) => setForm({ ...form, personalInfo: { ...form.personalInfo, firstName: e.target.value } })} required />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input className="input" value={form.personalInfo.lastName} onChange={(e) => setForm({ ...form, personalInfo: { ...form.personalInfo, lastName: e.target.value } })} required />
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input type="date" className="input" value={form.personalInfo.dateOfBirth} onChange={(e) => setForm({ ...form, personalInfo: { ...form.personalInfo, dateOfBirth: e.target.value } })} required />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input" value={form.personalInfo.gender} onChange={(e) => setForm({ ...form, personalInfo: { ...form.personalInfo, gender: e.target.value } })}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Class Applied</label>
                  <input className="input" value={form.academicInfo.classApplied} onChange={(e) => setForm({ ...form, academicInfo: { ...form.academicInfo, classApplied: e.target.value } })} required />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.contactInfo.email} onChange={(e) => setForm({ ...form, contactInfo: { ...form.contactInfo, email: e.target.value } })} required />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Phone</label>
                  <input className="input" value={form.contactInfo.phone} onChange={(e) => setForm({ ...form, contactInfo: { ...form.contactInfo, phone: e.target.value } })} required />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full sm:w-auto">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admissions
