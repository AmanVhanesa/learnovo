import React, { useState, useEffect } from 'react'
import { Settings, Save, Clock } from 'lucide-react'
import TimePicker from '../../components/ui/TimePicker'
import { attendanceService } from '../../services/attendanceService'
import toast from 'react-hot-toast'

const daysOfWeek = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
]

const AttendanceSettings = () => {
  const [settings, setSettings] = useState({
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    schoolStartTime: '08:00',
    lateThresholdTime: '08:15',
    halfDayThreshold: '11:00',
    allowPastEditing: true,
    pastEditDays: 7,
    smsNotifyAbsent: false,
    notifyParents: true,
    dailySummaryToAdmin: false
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      const response = await attendanceService.getSettings()
      if (response?.data) {
        setSettings(prev => ({ ...prev, ...response.data }))
      }
    } catch (error) {
    } finally {
      setIsLoading(false)
    }
  }

  const toggleWorkingDay = (day) => {
    setSettings(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day]
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await attendanceService.updateSettings(settings)
      toast.success('Settings saved!')
    } catch (error) {
      toast.error(error?.message || 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Attendance Settings</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Configure attendance rules and preferences</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Working Days */}
      <div className="card p-4 sm:p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Working Days</h3>
        <div className="flex flex-wrap gap-3">
          {daysOfWeek.map(day => (
            <button
              key={day.key}
              onClick={() => toggleWorkingDay(day.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                settings.workingDays.includes(day.key)
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-gray-50 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A] hover:border-primary-300'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* School Timing */}
      <div className="card p-4 sm:p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary-500" /> School Timing
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">School Start Time</label>
            <TimePicker
              value={settings.schoolStartTime}
              onChange={(e) => setSettings(s => ({ ...s, schoolStartTime: e.target.value }))}
            />
            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">When school starts</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Late Threshold</label>
            <TimePicker
              value={settings.lateThresholdTime}
              onChange={(e) => setSettings(s => ({ ...s, lateThresholdTime: e.target.value }))}
            />
            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">After this time = Late</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Half-Day Threshold</label>
            <TimePicker
              value={settings.halfDayThreshold}
              onChange={(e) => setSettings(s => ({ ...s, halfDayThreshold: e.target.value }))}
            />
            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">After this time = Half Day</p>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="card p-4 sm:p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Rules</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Allow Editing Past Attendance</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Teachers can edit previously marked attendance</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, allowPastEditing: !s.allowPastEditing }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.allowPastEditing ? 'bg-primary-500' : 'bg-gray-300 dark:bg-[#38383A]'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1C1C1E] transition-transform ${
                settings.allowPastEditing ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {settings.allowPastEditing && (
            <div className="ml-4 border-l-2 border-gray-200 dark:border-[#38383A] pl-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                Allow editing up to ___ days back
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.pastEditDays}
                onChange={(e) => setSettings(s => ({ ...s, pastEditDays: parseInt(e.target.value) || 7 }))}
                className="input w-24"
              />
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="card p-4 sm:p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">SMS on Absence</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Send SMS to parents when student is marked absent</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, smsNotifyAbsent: !s.smsNotifyAbsent }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.smsNotifyAbsent ? 'bg-primary-500' : 'bg-gray-300 dark:bg-[#38383A]'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1C1C1E] transition-transform ${
                settings.smsNotifyAbsent ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">App Notifications</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Send app notification to parents on absence</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, notifyParents: !s.notifyParents }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.notifyParents ? 'bg-primary-500' : 'bg-gray-300 dark:bg-[#38383A]'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1C1C1E] transition-transform ${
                settings.notifyParents ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Daily Summary to Admin</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Send daily attendance summary to admin</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, dailySummaryToAdmin: !s.dailySummaryToAdmin }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.dailySummaryToAdmin ? 'bg-primary-500' : 'bg-gray-300 dark:bg-[#38383A]'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1C1C1E] transition-transform ${
                settings.dailySummaryToAdmin ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AttendanceSettings
