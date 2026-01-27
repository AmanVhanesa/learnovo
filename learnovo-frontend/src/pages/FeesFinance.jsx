import React, { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, AlertCircle, Calendar, Users, FileText, Search, X, Plus, Receipt, Settings } from 'lucide-react'
import { feesReportsService, invoicesService, paymentsService, feeStructuresService } from '../services/feesService'
import { studentsService } from '../services/studentsService'
import { academicSessionsService, classesService } from '../services/academicsService'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const FeesFinance = () => {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState('dashboard')
    const [isLoading, setIsLoading] = useState(true)

    // Dashboard state
    const [dashboardData, setDashboardData] = useState(null)
    const [activeSession, setActiveSession] = useState(null)

    // Fee Structure state
    const [feeStructures, setFeeStructures] = useState([])
    const [showFeeStructureModal, setShowFeeStructureModal] = useState(false)
    const [editingFeeStructure, setEditingFeeStructure] = useState(null)

    // Invoice Generation state
    const [classes, setClasses] = useState([])
    const [showInvoiceModal, setShowInvoiceModal] = useState(false)

    // Payment collection state
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [studentInvoices, setStudentInvoices] = useState([])

    // Defaulters state
    const [defaulters, setDefaulters] = useState([])

    // Reports state
    const [collectionReport, setCollectionReport] = useState(null)

    useEffect(() => {
        fetchActiveSession()
    }, [])

    useEffect(() => {
        if (activeSession) {
            if (activeTab === 'dashboard') {
                fetchDashboard()
            } else if (activeTab === 'feeStructure') {
                fetchFeeStructures()
                fetchClasses()
            } else if (activeTab === 'invoices') {
                fetchFeeStructures()
                fetchClasses()
            } else if (activeTab === 'defaulters') {
                fetchDefaulters()
            } else if (activeTab === 'reports') {
                fetchCollectionReport()
            }
        }
    }, [activeTab, activeSession])

    const fetchActiveSession = async () => {
        try {
            const res = await academicSessionsService.getActive()
            setActiveSession(res.data)
        } catch (error) {
            console.error('Fetch session error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchFeeStructures = async () => {
        try {
            const res = await feeStructuresService.list({
                academicSessionId: activeSession?._id
            })
            setFeeStructures(res.data || [])
        } catch (error) {
            console.error('Fee structures error:', error)
            setFeeStructures([])
        }
    }

    const fetchClasses = async () => {
        try {
            const res = await classesService.list()
            setClasses(res.data || [])
        } catch (error) {
            console.error('Classes error:', error)
            setClasses([])
        }
    }

    const fetchDashboard = async () => {
        try {
            const res = await feesReportsService.getDashboard({
                academicSessionId: activeSession?._id
            })
            setDashboardData(res.data)
        } catch (error) {
            console.error('Dashboard error:', error)
            setDashboardData({
                summary: {
                    totalCollected: 0,
                    totalPending: 0,
                    totalOverdue: 0,
                    thisMonthCollection: 0
                },
                recentPayments: [],
                paymentMethodBreakdown: []
            })
        }
    }

    const fetchDefaulters = async () => {
        try {
            const res = await feesReportsService.getDefaulters({
                academicSessionId: activeSession?._id
            })
            setDefaulters(res.data || [])
        } catch (error) {
            console.error('Defaulters error:', error)
            setDefaulters([])
        }
    }

    const fetchCollectionReport = async () => {
        try {
            const endDate = new Date()
            const startDate = new Date()
            startDate.setDate(1)

            const res = await feesReportsService.getCollectionReport({
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            })
            setCollectionReport(res.data)
        } catch (error) {
            console.error('Collection report error:', error)
            setCollectionReport({
                summary: { totalAmount: 0, totalCount: 0 },
                byDate: []
            })
        }
    }

    const handleSelectStudent = async (student) => {
        setSelectedStudent(student)

        try {
            const res = await invoicesService.getStudentInvoices(student._id)
            const pendingInvoices = (res.data || []).filter(inv =>
                inv.status === 'Pending' || inv.status === 'Partial' || inv.status === 'Overdue'
            )
            setStudentInvoices(pendingInvoices)
            setShowPaymentModal(true)
        } catch (error) {
            console.error('Fetch invoices error:', error)
            toast.error('Failed to load student invoices')
        }
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(amount || 0)
    }

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
        { id: 'feeStructure', label: 'Fee Structure', icon: Settings },
        { id: 'invoices', label: 'Generate Invoices', icon: Receipt },
        { id: 'collect', label: 'Collect Payment', icon: DollarSign },
        { id: 'defaulters', label: 'Defaulters', icon: AlertCircle },
        { id: 'reports', label: 'Reports', icon: FileText }
    ]

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        )
    }

    if (!activeSession) {
        return (
            <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No active academic session found</p>
                <p className="text-sm text-gray-400 mt-1">Please activate an academic session first</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Fees & Finance</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Academic Session: {activeSession.name}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <div>
                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && dashboardData && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Total Collected</p>
                                        <p className="text-2xl font-bold text-green-600 mt-2">
                                            {formatCurrency(dashboardData.summary.totalCollected)}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-green-100 rounded-full">
                                        <TrendingUp className="h-6 w-6 text-green-600" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Pending Dues</p>
                                        <p className="text-2xl font-bold text-yellow-600 mt-2">
                                            {formatCurrency(dashboardData.summary.totalPending)}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-yellow-100 rounded-full">
                                        <AlertCircle className="h-6 w-6 text-yellow-600" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Overdue Amount</p>
                                        <p className="text-2xl font-bold text-red-600 mt-2">
                                            {formatCurrency(dashboardData.summary.totalOverdue)}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-red-100 rounded-full">
                                        <AlertCircle className="h-6 w-6 text-red-600" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">This Month</p>
                                        <p className="text-2xl font-bold text-blue-600 mt-2">
                                            {formatCurrency(dashboardData.summary.thisMonthCollection)}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-blue-100 rounded-full">
                                        <Calendar className="h-6 w-6 text-blue-600" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Payments */}
                        {dashboardData.recentPayments && dashboardData.recentPayments.length > 0 && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt No.</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dashboardData.recentPayments.map((payment) => (
                                                <tr key={payment._id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-primary-600">
                                                        {payment.receiptNumber}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900">{payment.studentId?.name}</div>
                                                        <div className="text-xs text-gray-500">{payment.studentId?.studentId}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                                        {formatCurrency(payment.amount)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                                            {payment.paymentMethod}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {new Date(payment.paymentDate).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* FEE STRUCTURE TAB */}
                {activeTab === 'feeStructure' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Fee Structures</h3>
                            <button
                                onClick={() => {
                                    setEditingFeeStructure(null)
                                    setShowFeeStructureModal(true)
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                            >
                                <Plus className="h-4 w-4" />
                                Create Fee Structure
                            </button>
                        </div>

                        {feeStructures.length === 0 ? (
                            <div className="text-center py-12">
                                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500">No fee structures found</p>
                                <p className="text-sm text-gray-400 mt-1">Create a fee structure to start generating invoices</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {feeStructures.map((structure) => (
                                    <div key={structure._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{structure.classId?.name}</h4>
                                                <p className="text-sm text-gray-600">{structure.sectionId?.name || 'All Sections'}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs rounded-full ${structure.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {structure.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Total Amount:</span>
                                                <span className="font-semibold text-gray-900">{formatCurrency(structure.totalAmount)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Fee Heads:</span>
                                                <span className="text-gray-900">{structure.feeHeads?.length || 0}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Frequency:</span>
                                                <span className="text-gray-900 capitalize">{structure.feeHeads?.[0]?.frequency || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingFeeStructure(structure)
                                                    setShowFeeStructureModal(true)
                                                }}
                                                className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm('Delete this fee structure?')) {
                                                        try {
                                                            await feeStructuresService.delete(structure._id)
                                                            toast.success('Fee structure deleted')
                                                            fetchFeeStructures()
                                                        } catch (error) {
                                                            toast.error('Failed to delete fee structure')
                                                        }
                                                    }
                                                }}
                                                className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* GENERATE INVOICES TAB */}
                {activeTab === 'invoices' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">Generate Invoices</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="border border-gray-200 rounded-lg p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-blue-100 rounded-full">
                                        <Receipt className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">Individual Invoice</h4>
                                        <p className="text-sm text-gray-600">Generate invoice for a single student</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowInvoiceModal(true)}
                                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                >
                                    Generate Individual Invoice
                                </button>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-green-100 rounded-full">
                                        <Users className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">Bulk Invoice</h4>
                                        <p className="text-sm text-gray-600">Generate invoices for entire class</p>
                                    </div>
                                </div>
                                <BulkInvoiceForm
                                    classes={classes}
                                    feeStructures={feeStructures}
                                    activeSession={activeSession}
                                    onSuccess={() => {
                                        toast.success('Bulk invoices generated successfully')
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* COLLECT PAYMENT TAB */}
                {activeTab === 'collect' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Collect Fee Payment</h3>

                        <StudentSearch onSelectStudent={handleSelectStudent} />

                        {selectedStudent && (
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm font-medium text-blue-900">Selected Student:</p>
                                <p className="text-lg font-bold text-blue-700">{selectedStudent.name}</p>
                                <p className="text-sm text-blue-600">ID: {selectedStudent.studentId}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* DEFAULTERS TAB */}
                {activeTab === 'defaulters' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Fee Defaulters</h3>
                            <span className="text-sm text-gray-600">{defaulters.length} students</span>
                        </div>

                        {defaulters.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500">No defaulters found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Due</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overdue Days</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {defaulters.map((defaulter) => (
                                            <tr key={defaulter._id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{defaulter.studentId?.name}</div>
                                                    <div className="text-xs text-gray-500">{defaulter.studentId?.studentId}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                                                    {formatCurrency(defaulter.totalBalance)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${defaulter.overdueDays > 30
                                                            ? 'bg-red-100 text-red-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {defaulter.overdueDays} days
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {defaulter.studentId?.phone || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* REPORTS TAB */}
                {activeTab === 'reports' && collectionReport && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">Collection Report (This Month)</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm font-medium text-green-900">Total Collected</p>
                                <p className="text-2xl font-bold text-green-700 mt-2">
                                    {formatCurrency(collectionReport.summary.totalAmount)}
                                </p>
                                <p className="text-sm text-green-600 mt-1">
                                    {collectionReport.summary.totalCount} payments
                                </p>
                            </div>

                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm font-medium text-blue-900">Daily Average</p>
                                <p className="text-2xl font-bold text-blue-700 mt-2">
                                    {formatCurrency(
                                        collectionReport.summary.totalAmount / (collectionReport.byDate?.length || 1)
                                    )}
                                </p>
                            </div>
                        </div>

                        {collectionReport.byDate && collectionReport.byDate.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collections</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {collectionReport.byDate.map((day) => (
                                            <tr key={day.date}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {new Date(day.date).toLocaleDateString('en-IN', {
                                                        weekday: 'short',
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{day.count}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                                    {formatCurrency(day.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Fee Structure Modal */}
            {showFeeStructureModal && (
                <FeeStructureModal
                    feeStructure={editingFeeStructure}
                    classes={classes}
                    activeSession={activeSession}
                    onClose={() => {
                        setShowFeeStructureModal(false)
                        setEditingFeeStructure(null)
                    }}
                    onSuccess={() => {
                        setShowFeeStructureModal(false)
                        setEditingFeeStructure(null)
                        fetchFeeStructures()
                        toast.success(editingFeeStructure ? 'Fee structure updated' : 'Fee structure created')
                    }}
                />
            )}

            {/* Individual Invoice Modal */}
            {showInvoiceModal && (
                <IndividualInvoiceModal
                    feeStructures={feeStructures}
                    activeSession={activeSession}
                    onClose={() => setShowInvoiceModal(false)}
                    onSuccess={() => {
                        setShowInvoiceModal(false)
                        toast.success('Invoice generated successfully')
                    }}
                />
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <PaymentModal
                    student={selectedStudent}
                    invoices={studentInvoices}
                    onClose={() => {
                        setShowPaymentModal(false)
                        setSelectedStudent(null)
                        setStudentInvoices([])
                    }}
                    onSuccess={() => {
                        setShowPaymentModal(false)
                        setSelectedStudent(null)
                        setStudentInvoices([])
                        if (activeTab === 'dashboard') fetchDashboard()
                        toast.success('Payment collected successfully')
                    }}
                />
            )}
        </div>
    )
}

// Student Search Component
const StudentSearch = ({ onSelectStudent }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)

    const handleSearch = async (term) => {
        setSearchTerm(term)

        if (term.length < 2) {
            setSearchResults([])
            return
        }

        setIsSearching(true)
        try {
            const res = await studentsService.list({ search: term })
            setSearchResults(res.data || [])
        } catch (error) {
            console.error('Search error:', error)
        } finally {
            setIsSearching(false)
        }
    }

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search student by name, ID, or phone..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
            </div>

            {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((student) => (
                        <button
                            key={student._id}
                            onClick={() => {
                                onSelectStudent(student)
                                setSearchResults([])
                                setSearchTerm('')
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                            <div className="font-medium text-gray-900">{student.name}</div>
                            <div className="text-sm text-gray-600">
                                ID: {student.studentId} | Class: {student.classId?.name || 'N/A'}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// Fee Structure Modal Component
const FeeStructureModal = ({ feeStructure, classes, activeSession, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        classId: feeStructure?.classId?._id || '',
        sectionId: feeStructure?.sectionId?._id || '',
        academicSessionId: activeSession?._id || '',
        feeHeads: feeStructure?.feeHeads || [
            { name: 'Tuition Fee', amount: 0, frequency: 'monthly', isCompulsory: true, dueDay: 5 }
        ],
        isActive: feeStructure?.isActive ?? true
    })
    const [isSaving, setIsSaving] = useState(false)

    const addFeeHead = () => {
        setForm({
            ...form,
            feeHeads: [...form.feeHeads, { name: '', amount: 0, frequency: 'monthly', isCompulsory: true, dueDay: 5 }]
        })
    }

    const removeFeeHead = (index) => {
        setForm({
            ...form,
            feeHeads: form.feeHeads.filter((_, i) => i !== index)
        })
    }

    const updateFeeHead = (index, field, value) => {
        const updated = [...form.feeHeads]
        updated[index] = { ...updated[index], [field]: value }
        setForm({ ...form, feeHeads: updated })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!form.classId) {
            toast.error('Please select a class')
            return
        }

        if (form.feeHeads.length === 0) {
            toast.error('Please add at least one fee head')
            return
        }

        try {
            setIsSaving(true)

            if (feeStructure) {
                await feeStructuresService.update(feeStructure._id, form)
            } else {
                await feeStructuresService.create(form)
            }

            onSuccess()
        } catch (error) {
            console.error('Save error:', error)
            toast.error(error.response?.data?.message || 'Failed to save fee structure')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {feeStructure ? 'Edit Fee Structure' : 'Create Fee Structure'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-6">
                        {/* Class Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                value={form.classId}
                                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                                required
                            >
                                <option value="">Select Class</option>
                                {classes.map((cls) => (
                                    <option key={cls._id} value={cls._id}>{cls.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Fee Heads */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-medium text-gray-700">Fee Heads *</label>
                                <button
                                    type="button"
                                    onClick={addFeeHead}
                                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Fee Head
                                </button>
                            </div>

                            <div className="space-y-3">
                                {form.feeHeads.map((head, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    value={head.name}
                                                    onChange={(e) => updateFeeHead(index, 'name', e.target.value)}
                                                    placeholder="e.g., Tuition Fee"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    value={head.amount}
                                                    onChange={(e) => updateFeeHead(index, 'amount', parseFloat(e.target.value))}
                                                    min="0"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                                                <select
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    value={head.frequency}
                                                    onChange={(e) => updateFeeHead(index, 'frequency', e.target.value)}
                                                >
                                                    <option value="monthly">Monthly</option>
                                                    <option value="quarterly">Quarterly</option>
                                                    <option value="annually">Annually</option>
                                                    <option value="one-time">One-time</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Due Day</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    value={head.dueDay}
                                                    onChange={(e) => updateFeeHead(index, 'dueDay', parseInt(e.target.value))}
                                                    min="1"
                                                    max="31"
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <button
                                                    type="button"
                                                    onClick={() => removeFeeHead(index)}
                                                    className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Active Status */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={form.isActive}
                                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                                Active
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50" disabled={isSaving}>
                            {isSaving ? 'Saving...' : feeStructure ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Individual Invoice Modal
const IndividualInvoiceModal = ({ feeStructures, activeSession, onClose, onSuccess }) => {
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [form, setForm] = useState({
        feeStructureId: '',
        dueDate: ''
    })
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!selectedStudent) {
            toast.error('Please select a student')
            return
        }

        if (!form.feeStructureId) {
            toast.error('Please select a fee structure')
            return
        }

        try {
            setIsSaving(true)

            await invoicesService.generate({
                studentId: selectedStudent._id,
                feeStructureId: form.feeStructureId,
                dueDate: form.dueDate,
                academicSessionId: activeSession._id
            })

            onSuccess()
        } catch (error) {
            console.error('Generate error:', error)
            toast.error(error.response?.data?.message || 'Failed to generate invoice')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">Generate Individual Invoice</h3>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-6">
                        {/* Student Search */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Student *</label>
                            <StudentSearch onSelectStudent={setSelectedStudent} />
                            {selectedStudent && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm font-medium text-blue-900">{selectedStudent.name}</p>
                                    <p className="text-xs text-blue-600">ID: {selectedStudent.studentId} | Class: {selectedStudent.classId?.name}</p>
                                </div>
                            )}
                        </div>

                        {/* Fee Structure */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Fee Structure *</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                value={form.feeStructureId}
                                onChange={(e) => setForm({ ...form, feeStructureId: e.target.value })}
                                required
                            >
                                <option value="">Select Fee Structure</option>
                                {feeStructures.filter(fs => fs.isActive).map((structure) => (
                                    <option key={structure._id} value={structure._id}>
                                        {structure.classId?.name} - ₹{structure.totalAmount}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Due Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                value={form.dueDate}
                                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                min={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50" disabled={isSaving}>
                            {isSaving ? 'Generating...' : 'Generate Invoice'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Bulk Invoice Form Component
const BulkInvoiceForm = ({ classes, feeStructures, activeSession, onSuccess }) => {
    const [form, setForm] = useState({
        classId: '',
        feeStructureId: '',
        dueDate: ''
    })
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!form.classId || !form.feeStructureId || !form.dueDate) {
            toast.error('Please fill all fields')
            return
        }

        try {
            setIsSaving(true)

            await invoicesService.generateBulk({
                classId: form.classId,
                feeStructureId: form.feeStructureId,
                dueDate: form.dueDate,
                academicSessionId: activeSession._id
            })

            setForm({ classId: '', feeStructureId: '', dueDate: '' })
            onSuccess()
        } catch (error) {
            console.error('Bulk generate error:', error)
            toast.error(error.response?.data?.message || 'Failed to generate bulk invoices')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={form.classId}
                    onChange={(e) => setForm({ ...form, classId: e.target.value })}
                    required
                >
                    <option value="">Select Class</option>
                    {classes.map((cls) => (
                        <option key={cls._id} value={cls._id}>{cls.name}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fee Structure</label>
                <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={form.feeStructureId}
                    onChange={(e) => setForm({ ...form, feeStructureId: e.target.value })}
                    required
                >
                    <option value="">Select Fee Structure</option>
                    {feeStructures.filter(fs => fs.isActive && fs.classId?._id === form.classId).map((structure) => (
                        <option key={structure._id} value={structure._id}>
                            ₹{structure.totalAmount} - {structure.feeHeads?.length} heads
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    required
                />
            </div>

            <button
                type="submit"
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                disabled={isSaving}
            >
                {isSaving ? 'Generating...' : 'Generate Bulk Invoices'}
            </button>
        </form>
    )
}

// Payment Modal Component
const PaymentModal = ({ student, invoices, onClose, onSuccess }) => {
    const [selectedInvoice, setSelectedInvoice] = useState(null)
    const [form, setForm] = useState({
        amount: '',
        paymentMethod: 'Cash',
        paymentDate: new Date().toISOString().split('T')[0],
        transactionDetails: {},
        remarks: ''
    })
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (invoices.length > 0) {
            setSelectedInvoice(invoices[0])
            setForm(f => ({ ...f, amount: invoices[0].balanceAmount }))
        }
    }, [invoices])

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!selectedInvoice) {
            toast.error('Please select an invoice')
            return
        }

        try {
            setIsSaving(true)

            await paymentsService.collect({
                studentId: student._id,
                invoiceId: selectedInvoice._id,
                amount: parseFloat(form.amount),
                paymentMethod: form.paymentMethod,
                paymentDate: form.paymentDate,
                transactionDetails: form.transactionDetails,
                remarks: form.remarks
            })

            onSuccess()
        } catch (error) {
            console.error('Payment error:', error)
            toast.error(error.response?.data?.message || 'Failed to collect payment')
        } finally {
            setIsSaving(false)
        }
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(amount || 0)
    }

    if (invoices.length === 0) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg max-w-md w-full mx-4">
                    <div className="p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Invoices</h3>
                        <p className="text-gray-600 mb-4">This student has no pending invoices to pay.</p>
                        <button onClick={onClose} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Close</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">Collect Fee Payment</h3>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-6">
                        {/* Student Info */}
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-600">Student</p>
                            <p className="text-lg font-bold text-gray-900">{student.name}</p>
                            <p className="text-sm text-gray-600">ID: {student.studentId}</p>
                        </div>

                        {/* Select Invoice */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Invoice *</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                value={selectedInvoice?._id || ''}
                                onChange={(e) => {
                                    const invoice = invoices.find(inv => inv._id === e.target.value)
                                    setSelectedInvoice(invoice)
                                    setForm(f => ({ ...f, amount: invoice?.balanceAmount || '' }))
                                }}
                                required
                            >
                                {invoices.map((invoice) => (
                                    <option key={invoice._id} value={invoice._id}>
                                        {invoice.invoiceNumber} - Balance: {formatCurrency(invoice.balanceAmount)} ({invoice.status})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                            <input
                                type="number"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                max={selectedInvoice?.balanceAmount}
                                min="1"
                                step="1"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Maximum: {formatCurrency(selectedInvoice?.balanceAmount || 0)}
                            </p>
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                value={form.paymentMethod}
                                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                                required
                            >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Card">Card</option>
                                <option value="Online">Online</option>
                            </select>
                        </div>

                        {/* Payment Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date *</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                value={form.paymentDate}
                                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                                max={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>

                        {/* Transaction Details */}
                        {form.paymentMethod !== 'Cash' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Transaction ID / Reference</label>
                                <input
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    value={form.transactionDetails.transactionId || ''}
                                    onChange={(e) => setForm({
                                        ...form,
                                        transactionDetails: { ...form.transactionDetails, transactionId: e.target.value }
                                    })}
                                    placeholder="Enter transaction ID or reference number"
                                />
                            </div>
                        )}

                        {/* Remarks */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                            <textarea
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                rows="2"
                                value={form.remarks}
                                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                                placeholder="Optional remarks"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50" disabled={isSaving}>
                            {isSaving ? 'Processing...' : 'Collect Payment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default FeesFinance
