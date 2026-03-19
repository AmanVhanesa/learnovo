import React, { useState, useRef, useEffect } from 'react'
import { Download, FileText, Table, ChevronDown } from 'lucide-react'

const TimetableExportButton = ({
  onExportPDF,
  onExportExcel,
  loading = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handler)
      document.addEventListener('touchstart', handler)
    }
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [isOpen])

  const handleExportPDF = () => {
    setIsOpen(false)
    onExportPDF?.()
  }

  const handleExportExcel = () => {
    setIsOpen(false)
    onExportExcel?.()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Download className="h-4 w-4" />
        <span>{loading ? 'Exporting...' : 'Export'}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !loading && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-52 rounded-xl shadow-lg bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] z-20 overflow-hidden">
            <div className="py-1" role="menu">
              <button
                type="button"
                onClick={handleExportPDF}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E] flex items-center gap-3 transition-colors"
                role="menuitem"
              >
                <FileText className="h-4 w-4 text-red-500" />
                Export as PDF
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E] flex items-center gap-3 transition-colors"
                role="menuitem"
              >
                <Table className="h-4 w-4 text-emerald-500" />
                Export as Excel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TimetableExportButton
