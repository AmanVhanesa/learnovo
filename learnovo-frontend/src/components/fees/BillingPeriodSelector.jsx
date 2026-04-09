import React from 'react'

const BillingPeriodSelector = ({ frequency, form, setForm }) => {
  if (frequency === 'Monthly') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Month</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-[#1C1C1E] dark:text-white"
            value={form.billingMonth}
            onChange={(e) => setForm({ ...form, billingMonth: parseInt(e.target.value) })}
          >
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Year</label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-[#1C1C1E] dark:text-white"
            value={form.billingYear}
            onChange={(e) => setForm({ ...form, billingYear: parseInt(e.target.value) })}
            min="2020"
            max="2050"
          />
        </div>
      </div>
    )
  }

  if (frequency === 'Quarterly') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Quarter</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-[#1C1C1E] dark:text-white"
            value={form.billingQuarter}
            onChange={(e) => setForm({ ...form, billingQuarter: parseInt(e.target.value) })}
          >
            <option value="1">Q1 (Apr-Jun)</option>
            <option value="2">Q2 (Jul-Sep)</option>
            <option value="3">Q3 (Oct-Dec)</option>
            <option value="4">Q4 (Jan-Mar)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Year</label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-[#1C1C1E] dark:text-white"
            value={form.billingYear}
            onChange={(e) => setForm({ ...form, billingYear: parseInt(e.target.value) })}
            min="2020"
            max="2050"
          />
        </div>
      </div>
    )
  }

  if (frequency === 'Annual') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Academic Year</label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-[#1C1C1E] dark:text-white"
          value={form.billingYear}
          onChange={(e) => setForm({ ...form, billingYear: parseInt(e.target.value) })}
          min="2020"
          max="2050"
        />
        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
          Will show as: Academic Year {form.billingYear}-{form.billingYear + 1}
        </p>
      </div>
    )
  }

  return <p className="text-sm text-gray-600 dark:text-[#8E8E93]">No billing period needed for one-time fees</p>
}

export default BillingPeriodSelector
