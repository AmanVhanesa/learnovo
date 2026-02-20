import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { User, Mail, Phone, Calendar, Save } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const Profile = () => {
  const { user, login } = useAuth()
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
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || ''
      }))
    }
  }, [user])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleProfileUpdate = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          // email: formData.email, // Email update might need special handling/verification
          phone: formData.phone,
          address: formData.address
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update local user context if needed, or trigger a refresh
        // For now, let's just show success
        alert('Profile updated successfully')
        // Ideally update context user here
      } else {
        alert(data.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordUpdate = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      alert('New passwords do not match')
      return
    }

    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/api/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('Password updated successfully')
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))
      } else {
        alert(data.message || 'Failed to update password')
      }
    } catch (error) {
      console.error('Error updating password:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
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
            {/* Salary field is explicitly OMITTED here */}
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
