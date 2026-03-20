import React, { useRef, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { Save, Camera, Loader, User, BookOpen, Briefcase, Heart, ShieldCheck, CheckCircle } from 'lucide-react'
import api from '../services/authService'
import toast from 'react-hot-toast'

import { SERVER_URL } from '../constants/config'

const Profile = () => {
  const { user, uploadPhoto: uploadPhotoFn } = useAuth()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    religion: '',
    category: '',
    fatherOrHusbandName: '',
    homeAddress: '',
    nationalId: '',
    education: '',
    experience: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Initialize form with user data
  React.useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.fullName || user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
        gender: user.gender || '',
        bloodGroup: user.bloodGroup || '',
        religion: user.religion || '',
        category: user.category || '',
        fatherOrHusbandName: user.fatherOrHusbandName || '',
        homeAddress: user.homeAddress || '',
        nationalId: user.nationalId || '',
        education: user.education || '',
        experience: user.experience || ''
      }))
    }
  }, [user])

  const isStudent = user?.role === 'student'
  const isTeacher = user?.role === 'teacher'
  const isEmployee = user?.role === 'teacher' || user?.role === 'staff' || user?.role === 'employee'

  const [passwordError, setPasswordError] = React.useState('')

  const profileCompletion = useMemo(() => {
    if (!isStudent || !user) return { percentage: 0, missingFields: [] }
    const fields = [
      { key: 'name', label: 'Full Name', value: user.fullName || user.name },
      { key: 'email', label: 'Email', value: user.email },
      { key: 'phone', label: 'Phone', value: formData.phone || user.phone },
      { key: 'dateOfBirth', label: 'Date of Birth', value: formData.dateOfBirth || user.dateOfBirth },
      { key: 'gender', label: 'Gender', value: formData.gender || user.gender },
      { key: 'bloodGroup', label: 'Blood Group', value: formData.bloodGroup || user.bloodGroup },
      { key: 'address', label: 'Address', value: formData.address || user.address },
      { key: 'avatar', label: 'Profile Photo', value: user.avatar || user.photo }
    ]
    const filled = fields.filter(f => f.value && String(f.value).trim() !== '')
    const missing = fields.filter(f => !f.value || String(f.value).trim() === '').map(f => f.label)
    const percentage = Math.round((filled.length / fields.length) * 100)
    return { percentage, missingFields: missing }
  }, [isStudent, user, formData.phone, formData.dateOfBirth, formData.gender, formData.bloodGroup, formData.address])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // Resolve avatar URL (supports Cloudinary full URLs and legacy relative paths)
  const avatarUrl = (() => {
    const raw = user?.avatar || user?.photo
    if (!raw) return null
    return raw.startsWith('http') ? raw : `${SERVER_URL}${raw}`
  })()

  const displayName = user?.fullName || user?.name || ''
  const initials = displayName.charAt(0)?.toUpperCase() || '?'

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type and size
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, etc.)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB')
      return
    }

    setUploading(true)
    await uploadPhotoFn(file)
    setUploading(false)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const profileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        religion: formData.religion || undefined,
        category: formData.category || undefined,
        fatherOrHusbandName: formData.fatherOrHusbandName || undefined,
        homeAddress: formData.homeAddress || undefined
      }

      // Include employee-specific fields
      if (isEmployee) {
        payload.nationalId = formData.nationalId || undefined
        payload.education = formData.education || undefined
        payload.experience = formData.experience || undefined
      }

      const response = await api.put('/auth/profile', payload)
      return response.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Profile updated successfully')
        // Update user in auth context
        if (data.user) {
          const updatedUser = { ...user, ...data.user }
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      } else {
        toast.error(data.message || 'Failed to update profile')
      }
    },
    onError: (error) => {
      const errData = error.response?.data
      if (errData?.errors?.length) {
        errData.errors.forEach(e => toast.error(e.msg || e.message || e))
      } else {
        toast.error(errData?.message || 'An error occurred. Please try again.')
      }
    }
  })

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (formData.newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }
      if (formData.newPassword !== formData.confirmPassword) {
        throw new Error('New passwords do not match')
      }
      const response = await api.put('/auth/password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      })
      return response.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Password updated successfully')
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))
      } else {
        toast.error(data.message || 'Failed to update password')
      }
    },
    onError: (error) => {
      if (error.message === 'Password must be at least 6 characters') {
        setPasswordError(error.message)
        toast.error(error.message)
        return
      }
      if (error.message === 'New passwords do not match') {
        toast.error('New passwords do not match')
        return
      }
      const errData = error.response?.data
      if (errData?.errors?.length) {
        errData.errors.forEach(e => toast.error(e.msg || e.message || e))
      } else {
        toast.error(errData?.message || 'An error occurred. Please try again.')
      }
    }
  })

  const loading = profileMutation.isPending || passwordMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
      </div>

      {/* Profile Completion Indicator - Students only */}
      {isStudent && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Profile Completion</h3>
              {profileCompletion.percentage === 100 && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
            <span className="text-sm font-bold text-primary-600">{profileCompletion.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-[#2C2C2E] rounded-full h-2">
            <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${profileCompletion.percentage}%` }} />
          </div>
          {profileCompletion.missingFields.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-2">
              Missing: {profileCompletion.missingFields.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Profile Photo Card */}
      <div className="card p-4 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Profile Photo</h3>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* Avatar */}
          <div className="relative group">
            <ProfileAvatar avatarUrl={avatarUrl} initials={initials} name={user?.name} />
            {/* Overlay on hover */}
            <button
              onClick={handlePhotoClick}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Change photo"
            >
              {uploading
                ? <Loader className="h-6 w-6 text-white animate-spin" />
                : <Camera className="h-6 w-6 text-white" />
              }
            </button>
          </div>

          {/* Info + button */}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</p>
            <p className="text-sm text-gray-500 dark:text-[#8E8E93] capitalize">{user?.role}</p>
            {isStudent && user?.admissionNumber && (
              <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mt-0.5">
                Admission No: {user.admissionNumber}
              </p>
            )}
            {isEmployee && user?.employeeId && (
              <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mt-0.5">
                Employee ID: {user.employeeId}
              </p>
            )}
            <button
              onClick={handlePhotoClick}
              disabled={uploading}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
            >
              {uploading
                ? <><Loader className="h-4 w-4 animate-spin" /> Uploading...</>
                : <><Camera className="h-4 w-4" /> Change Photo</>
              }
            </button>
            <p className="text-xs text-gray-400 mt-1.5">JPG, PNG up to 2MB. Face will be auto-cropped.</p>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </div>

      {/* Identity Card - Read-only info */}
      {(isStudent || isEmployee) && (
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {isStudent ? 'Academic Information' : 'Employment Information'}
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-4">
            These details are managed by the school administration and cannot be edited.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isStudent && (
              <>
                <ReadOnlyField label="Admission Number" value={user?.admissionNumber} />
                <ReadOnlyField label="Roll Number" value={user?.rollNumber} />
                <ReadOnlyField label="Class" value={user?.class} />
                <ReadOnlyField label="Section" value={user?.section} />
                <ReadOnlyField label="PEN Number" value={user?.penNumber} />
                <ReadOnlyField
                  label="Admission Date"
                  value={user?.admissionDate ? new Date(user.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null}
                />
              </>
            )}
            {isEmployee && (
              <>
                <ReadOnlyField label="Employee ID" value={user?.employeeId} />
                <ReadOnlyField label="Designation" value={user?.designation} />
                <ReadOnlyField label="Department" value={user?.department} />
                <ReadOnlyField
                  label="Date of Joining"
                  value={user?.dateOfJoining ? new Date(user.dateOfJoining).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null}
                />
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Personal Information</h3>
            </div>
            <button
              className="btn btn-primary btn-sm w-full sm:w-auto"
              onClick={() => profileMutation.mutate()}
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Info
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                name="name"
                className={isStudent ? "input bg-gray-50 dark:bg-[#000000]" : "input"}
                value={formData.name}
                onChange={handleChange}
                disabled={isStudent}
                title={isStudent ? "Name can only be changed by administration" : undefined}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                name="email"
                className="input bg-gray-50 dark:bg-[#000000]"
                value={formData.email}
                disabled
                title="Email cannot be changed directly"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                type="tel"
                name="phone"
                className="input"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Father / Husband Name</label>
              <input
                type="text"
                name="fatherOrHusbandName"
                className="input"
                value={formData.fatherOrHusbandName}
                onChange={handleChange}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  className={isStudent ? "input bg-gray-50 dark:bg-[#000000]" : "input"}
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  disabled={isStudent}
                  title={isStudent ? "Date of birth can only be changed by administration" : undefined}
                />
              </div>
              <div>
                <label className="label">Gender</label>
                <select
                  name="gender"
                  className="input"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Blood Group</label>
                <select
                  name="bloodGroup"
                  className="input"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="label">Religion</label>
                <input
                  type="text"
                  name="religion"
                  className="input"
                  value={formData.religion}
                  onChange={handleChange}
                />
              </div>
            </div>
            {isStudent && (
              <div>
                <label className="label">Category</label>
                <select
                  name="category"
                  className="input"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="">Select Category</option>
                  <option value="General">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="EWS">EWS</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}
            <div>
              <label className="label">Address</label>
              <textarea
                name="address"
                className="input min-h-[80px]"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <input type="text" className="input bg-gray-50 dark:bg-[#000000]" value={user?.role} disabled />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Employee-specific: Professional & Additional Info */}
          {isEmployee && (
            <div className="card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Additional Information</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">National ID / Aadhaar</label>
                  <input
                    type="text"
                    name="nationalId"
                    className="input"
                    value={formData.nationalId}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="label">Education / Qualifications</label>
                  <input
                    type="text"
                    name="education"
                    className="input"
                    value={formData.education}
                    onChange={handleChange}
                    placeholder="e.g. B.Ed, M.Sc"
                  />
                </div>
                <div>
                  <label className="label">Experience</label>
                  <input
                    type="text"
                    name="experience"
                    className="input"
                    value={formData.experience}
                    onChange={handleChange}
                    placeholder="e.g. 5 years"
                  />
                </div>
                <div>
                  <label className="label">Home Address</label>
                  <textarea
                    name="homeAddress"
                    className="input min-h-[80px]"
                    value={formData.homeAddress}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Guardian Information - Read only for students */}
          {isStudent && user?.guardians && user.guardians.length > 0 && (
            <div className="card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Guardian Information</h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-4">
                Guardian details are managed by the school administration.
              </p>
              <div className="space-y-4">
                {user.guardians.map((guardian, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <ReadOnlyField label="Name" value={guardian.name} compact />
                      <ReadOnlyField label="Relation" value={guardian.relation} compact />
                      <ReadOnlyField label="Phone" value={guardian.phone} compact />
                      <ReadOnlyField label="Email" value={guardian.email} compact />
                      {guardian.occupation && (
                        <ReadOnlyField label="Occupation" value={guardian.occupation} compact />
                      )}
                      {guardian.isPrimary && (
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Primary Guardian
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Change Password */}
          <div className="card p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Change Password</h3>
              <button
                className="btn btn-primary btn-sm w-full sm:w-auto"
                onClick={() => passwordMutation.mutate()}
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" />
                Update Password
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  className="input"
                  value={formData.currentPassword}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  className={`input ${passwordError ? 'border-red-500 dark:border-red-500' : ''}`}
                  value={formData.newPassword}
                  onChange={(e) => { handleChange(e); setPasswordError('') }}
                  minLength={6}
                />
                {passwordError && (
                  <p className="text-xs text-red-500 mt-1">{passwordError}</p>
                )}
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="input"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ReadOnlyField = ({ label, value, compact = false }) => (
  <div>
    <label className={`block text-xs font-medium text-gray-500 dark:text-[#8E8E93] ${compact ? 'mb-0.5' : 'mb-1'}`}>
      {label}
    </label>
    <p className={`${compact ? 'text-sm' : 'text-sm px-3 py-2 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg'} font-medium text-gray-900 dark:text-white`}>
      {value || '—'}
    </p>
  </div>
)

const ProfileAvatar = ({ avatarUrl, initials, name }) => {
  const [imgFailed, setImgFailed] = React.useState(false)
  return (
    <div className="h-24 w-24 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0 ring-4 ring-gray-100 dark:ring-[#38383A]">
      {avatarUrl && !imgFailed ? (
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
      ) : (
        <span className="text-2xl font-bold text-white flex items-center justify-center">{initials}</span>
      )}
    </div>
  )
}

export default Profile
