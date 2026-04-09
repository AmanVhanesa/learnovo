import React, { useState, useEffect } from 'react'
import { formatCurrency } from '../utils/formatCurrency'
import { Dialog } from '@headlessui/react'
import { format } from 'date-fns'
import {
    X,
    Download,
    ChevronLeft,
    ChevronRight,
    Filter,
    Search,
    School,
    Calendar,
    CreditCard
} from 'lucide-react'
import { reportsService } from '../services/reportsService'
import { exportReport } from '../utils/exportHelpers'
import { useSettings } from '../contexts/SettingsContext'

const FeeDetailsModal = ({ isOpen, onClose, initialDate }) => {
    const { settings } = useSettings()
    const [date, setDate] = useState(initialDate || new Date())
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState({ transactions: [], totalCollected: 0, count: 0 })
    const [error, setError] = useState(null)

    // Filters
    const [filters, setFilters] = useState({
        class: '',
        paymentMethod: '',
        feeType: ''
    })


    useEffect(() => {
        if (isOpen) {
            if (initialDate) setDate(new Date(initialDate))
            fetchData()
        }
    }, [isOpen, date, filters]) // Re-fetch on date or filter change

    const fetchData = async () => {
        try {
            setLoading(true)
            const formattedDate = format(date, 'yyyy-MM-dd')
            const result = await reportsService.getDailyFeeDetails(formattedDate, filters)

            if (result.success) {
                setData(result.data)
            }
        } catch (err) {
            setError("Failed to load data")
        } finally {
            setLoading(false)
        }
    }

    const handlePrevDay = () => {
        const prev = new Date(date)
        prev.setDate(prev.getDate() - 1)
        setDate(prev)
    }

    const handleNextDay = () => {
        const next = new Date(date)
        next.setDate(next.getDate() + 1)
        setDate(next)
    }

    const handleExport = () => {
        if (!data.transactions.length) return

        const headers = ['Student Name', 'Admission No', 'Class', 'Fee Type', 'Amount', 'Payment Mode', 'Time']
        const rows = data.transactions.map(txn => [
            txn.student?.name || 'Unknown',
            txn.student?.admissionNumber || '-',
            txn.student?.class || '-',
            txn.feeType,
            txn.amount,
            txn.paymentMethod,
            format(new Date(txn.paidDate), 'h:mm a')
        ])

        exportReport(`Fee_Report_${format(date, 'yyyy-MM-dd')}.xlsx`, {
            schoolName: settings?.institution?.name,
            reportTitle: `Fee Collection — ${format(date, 'dd MMM yyyy')}`,
            headers, rows, sheetName: 'Fee Collection',
            summary: [
                { label: 'Total Collected', value: data.totalCollected },
                { label: 'Total Transactions', value: data.count },
            ],
        })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">

                {/* Backdrop */}
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white dark:bg-[#1C1C1E] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">

                    {/* Header */}
                    <div className="bg-white dark:bg-[#1C1C1E] px-3 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 border-b border-gray-100 dark:border-[#38383A]">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-teal-100 dark:bg-teal-500/10">
                                    <CreditCard className="h-6 w-6 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                        Daily Fee Collection
                                    </h3>
                                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-[#8E8E93]">
                                        <button onClick={handlePrevDay} className="p-1 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded text-gray-400 hover:text-gray-600 dark:text-[#8E8E93] dark:hover:text-white">
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <span className="font-medium text-gray-700 dark:text-white min-w-[100px] text-center">
                                            {format(date, 'EEE, dd MMM yyyy')}
                                        </span>
                                        <button onClick={handleNextDay} className="p-1 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded text-gray-400 hover:text-gray-600 dark:text-[#8E8E93] dark:hover:text-white">
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="text-right mr-2 sm:mr-4">
                                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Total Collected</p>
                                    <p className="text-xl font-bold text-teal-600 dark:text-teal-400">{formatCurrency(data.totalCollected)}</p>
                                </div>
                                <button
                                    onClick={handleExport}
                                    className="inline-flex justify-center rounded-md border border-gray-300 dark:border-[#38383A] shadow-sm px-4 py-2 bg-white dark:bg-[#1C1C1E] text-base font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E] focus:outline-none sm:text-sm"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export
                                </button>
                                <button
                                    onClick={onClose}
                                    className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-gray-100 dark:bg-[#2C2C2E] text-base font-medium text-gray-700 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#38383A] focus:outline-none sm:text-sm"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Filters Row */}
                        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 sm:items-center bg-gray-50 dark:bg-[#2C2C2E] p-2 sm:p-3 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#8E8E93]">
                                <Filter className="h-4 w-4" />
                                <span className="font-medium">Filter by:</span>
                            </div>

                            <select
                                className="text-sm border-gray-300 dark:border-[#38383A] rounded-md shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-[#1C1C1E] dark:text-white"
                                value={filters.class}
                                onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                            >
                                <option value="">All Classes</option>
                                <option value="10th Grade">10th Grade</option>
                                <option value="9th Grade">9th Grade</option>
                                {/* Add more classes dynamically or static for now */}
                            </select>

                            <select
                                className="text-sm border-gray-300 dark:border-[#38383A] rounded-md shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-[#1C1C1E] dark:text-white"
                                value={filters.paymentMethod}
                                onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                            >
                                <option value="">All Payment Modes</option>
                                <option value="cash">Cash</option>
                                <option value="online">Online</option>
                                <option value="bank_transfer">Bank Transfer</option>
                            </select>

                            {filters.class || filters.paymentMethod ? (
                                <button
                                    onClick={() => setFilters({ class: '', paymentMethod: '', feeType: '' })}
                                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline ml-auto"
                                >
                                    Clear Filters
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#1C1C1E] min-h-[300px] max-h-[60vh] overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center items-center h-48">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                            </div>
                        ) : data.transactions.length === 0 ? (
                            <div className="flex flex-col justify-center items-center h-48 text-gray-400 dark:text-[#636366]">
                                <CreditCard className="h-12 w-12 mb-2 opacity-20" />
                                <p>No transactions found for this day.</p>
                            </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-[#38383A]">
                                <thead className="bg-gray-50 dark:bg-[#2C2C2E] sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                            Time
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                            Student
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                            Class
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                            Fee Type
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                            Mode
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-200 dark:divide-[#38383A]">
                                    {data.transactions.map((txn, idx) => (
                                        <tr key={txn._id || idx} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                {format(new Date(txn.paidDate), 'h:mm a')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{txn.student?.name || 'Unknown'}</div>
                                                <div className="text-xs text-gray-500 dark:text-[#8E8E93]">{txn.student?.admissionNumber}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                {txn.student?.class || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400">
                                                    {txn.feeType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93] capitalize">
                                                {txn.paymentMethod?.replace('_', ' ')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-right">
                                                {formatCurrency(txn.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                          </div>
                        )}
                    </div>

                    <div className="bg-gray-50 dark:bg-[#2C2C2E] px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-100 dark:border-[#38383A]">
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-[#38383A] shadow-sm px-4 py-2 bg-white dark:bg-[#1C1C1E] text-base font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FeeDetailsModal
