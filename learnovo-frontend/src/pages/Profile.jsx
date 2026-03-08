import React, { useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Save, Camera, Loader } from 'lucide-react'
import api from '../services/authService'
import toast from 'react-hot-toast'

const SERVER_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/api\/?$/, '')

const Profile = () => {
  const { user, uploadPhoto: uploadPhotoFn } = useAuth()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    address: '',
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
        address: user.address || ''
      }))
    }
  }, [user])

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
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB')
      return
    }

    setUploading(true)
    await uploadPhotoFn(file)
    setUploading(false)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleProfileUpdate = async () => {
    try {
      setLoading(true)
      const response = await api.put('/auth/profile', {
        name: formData.name,
        phone: formData.phone,
        address: formData.address
      })
      const data = response.data
      if (data.success) {
        toast.success('Profile updated successfully')
      } else {
        toast.error(data.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error(error.response?.data?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordUpdate = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    try {
      setLoading(true)
      const response = await api.put('/auth/password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      })
      const data = response.data
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
    } catch (error) {
      console.error('Error updating password:', error)
      toast.error(error.response?.data?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      </div>

      {/* Profile Photo Card */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Photo</h3>
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="h-24 w-24 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0 ring-4 ring-gray-100">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.name}
                  className="h-full w-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                />
              ) : null}
              <span
                className="text-2xl font-bold text-white"
                style={{ display: avatarUrl ? 'none' : 'flex' }}
              >
                {initials}
              </span>
            </div>
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
            <p className="text-sm font-medium text-gray-900">{displayName}</p>
            <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
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
            <p className="text-xs text-gray-400 mt-1.5">JPG, PNG up to 5MB. Face will be auto-cropped.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleProfileUpdate}
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
                className="input"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                name="email"
                className="input bg-gray-50"
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
              <input type="text" className="input bg-gray-50" value={user?.role} disabled />
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePasswordUpdate}
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
                className="input"
                value={formData.newPassword}
                onChange={handleChange}
              />
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
  )
}

export default Profile
