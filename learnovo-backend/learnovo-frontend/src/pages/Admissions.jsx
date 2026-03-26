import React, { useState, useEffect } from 'react'
import { Plus, Eye, CheckCircle, XCircle, X, AlertTriangle } from 'lucide-react'
import { admissionsService } from '../services/admissionsService'

const Admissions = () => {
  const [admissions, setAdmissions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    student: '',
    personalInfo: { firstName: '', lastName: '', dateOfBirth: '', gender: 'male' },
    contactInfo: { email: '', phone: '', address: { street: '', city: '', state: '', pincode: '', country: 'India' } },
    academicInfo: { classApplied: '' },
    documents: { photo: 'placeholder.jpg', birthCertificate: 'placeholder.pdf' }
  })

  useEffect(() => {
    fetchAdmissions()
  }, [])

  const fetchAdmissions = async () => {
    try {
      setIsLoading(true)
      setError(null) // Clear previous errors
      const { data } = await admissionsService.list({ status: statusFilter, limit: 100 })
      setAdmissions(data || [])
    } catch (error) {
      console.error('Error fetching admissions:', error)
      setError(error.response?.data?.message || 'Failed to load admissions. Please check your connection and try again.')
      setAdmissions([]) // Clear admissions on error
    } finally {
      setIsLoading(false)
    }
  }

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

  const createAdmission = async (e) => {
    e.preventDefault()
    try {
      await admissionsService.create(form)
      setShowModal(false)
      await fetchAdmissions()
    } catch (err) {
      console.error('Create admission error:', err)
      alert(err?.response?.data?.message || 'Failed to submit admission')
    }
  }

  const approve = async (ad) => {
    try {
      await admissionsService.approve(ad._id || ad.id, { comments: '' })
      await fetchAdmissions()
    } catch (err) {
      alert(err?.response?.data?.message || 'Approve failed')
    }
  }

  const reject = async (ad) => {
    const reason = prompt('Reason for rejection?')
    if (!reason) return
    try {
      await admissionsService.reject(ad._id || ad.id, { reason, comments: '' })
      await fetchAdmissions()
    } catch (err) {
      alert(err?.response?.data?.message || 'Reject failed')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Admission Management</h1>
        <div className="flex items-center gap-2">
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="waitlisted">Waitlisted</option>
          </select>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Admission
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={() => fetchAdmissions()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="table">
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
                <td className="text-sm font-medium text-gray-900">{admission.applicationNumber}</td>
                <td className="text-sm text-gray-900">{admission?.personalInfo ? `${admission.personalInfo.firstName} ${admission.personalInfo.lastName}` : ''}</td>
                <td className="text-sm text-gray-900">{admission.academicInfo?.classApplied}</td>
                <td className="text-sm text-gray-900">
                  {new Date(admission.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <span className={`status-badge status-${admission.status}`}>
                    {admission.status}
                  </span>
                </td>
                <td>
                  <div className="flex space-x-2">
                    <button className="p-1 text-gray-400 hover:text-blue-600">
                      <Eye className="h-4 w-4" />
                    </button>
                    {admission.status === 'pending' && (
                      <>
                        <button className="p-1 text-gray-400 hover:text-green-600" onClick={() => approve(admission)}>
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-red-600" onClick={() => reject(admission)}>
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

      {/* New Admission */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-4">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900">New Admission</h3>
              <button className="p-2 rounded-md hover:bg-gray-100" onClick={() => setShowModal(false)}>
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
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admissions
