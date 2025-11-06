import React, { useState } from 'react'
import ChartFilters from './ChartFilters'

const ChartCard = ({ title, children, onExport, filterOptions = {} }) => {
  const [range, setRange] = useState('30d')
  const [classValue, setClassValue] = useState('all')
  const [sectionValue, setSectionValue] = useState('all')
  const [teacherValue, setTeacherValue] = useState('all')

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <ChartFilters
          range={range}
          setRange={setRange}
          classOptions={filterOptions.classOptions}
          classValue={classValue}
          setClassValue={setClassValue}
          sectionOptions={filterOptions.sectionOptions}
          sectionValue={sectionValue}
          setSectionValue={setSectionValue}
          teacherOptions={filterOptions.teacherOptions}
          teacherValue={teacherValue}
          setTeacherValue={setTeacherValue}
          onExport={onExport}
        />
      </div>
      <div className="mt-4 h-64">
        {typeof children === 'function' ? children({ range, classValue, sectionValue, teacherValue }) : children}
      </div>
    </div>
  )
}

export default ChartCard


