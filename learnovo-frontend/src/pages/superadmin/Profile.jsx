import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSuperAdminAuth } from '../../contexts/SuperAdminContext'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import { User, Mail, Lock, Save, Eye, EyeOff, Shield } from 'lucide-react'

const Profile = () => {
  const { superAdmin, refreshProfile } = useSuperAdminAuth()
  const [activeTab, setActiveTab] = useState('profile')

  const [profileForm, setProfileForm] = useState({
    name: superAdmin?.name || '',
    email: superAdmin?.email || '',
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  const updateProfileMutation = useMutation({
    mutationFn: (data) => superAdminService.updateProfile(data),
    onSuccess: () => {
      toast.success('Profile updated successfully')
      if (refreshProfile) refreshProfile()
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: (data) => superAdminService.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to change password')
    },
  })

  const handleProfileSubmit = (e) => {
    e.preventDefault()
    updateProfileMutation.mutate(profileForm)
  }

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (passwordForm.newPassword.length < 6) {
      return toast.error('New password must be at least 6 characters')
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('Passwords do not match')
    }
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
  }

  const initials = (superAdmin?.name || 'S').charAt(0).toUpperCase()

  const tabs = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Lock },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-[-0.025em]">My Profile</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage your super admin account settings</p>
      </div>

      {/* Avatar + info header */}
      <div className="card p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
        <div className="h-16 w-16 rounded-2xl bg-primary-500 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-white">{initials}</span>
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{superAdmin?.name || 'Super Admin'}</h2>
          <p className="text-sm text-primary-600 dark:text-[#3EC4B1]">{superAdmin?.email}</p>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1">
            <Shield className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Platform Super Administrator</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-[#2C2C2E] p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
          <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-[13px] font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input pl-10"
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                <input
                  type="email"
                  autoComplete="off"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input pl-10"
                  placeholder="admin@learnovo.com"
                  required
                />
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold rounded-xl bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black hover:bg-primary-500 dark:hover:bg-[#35a89a] shadow-md active:scale-[0.97] transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Change Password</h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
            {[
              { key: 'currentPassword', label: 'Current Password', placeholder: 'Enter current password', field: 'current' },
              { key: 'newPassword', label: 'New Password', placeholder: 'Enter new password (min 6 chars)', field: 'new' },
              { key: 'confirmPassword', label: 'Confirm New Password', placeholder: 'Confirm new password', field: 'confirm' },
            ].map(({ key, label, placeholder, field }) => (
              <div key={key}>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-[#8E8E93] mb-1">{label}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                  <input
                    type={showPasswords[field] ? 'text' : 'password'}
                    value={passwordForm[key]}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="input pl-10 pr-10"
                    placeholder={placeholder}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors"
                    onClick={() => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))}
                  >
                    {showPasswords[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold rounded-xl bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black hover:bg-primary-500 dark:hover:bg-[#35a89a] shadow-md active:scale-[0.97] transition-all disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default Profile
