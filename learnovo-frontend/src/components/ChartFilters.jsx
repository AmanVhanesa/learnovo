import React from 'react'

const ChartFilters = ({ range, setRange, classOptions = [], classValue, setClassValue, sectionOptions = [], sectionValue, setSectionValue, teacherOptions = [], teacherValue, setTeacherValue, onExport }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Date range" className="rounded-md border border-gray-200 px-2 py-1 text-sm" value={range} onChange={(e) => setRange(e.target.value)}>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
        <option value="ytd">Year to date</option>
        <option value="all">All time</option>
      </select>
      {!!classOptions.length && (
        <select aria-label="Class" className="rounded-md border border-gray-200 px-2 py-1 text-sm" value={classValue} onChange={(e) => setClassValue(e.target.value)}>
          <option value="all">All classes</option>
          {classOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {!!sectionOptions.length && (
        <select aria-label="Section" className="rounded-md border border-gray-200 px-2 py-1 text-sm" value={sectionValue} onChange={(e) => setSectionValue(e.target.value)}>
          <option value="all">All sections</option>
          {sectionOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {!!teacherOptions.length && (
        <select aria-label="Teacher" className="rounded-md border border-gray-200 px-2 py-1 text-sm" value={teacherValue} onChange={(e) => setTeacherValue(e.target.value)}>
          <option value="all">All teachers</option>
          {teacherOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {onExport && (
        <button onClick={onExport} className="btn btn-sm btn-ghost">Export</button>
      )}
    </div>
  )
}

export default ChartFilters


