import React, { useState, useEffect } from 'react'
import { Calendar, Plus, Edit2, Trash2, X } from 'lucide-react'
import { attendanceService } from '../../services/attendanceService'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const typeLabels = {
  public_holiday: 'Public Holiday',
  school_holiday: 'School Holiday',
  exam_break: 'Exam Break',
  vacation: 'Vacation'
}

const typeColors = {
  public_holiday: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  school_holiday: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  exam_break: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  vacation: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
}

const Holidays = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [holidays, setHolidays] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState(null)
  const [form, setForm] = useState({
    title: '', date: '', startDate: '', endDate: '', type: 'school_holiday', appliesTo: 'all'
  })
  const [isRange, setIsRange] = useState(false)

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    try {
      setIsLoading(true)
      const response = await attendanceService.getHolidays()
      setHolidays(response?.data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingHoliday(null)
    setForm({ title: '', date: '', startDate: '', endDate: '', type: 'school_holiday', appliesTo: 'all' })
    setIsRange(false)
    setShowModal(true)
  }

  const openEditModal = (holiday) => {
    setEditingHoliday(holiday)
    const hasRange = holiday.startDate && holiday.endDate
    setIsRange(hasRange)
    setForm({
      title: holiday.title,
      date: holiday.date ? new Date(holiday.date).toISOString().split('T')[0] : '',
      startDate: holiday.startDate ? new Date(holiday.startDate).toISOString().split('T')[0] : '',
      endDate: holiday.endDate ? new Date(holiday.endDate).toISOString().split('T')[0] : '',
      type: holiday.type || 'school_holiday',
      appliesTo: holiday.appliesTo || 'all'
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.date) {
      toast.error('Title and date are required')
      return
    }

    try {
      const payload = {
        title: form.title,
        date: form.date,
        type: form.type,
        appliesTo: form.appliesTo
      }
      if (isRange && form.startDate && form.endDate) {
        payload.startDate = form.startDate
        payload.endDate = form.endDate
      }

      if (editingHoliday) {
        await attendanceService.updateHoliday(editingHoliday._id, payload)
        toast.success('Holiday updated')
      } else {
        await attendanceService.addHoliday(payload)
        toast.success('Holiday added')
      }

      setShowModal(false)
      fetchHolidays()
    } catch (error) {
      toast.error(error?.message || 'Failed to save holiday')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this holiday?')) return
    try {
      await attendanceService.deleteHoliday(id)
      toast.success('Holiday deleted')
      fetchHolidays()
    } catch (error) {
      toast.error('Failed to delete')
    }
  }

  // Group holidays by month
  const grouped = {}
  holidays.forEach(h => {
    const d = new Date(h.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = { label, holidays: [] }
    grouped[key].holidays.push(h)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Holidays</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage school holidays and breaks</p>
        </div>
        {isAdmin && (
          <button onClick={openAddModal} className="btn btn-primary">
            <Plus className="h-4 w-4 mr-2" /> Add Holiday
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="loading-spinner" /></div>
      ) : holidays.length === 0 ? (
        <div className="card p-8 text-center">
          <Calendar className="h-10 w-10 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">No holidays configured</p>
          {isAdmin && <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Add holidays to prevent attendance marking on non-working days.</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort().map(([key, group]) => (
            <div key={key}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-3">{group.label}</h3>
              <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-dark-border">
                {group.holidays.map(holiday => (
                  <div key={holiday._id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                          {new Date(holiday.date).getDate()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{holiday.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColors[holiday.type] || 'bg-gray-100 text-gray-600'}`}>
                            {typeLabels[holiday.type] || holiday.type}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-[#636366]">
                            {new Date(holiday.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </span>
                          {holiday.appliesTo !== 'all' && (
                            <span className="text-xs text-gray-400 capitalize">({holiday.appliesTo})</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => openEditModal(holiday)} className="btn btn-ghost btn-sm">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(holiday._id)} className="btn btn-ghost btn-sm text-red-500 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-6">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#2C2C2E]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Republic Day"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  className="input"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRange"
                  checked={isRange}
                  onChange={(e) => setIsRange(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="isRange" className="text-sm text-gray-700 dark:text-[#8E8E93]">Multi-day holiday</label>
              </div>

              {isRange && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Start Date</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">End Date</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                      className="input"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                  className="input"
                >
                  <option value="public_holiday">Public Holiday</option>
                  <option value="school_holiday">School Holiday</option>
                  <option value="exam_break">Exam Break</option>
                  <option value="vacation">Vacation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Applies To</label>
                <select
                  value={form.appliesTo}
                  onChange={(e) => setForm(f => ({ ...f, appliesTo: e.target.value }))}
                  className="input"
                >
                  <option value="all">Everyone</option>
                  <option value="students">Students Only</option>
                  <option value="employees">Employees Only</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingHoliday ? 'Update' : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Holidays
