import React, { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import ChartFilters from './ChartFilters'
import { exportCanvasAsPNG } from '../utils/exportHelpers'

const ChartCard = ({ title, children, onExport, filterOptions = {}, className }) => {
  const [range, setRange] = useState('30d')
  const [classValue, setClassValue] = useState('all')
  const [sectionValue, setSectionValue] = useState('all')
  const [teacherValue, setTeacherValue] = useState('all')
  const containerRef = useRef(null)

  const handleExport = () => {
    const canvas = containerRef.current?.querySelector('canvas')
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      const safeName = (title || 'chart').replace(/[^\w]+/g, '_')
      const date = new Date().toISOString().split('T')[0]
      if (exportCanvasAsPNG(canvas, `${safeName}_${date}.png`)) {
        toast.success(`${title || 'Chart'} exported`)
        return
      }
    }
    if (onExport) {
      onExport()
    } else {
      toast.error('Nothing to export yet')
    }
  }

  return (
    <div className={className || "card p-4 sm:p-6"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-5">
        <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
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
          onExport={onExport ? handleExport : undefined}
        />
      </div>
      <div ref={containerRef} className="h-52 sm:h-64">
        {typeof children === 'function' ? children({ range, classValue, sectionValue, teacherValue }) : children}
      </div>
    </div>
  )
}

export default ChartCard
