import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { User, Mail, Phone, Calendar, Save } from 'lucide-react'

const Profile = () => {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <button className="btn btn-primary">
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input type="text" className="input" defaultValue={user?.name} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" defaultValue={user?.email} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" className="input" defaultValue={user?.phone || ''} />
            </div>
            <div>
              <label className="label">Role</label>
              <input type="text" className="input" defaultValue={user?.role} disabled />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input type="password" className="input" />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" className="input" />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" className="input" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
