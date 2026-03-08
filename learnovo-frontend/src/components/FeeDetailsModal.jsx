import React, { useState, useEffect } from 'react'
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
import { exportCSV } from '../utils/exportHelpers'
import { useSettings } from '../contexts/SettingsContext' // Assuming this exists for currency

const FeeDetailsModal = ({ isOpen, onClose, initialDate }) => {
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

    // Hook for currency formatting (mock implementation if context missing)
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount)
    }

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
            console.error("Failed to fetch fee details", err)
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

        const exportData = [
            ['Date', format(date, 'yyyy-MM-dd')],
            ['Total Collected', data.totalCollected],
            ['Total Transactions', data.count],
            [], // Empty row
            ['Student Name', 'Admission No', 'Class', 'Fee Type', 'Amount', 'Payment Mode', 'Time']
        ]

        data.transactions.forEach(txn => {
            exportData.push([
                txn.student?.name || 'Unknown',
                txn.student?.admissionNumber || '-',
                txn.student?.class || '-',
                txn.feeType,
                txn.amount,
                txn.paymentMethod,
                format(new Date(txn.paidDate), 'h:mm a')
            ])
        })

        exportCSV(`Fee_Report_${format(date, 'yyyy-MM-dd')}.csv`, exportData)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">

                {/* Backdrop */}
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">

                    {/* Header */}
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-100">
                        <div className="sm:flex sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-teal-100 sm:mx-0 sm:h-10 sm:w-10">
                                    <CreditCard className="h-6 w-6 text-teal-600" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        Daily Fee Collection
                                    </h3>
                                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                                        <button onClick={handlePrevDay} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <span className="font-medium text-gray-700 min-w-[100px] text-center">
                                            {format(date, 'EEE, dd MMM yyyy')}
                                        </span>
                                        <button onClick={handleNextDay} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 sm:mt-0 flex gap-3">
                                <div className="text-right mr-4">
                                    <p className="text-sm text-gray-500">Total Collected</p>
                                    <p className="text-xl font-bold text-teal-600">{formatCurrency(data.totalCollected)}</p>
                                </div>
                                <button
                                    onClick={handleExport}
                                    className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export
                                </button>
                                <button
                                    onClick={onClose}
                                    className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-gray-100 text-base font-medium text-gray-700 hover:bg-gray-200 focus:outline-none sm:text-sm"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Filters Row */}
                        <div className="mt-4 flex flex-wrap gap-4 items-center bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Filter className="h-4 w-4" />
                                <span className="font-medium">Filter by:</span>
                            </div>

                            <select
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white"
                                value={filters.class}
                                onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                            >
                                <option value="">All Classes</option>
                                <option value="10th Grade">10th Grade</option>
                                <option value="9th Grade">9th Grade</option>
                                {/* Add more classes dynamically or static for now */}
                            </select>

                            <select
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white"
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
                                    className="text-xs text-red-600 hover:text-red-800 underline ml-auto"
                                >
                                    Clear Filters
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="bg-white min-h-[300px] max-h-[60vh] overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center items-center h-48">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                            </div>
                        ) : data.transactions.length === 0 ? (
                            <div className="flex flex-col justify-center items-center h-48 text-gray-400">
                                <CreditCard className="h-12 w-12 mb-2 opacity-20" />
                                <p>No transactions found for this day.</p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Time
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Student
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Class
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Fee Type
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Mode
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {data.transactions.map((txn, idx) => (
                                        <tr key={txn._id || idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {format(new Date(txn.paidDate), 'h:mm a')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{txn.student?.name || 'Unknown'}</div>
                                                <div className="text-xs text-gray-500">{txn.student?.admissionNumber}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {txn.student?.class || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    {txn.feeType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                                {txn.paymentMethod?.replace('_', ' ')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                                {formatCurrency(txn.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-100">
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
