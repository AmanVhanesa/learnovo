import React, { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, AlertCircle, Calendar, Users, FileText, Search, X, Plus, Receipt, Settings, Printer, History, Edit, Trash2 } from 'lucide-react'
import { feesReportsService, invoicesService, paymentsService, feeStructuresService } from '../services/feesService'
import { studentsService } from '../services/studentsService'
import { academicSessionsService, classesService } from '../services/academicsService'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'
const SERVER_URL = API_BASE.replace(/\/api\/?$/, '')

// Edit Invoice Modal
import EditInvoiceModal from '../components/EditInvoiceModal'

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
    const [studentPayments, setStudentPayments] = useState([])

    // Defaulters state
    const [defaulters, setDefaulters] = useState([])

    // Editing state
    const [editingInvoice, setEditingInvoice] = useState(null)

    // Reports state
    const [collectionReport, setCollectionReport] = useState(null)

    // Receipts tab state
    const [allReceipts, setAllReceipts] = useState([])
    const [receiptsLoading, setReceiptsLoading] = useState(false)
    const [receiptFilters, setReceiptFilters] = useState({
        search: '',
        paymentMethod: '',
        startDate: '',
        endDate: ''
    })

    // Disputes tab state
    const [disputesData, setDisputesData] = useState({ disputes: [], stuckPayments: [] })
    const [disputesLoading, setDisputesLoading] = useState(false)
    const [resolvingDispute, setResolvingDispute] = useState(null)
    const [resolveForm, setResolveForm] = useState({ action: 'APPROVE', note: '' })

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
            } else if (activeTab === 'receipts') {
                fetchReceipts({})
            } else if (activeTab === 'disputes') {
                fetchDisputes()
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

    const fetchReceipts = async (filters = {}) => {
        setReceiptsLoading(true)
        try {
            const params = {}
            if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod
            if (filters.startDate) params.startDate = filters.startDate
            if (filters.endDate) params.endDate = filters.endDate
            const res = await paymentsService.list(params)
            let data = res.data || []
            // Client-side text search across student name, receipt number, admission number
            if (filters.search) {
                const q = filters.search.toLowerCase()
                data = data.filter(p =>
                    (p.studentId?.name || '').toLowerCase().includes(q) ||
                    (p.studentId?.fullName || '').toLowerCase().includes(q) ||
                    (p.receiptNumber || '').toLowerCase().includes(q) ||
                    (p.studentId?.admissionNumber || '').toLowerCase().includes(q) ||
                    (p.studentId?.studentId || '').toLowerCase().includes(q)
                )
            }
            setAllReceipts(data)
        } catch (error) {
            console.error('Fetch receipts error:', error)
            setAllReceipts([])
        } finally {
            setReceiptsLoading(false)
        }
    }

    const fetchDisputes = async () => {
        setDisputesLoading(true)
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_BASE}/admin-disputes`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const json = await res.json()
            if (json.success) {
                setDisputesData(json.data)
            }
        } catch (error) {
            console.error('Fetch disputes error:', error)
        } finally {
            setDisputesLoading(false)
        }
    }

    const handleResolveDispute = async (disputeId) => {
        if (!resolveForm.note.trim()) {
            toast.error('Please add a note before resolving')
            return
        }
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_BASE}/admin-disputes/${disputeId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    resolutionAction: resolveForm.action,
                    adminNote: resolveForm.note
                })
            })
            const json = await res.json()
            if (json.success) {
                toast.success(`Dispute ${resolveForm.action === 'APPROVE' ? 'approved' : 'rejected'} successfully`)
                setResolvingDispute(null)
                setResolveForm({ action: 'APPROVE', note: '' })
                fetchDisputes()
            } else {
                toast.error(json.message || 'Failed to resolve dispute')
            }
        } catch (error) {
            console.error('Resolve dispute error:', error)
            toast.error('Failed to resolve dispute')
        }
    }

    const handleDeleteInvoice = async (invoiceId) => {
        if (!window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) return
        try {
            await invoicesService.delete(invoiceId)
            toast.success('Invoice deleted successfully')
            fetchDashboard()
        } catch (error) {
            console.error('Delete error:', error)
            toast.error(error.response?.data?.message || 'Failed to delete invoice')
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

            // Fetch payment history
            const paymentsRes = await paymentsService.list({ studentId: student._id })
            setStudentPayments(paymentsRes.data || [])

            setShowPaymentModal(true)
        } catch (error) {
            console.error('Fetch data error:', error)
            toast.error('Failed to load student data')
        }
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(amount || 0)
    }


    // ─── Receipt helpers ────────────────────────────────────────────────────
    const getReceiptData = async (paymentId) => {
        const response = await paymentsService.getReceipt(paymentId)
        return response.data
    }

    const buildReceiptHtml = (payment, school) => {
        const getLogoUrl = (url) => {
            if (!url) return null
            const fullUrl = url.startsWith('http') ? url : `${SERVER_URL}${url}`
            return encodeURI(fullUrl)
        }
        const logoUrl = getLogoUrl(school.logo)
        const signatureUrl = getLogoUrl(school.principalSignature)

        const studentName = payment.studentId?.name || payment.studentId?.fullName || 'N/A'
        const studentAdmNo = payment.studentId?.admissionNumber || payment.studentId?.studentId || '-'
        const studentClass = payment.studentId?.classId?.name || payment.studentId?.class || '-'
        const studentSection = payment.studentId?.section || ''

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt #${payment.receiptNumber}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                <meta charset="UTF-8">
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .container { max-width: 420px; margin: 0 auto; padding: 20px; }

                    .header { display: flex; align-items: center; gap: 10px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; }
                    .logo-container { width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-radius: 6px; flex-shrink: 0; }
                    .logo { max-width: 100%; max-height: 100%; object-fit: contain; }
                    .school-info { flex: 1; min-width: 0; }
                    .school-name { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 3px; letter-spacing: -0.3px; line-height: 1.2; }
                    .school-details { font-size: 8px; color: #64748b; line-height: 1.3; }

                    .receipt-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: #f1f5f9; padding: 6px 10px; border-radius: 4px; border-left: 2px solid #2563eb; }
                    .receipt-title { font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; }
                    .receipt-number { font-size: 9px; font-weight: 600; color: #475569; }

                    .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
                    .section-title { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
                    .info-row { display: flex; margin-bottom: 4px; }
                    .label { width: 70px; font-size: 8px; font-weight: 500; color: #64748b; }
                    .value { flex: 1; font-size: 9px; font-weight: 600; color: #0f172a; }

                    .amount-section { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; text-align: center; margin-bottom: 20px; }
                    .amount-label { font-size: 8px; font-weight: 600; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
                    .amount-value { font-size: 20px; font-weight: 800; color: #1e40af; }

                    /* Signatures — flex-end ensures both sig-lines are always flush at bottom */
                    .signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; padding: 0 10px; }
                    .sig-block { text-align: center; display: flex; flex-direction: column; align-items: center; }
                    /* Fixed-height space above line — same for both sides regardless of image */
                    .sig-space { width: 120px; height: 56px; }
                    .sig-image { width: 120px; height: 56px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 0; }
                    .sig-image img { max-width: 100%; max-height: 100%; object-fit: contain; }
                    .sig-line { width: 120px; border-top: 1.5px solid #64748b; margin-top: 0; }
                    .sig-text { font-size: 8px; font-weight: 600; color: #475569; margin-top: 4px; }

                    .footer { margin-top: 16px; text-align: center; font-size: 7px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }

                    /* Toolbar — hidden on print */
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        @page { size: A5; margin: 10mm; }
                        .container { padding: 0; max-width: 100%; }
                        .toolbar { display: none !important; }
                        .page-body { padding-top: 0 !important; }
                    }
                    .toolbar {
                        position: fixed; top: 0; left: 0; right: 0;
                        background: #1e293b; color: white;
                        padding: 10px 20px; display: flex; gap: 10px; align-items: center;
                        z-index: 999; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        font-family: 'Inter', sans-serif;
                    }
                    .toolbar-title { flex: 1; font-size: 13px; font-weight: 600; }
                    .btn { padding: 7px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; font-family: 'Inter', sans-serif; transition: opacity 0.2s; }
                    .btn:hover { opacity: 0.85; }
                    .btn-print { background: #3b82f6; color: white; }
                    .btn-close { background: #64748b; color: white; }
                    .page-body { padding-top: 54px; }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <span class="toolbar-title">📄 Receipt #${payment.receiptNumber}</span>
                    <button class="btn btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
                    <button class="btn btn-close" onclick="window.close()">✕ Close</button>
                </div>
                <div class="page-body">
                <div class="container">
                    <div class="header">
                        <div class="logo-container">
                            ${logoUrl ? `<img src="${logoUrl}" class="logo">` : '<span style="font-size: 30px; color: #cbd5e1;">🏫</span>'}
                        </div>
                        <div class="school-info">
                            <div class="school-name">${school.schoolName}</div>
                            <div class="school-details">${school.fullAddress || school.address?.city || ''}</div>
                            <div class="school-details">Ph: ${school.phone || '-'} | ${school.email}</div>
                            <div class="school-details">School Code: ${school.schoolCode || '-'} | UDISE: ${school.udiseCode || '-'}</div>
                        </div>
                    </div>

                    <div class="receipt-meta">
                        <div class="receipt-title">Payment Receipt</div>
                        <div class="receipt-number">#${payment.receiptNumber}</div>
                    </div>

                    <div class="grid-container">
                        <div class="info-column">
                            <div class="section-title">Details</div>
                            <div class="info-row"><div class="label">Date</div><div class="value">${new Date(payment.paymentDate).toLocaleDateString('en-IN')}</div></div>
                            <div class="info-row"><div class="label">Mode</div><div class="value">${payment.paymentMethod}</div></div>
                            ${payment.transactionDetails?.referenceNumber ? `<div class="info-row"><div class="label">Ref. No</div><div class="value">${payment.transactionDetails.referenceNumber}</div></div>` : ''}
                            ${payment.invoiceId?.billingPeriod?.displayText ? `<div class="info-row"><div class="label">Period</div><div class="value" style="color: #2563eb; font-weight: 600;">${payment.invoiceId.billingPeriod.displayText}</div></div>` : ''}
                            <div class="info-row"><div class="label">Status</div><div class="value" style="color: #16a34a">Paid</div></div>
                        </div>
                        <div class="info-column">
                            <div class="section-title">Student</div>
                            <div class="info-row"><div class="label">Name</div><div class="value">${studentName}</div></div>
                            <div class="info-row"><div class="label">Adm. No</div><div class="value">${studentAdmNo}</div></div>
                            <div class="info-row"><div class="label">Class</div><div class="value">${studentClass}${studentSection ? ` (${studentSection})` : ''}</div></div>
                        </div>
                    </div>

                    <div class="amount-section">
                        <div class="amount-label">Total Amount Paid</div>
                        <div class="amount-value">₹${payment.amount.toLocaleString('en-IN')}</div>
                    </div>

                    <div class="signatures">
                        <div class="sig-block">
                            <div class="sig-space"></div>
                            <div class="sig-line"></div>
                            <div class="sig-text">Depositor</div>
                        </div>
                        <div class="sig-block">
                            ${signatureUrl
                ? `<div class="sig-image"><img src="${signatureUrl}" alt="Principal Signature" /></div>`
                : '<div class="sig-space"></div>'
            }
                            <div class="sig-line"></div>
                            <div class="sig-text">Authorized</div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Computer-generated receipt. Valid without physical signature.</p>
                    </div>
                </div>
                </div>
            </body>
            </html>
        `
    }

    // Opens receipt in a new browser tab (view mode)
    const handleViewReceipt = async (paymentId) => {
        try {
            const toastId = toast.loading('Loading receipt...')
            const { payment, school } = await getReceiptData(paymentId)
            toast.dismiss(toastId)

            const html = buildReceiptHtml(payment, school)
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
            const blobUrl = URL.createObjectURL(blob)
            const w = window.open(blobUrl, '_blank')
            if (!w) {
                // If popup still blocked, fall back to download
                toast.error('Could not open tab — downloading instead')
                handleDownloadReceipt(paymentId)
            }
            setTimeout(() => URL.revokeObjectURL(blobUrl), 120000)
        } catch (error) {
            console.error('View receipt error:', error)
            toast.error('Failed to load receipt')
        }
    }

    // Directly downloads receipt as HTML file (no popup)
    const handleDownloadReceipt = async (paymentId) => {
        try {
            const toastId = toast.loading('Preparing download...')
            const { payment, school } = await getReceiptData(paymentId)
            toast.dismiss(toastId)

            const html = buildReceiptHtml(payment, school)
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
            const blobUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = blobUrl
            a.download = `Receipt-${payment.receiptNumber}.html`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
            toast.success(`Receipt ${payment.receiptNumber} downloaded!`)
        } catch (error) {
            console.error('Download receipt error:', error)
            toast.error('Failed to download receipt')
        }
    }

    // Keep old name as alias so other call-sites still work
    const handlePrintReceipt = async (paymentId) => {
        try {
            const toastId = toast.loading('Generating receipt...')
            const response = await paymentsService.getReceipt(paymentId)
            const { payment, school } = response.data

            toast.dismiss(toastId)

            // Helper to get full Logo URL
            const getLogoUrl = (url) => {
                if (!url) return null
                let fullUrl = url
                if (!url.startsWith('http')) {
                    fullUrl = `${SERVER_URL}${url}`
                }
                return encodeURI(fullUrl)
            }
            const logoUrl = getLogoUrl(school.logo)
            const signatureUrl = getLogoUrl(school.principalSignature)

            // Resolve student name from all possible fields
            const studentName = payment.studentId?.name || payment.studentId?.fullName || 'N/A'
            const studentAdmNo = payment.studentId?.admissionNumber || payment.studentId?.studentId || '-'
            const studentClass = payment.studentId?.classId?.name || payment.studentId?.class || '-'
            const studentSection = payment.studentId?.section || ''

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Receipt #${payment.receiptNumber}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; color: #1e293b; -webkit-print-color-adjust: exact; }
                        .container { max-width: 420px; margin: 0 auto; padding: 15px; }
                        
                        /* Header Section */
                        .header { display: flex; align-items: center; gap: 10px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; }
                        .logo-container { width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-radius: 6px; flex-shrink: 0; }
                        .logo { max-width: 100%; max-height: 100%; object-fit: contain; }
                        .school-info { flex: 1; min-width: 0; }
                        .school-name { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 3px; letter-spacing: -0.3px; line-height: 1.2; }
                        .school-details { font-size: 8px; color: #64748b; line-height: 1.3; }

                        /* Receipt Title & Meta */
                        .receipt-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: #f1f5f9; padding: 6px 10px; border-radius: 4px; border-left: 2px solid #2563eb; }
                        .receipt-title { font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; }
                        .receipt-number { font-size: 9px; font-weight: 600; color: #475569; }

                        /* Info Grid */
                        .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
                        .section-title { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
                        .info-row { display: flex; margin-bottom: 4px; }
                        .label { width: 70px; font-size: 8px; font-weight: 500; color: #64748b; }
                        .value { flex: 1; font-size: 9px; font-weight: 600; color: #0f172a; }

                        /* Amount Section */
                        .amount-section { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; text-align: center; margin-bottom: 15px; }
                        .amount-label { font-size: 8px; font-weight: 600; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
                        .amount-value { font-size: 20px; font-weight: 800; color: #1e40af; }
                        
                        /* Signature Section */
                        .signatures { display: flex; justify-content: space-between; margin-top: 15px; padding: 0 10px; }
                        .sig-block { text-align: center; }
                        /* Empty space above depositor line for actual signature */
                        .sig-space { width: 110px; height: 52px; margin-bottom: 4px; display: block; }
                        .sig-line { width: 110px; border-top: 1.5px solid #94a3b8; margin: 0 auto 4px auto; }
                        .sig-image { width: 110px; height: 44px; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center; }
                        .sig-image img { max-width: 100%; max-height: 100%; object-fit: contain; }
                        .sig-text { font-size: 8px; font-weight: 600; color: #475569; }

                        .footer { margin-top: 12px; text-align: center; font-size: 7px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
                        
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            @page { size: A5; margin: 10mm; }
                            .container { padding: 0; max-width: 100%; }
                            .toolbar { display: none !important; }
                            .page-body { padding-top: 0 !important; }
                        }

                        /* Toolbar */
                        .toolbar { 
                            position: fixed; top: 0; left: 0; right: 0; 
                            background: #1e293b; color: white; 
                            padding: 10px 20px; display: flex; gap: 10px; align-items: center;
                            z-index: 999; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                            font-family: 'Inter', sans-serif;
                        }
                        .toolbar-title { flex: 1; font-size: 13px; font-weight: 600; }
                        .btn { 
                            padding: 7px 18px; border: none; border-radius: 6px; 
                            cursor: pointer; font-size: 12px; font-weight: 600; font-family: 'Inter', sans-serif;
                            transition: opacity 0.2s;
                        }
                        .btn:hover { opacity: 0.85; }
                        .btn-print { background: #3b82f6; color: white; }
                        .btn-close { background: #64748b; color: white; }
                        .page-body { padding-top: 52px; }
                    </style>
                </head>
                <body>
                    <div class="toolbar">
                        <span class="toolbar-title">📄 Receipt #${payment.receiptNumber}</span>
                        <button class="btn btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
                        <button class="btn btn-close" onclick="window.close()">✕ Close</button>
                    </div>
                    <div class="page-body">
                    <div class="container">
                        <div class="header">
                            <div class="logo-container">
                                ${logoUrl ? `<img src="${logoUrl}" class="logo">` : '<span style="font-size: 30px; color: #cbd5e1;">🏫</span>'}
                            </div>
                            <div class="school-info">
                                <div class="school-name">${school.schoolName}</div>
                                <div class="school-details">${school.fullAddress || school.address?.city || ''}</div>
                                <div class="school-details">Ph: ${school.phone || '-'} | ${school.email}</div>
                                <div class="school-details">School Code: ${school.schoolCode || '-'} | UDISE: ${school.udiseCode || '-'}</div>
                            </div>
                        </div>

                        <div class="receipt-meta">
                            <div class="receipt-title">Payment Receipt</div>
                            <div class="receipt-number">#${payment.receiptNumber}</div>
                        </div>

                        <div class="grid-container">
                            <div class="info-column">
                                <div class="section-title">Details</div>
                                <div class="info-row"><div class="label">Date</div><div class="value">${new Date(payment.paymentDate).toLocaleDateString('en-IN')}</div></div>
                                <div class="info-row"><div class="label">Mode</div><div class="value">${payment.paymentMethod}</div></div>
                                ${payment.transactionDetails?.referenceNumber ? `<div class="info-row"><div class="label">Ref. No</div><div class="value">${payment.transactionDetails.referenceNumber}</div></div>` : ''}
                                ${payment.invoiceId?.billingPeriod?.displayText ? `<div class="info-row"><div class="label">Period</div><div class="value" style="color: #2563eb; font-weight: 600;">${payment.invoiceId.billingPeriod.displayText}</div></div>` : ''}
                                <div class="info-row"><div class="label">Status</div><div class="value" style="color: #16a34a">Paid</div></div>
                            </div>
                            <div class="info-column">
                                <div class="section-title">Student</div>
                                <div class="info-row"><div class="label">Name</div><div class="value">${studentName}</div></div>
                                <div class="info-row"><div class="label">Adm. No</div><div class="value">${studentAdmNo}</div></div>
                                <div class="info-row"><div class="label">Class</div><div class="value">${studentClass}${studentSection ? ` (${studentSection})` : ''}</div></div>
                            </div>
                        </div>

                        <div class="amount-section">
                            <div class="amount-label">Total Amount Paid</div>
                            <div class="amount-value">₹${payment.amount.toLocaleString('en-IN')}</div>
                        </div>

                        <div class="signatures">
                            <div class="sig-block">
                                <div class="sig-space"></div>
                                <div class="sig-line"></div>
                                <div class="sig-text">Depositor</div>
                            </div>
                            <div class="sig-block">
                                ${signatureUrl
                    ? `<div class="sig-image"><img src="${signatureUrl}" alt="Principal Signature" /></div>`
                    : '<div class="sig-space"></div>'
                }
                                <div class="sig-line"></div>
                                <div class="sig-text">Authorized</div>
                            </div>
                        </div>

                        <div class="footer">
                            <p>Computer-generated receipt. Valid without physical signature.</p>
                        </div>
                    </div>
                    </div>
                </body>
                </html>
            `

            // Use Blob URL — avoids popup blocker that triggers on window.open('')
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
            const blobUrl = URL.createObjectURL(blob)
            const receiptWindow = window.open(blobUrl, '_blank')

            if (!receiptWindow) {
                // Fallback: directly download as an HTML file the user can open & print
                const a = document.createElement('a')
                a.href = blobUrl
                a.download = `Receipt-${payment.receiptNumber}.html`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                toast.success('Receipt downloaded! Open the file to print.')
            }

            // Clean up blob URL after 2 minutes
            setTimeout(() => URL.revokeObjectURL(blobUrl), 120000)
        } catch (error) {
            console.error('Receipt print error:', error)
            toast.error('Failed to load receipt details')
        }
    }

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
        { id: 'feeStructure', label: 'Fee Structure', icon: Settings },
        { id: 'invoices', label: 'Generate Invoices', icon: Receipt },
        { id: 'collect', label: 'Collect Payment', icon: DollarSign },
        { id: 'defaulters', label: 'Defaulters', icon: AlertCircle },
        { id: 'receipts', label: 'Receipts', icon: FileText },
        { id: 'disputes', label: 'Disputes & Alerts', icon: AlertTriangle },
        { id: 'reports', label: 'Reports', icon: History }
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
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dashboardData.recentPayments.map((payment) => (
                                                <tr key={payment._id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-primary-600">
                                                        {payment.receiptNumber}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {payment.studentId?.name || payment.studentId?.fullName || 'N/A'}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {payment.studentId?.admissionNumber || payment.studentId?.studentId || ''}
                                                        </div>
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
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex justify-end items-center gap-3">
                                                            <button
                                                                onClick={() => handleViewReceipt(payment._id)}
                                                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                                                                title="View Receipt"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadReceipt(payment._id)}
                                                                className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
                                                                title="Download Receipt"
                                                            >
                                                                <Printer className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Recent Invoices */}
                        {dashboardData.recentInvoices && dashboardData.recentInvoices.length > 0 && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Invoices</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice No.</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dashboardData.recentInvoices.map((invoice) => (
                                                <tr key={invoice._id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-primary-600">
                                                        {invoice.invoiceNumber}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {invoice.studentId?.fullName || invoice.studentId?.name || `Student ${invoice.studentId?.admissionNumber || invoice.studentId?.studentId || ''}`}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {invoice.studentId?.admissionNumber || invoice.studentId?.studentId || invoice.studentId?.phone || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                        {invoice.classId?.name || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                        {formatCurrency(invoice.totalAmount)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                                            invoice.status === 'Partial' ? 'bg-orange-100 text-orange-800' :
                                                                invoice.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                                                                    'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                            {invoice.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {new Date(invoice.dueDate).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => setEditingInvoice(invoice)}
                                                                className="text-blue-600 hover:text-blue-900 transition-colors"
                                                                title="Edit Invoice"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteInvoice(invoice._id)}
                                                                className="text-red-600 hover:text-red-900 transition-colors"
                                                                title="Delete Invoice"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
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


                            <div className="border border-red-200 bg-red-50 rounded-lg p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-red-100 rounded-full">
                                        <Trash2 className="h-6 w-6 text-red-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">Bulk Delete</h4>
                                        <p className="text-sm text-gray-600">Delete pending invoices for class</p>
                                    </div>
                                </div>
                                <BulkDeleteInvoiceForm
                                    classes={classes}
                                    activeSession={activeSession}
                                    onSuccess={() => {
                                        if (activeTab === 'dashboard') fetchDashboard()
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* COLLECT PAYMENT TAB */}
                {activeTab === 'collect' && (
                    <div className="space-y-6">
                        {/* Header with Instructions */}
                        <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-6 border border-primary-100">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-primary-100 rounded-full">
                                    <DollarSign className="h-6 w-6 text-primary-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Collect Fee Payment</h3>
                                    <p className="text-sm text-gray-600 mb-3">
                                        Search for a student by name, admission number, or phone number to view their pending invoices and collect payment.
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                                            Step 1: Search student
                                        </span>
                                        <span>→</span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                                            Step 2: Select invoice
                                        </span>
                                        <span>→</span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                                            Step 3: Collect payment
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        {dashboardData && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-medium text-gray-600 uppercase">Pending Dues</p>
                                            <p className="text-xl font-bold text-yellow-600 mt-1">
                                                {formatCurrency(dashboardData.summary.totalPending)}
                                            </p>
                                        </div>
                                        <div className="p-2 bg-yellow-100 rounded-lg">
                                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-medium text-gray-600 uppercase">Overdue Amount</p>
                                            <p className="text-xl font-bold text-red-600 mt-1">
                                                {formatCurrency(dashboardData.summary.totalOverdue)}
                                            </p>
                                        </div>
                                        <div className="p-2 bg-red-100 rounded-lg">
                                            <AlertCircle className="h-5 w-5 text-red-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-medium text-gray-600 uppercase">This Month</p>
                                            <p className="text-xl font-bold text-green-600 mt-1">
                                                {formatCurrency(dashboardData.summary.thisMonthCollection)}
                                            </p>
                                        </div>
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <TrendingUp className="h-5 w-5 text-green-600" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Student Search Section */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Search className="h-5 w-5 text-gray-500" />
                                Search Student
                            </h4>
                            <StudentSearch onSelectStudent={handleSelectStudent} />

                            {selectedStudent && (
                                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm font-medium text-blue-900">Selected Student:</p>
                                    <p className="text-lg font-bold text-blue-700">{selectedStudent.name}</p>
                                    <p className="text-sm text-blue-600">ID: {selectedStudent.studentId}</p>
                                </div>
                            )}

                            {!selectedStudent && (
                                <div className="mt-6 text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-600 font-medium">No student selected</p>
                                    <p className="text-sm text-gray-500 mt-1">Search and select a student to view their pending invoices</p>
                                </div>
                            )}
                        </div>
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
                                                    <div className="text-sm font-medium text-gray-900">{defaulter.studentId?.fullName || defaulter.studentId?.name || 'Unknown Student'}</div>
                                                    <div className="text-xs text-gray-500">{defaulter.studentId?.admissionNumber || defaulter.studentId?.studentId}</div>
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

                {/* RECEIPTS TAB */}
                {activeTab === 'receipts' && (
                    <div className="space-y-4">
                        {/* Filter Bar */}
                        <div className="bg-white rounded-lg shadow-sm p-4">
                            <div className="flex flex-wrap gap-3 items-end">
                                {/* Search */}
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Search (name / receipt no. / adm. no.)</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            value={receiptFilters.search}
                                            onChange={e => {
                                                const updated = { ...receiptFilters, search: e.target.value }
                                                setReceiptFilters(updated)
                                                fetchReceipts(updated)
                                            }}
                                            className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary-300"
                                        />
                                    </div>
                                </div>

                                {/* Payment Method */}
                                <div className="min-w-[150px]">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                                    <select
                                        value={receiptFilters.paymentMethod}
                                        onChange={e => {
                                            const updated = { ...receiptFilters, paymentMethod: e.target.value }
                                            setReceiptFilters(updated)
                                            fetchReceipts(updated)
                                        }}
                                        className="border border-gray-200 rounded-lg text-sm py-2 px-3 w-full focus:outline-none focus:ring-2 focus:ring-primary-300"
                                    >
                                        <option value="">All Methods</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Online">Online</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                        <option value="DD">DD</option>
                                    </select>
                                </div>

                                {/* From Date */}
                                <div className="min-w-[140px]">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                                    <input
                                        type="date"
                                        value={receiptFilters.startDate}
                                        onChange={e => {
                                            const updated = { ...receiptFilters, startDate: e.target.value }
                                            setReceiptFilters(updated)
                                            fetchReceipts(updated)
                                        }}
                                        className="border border-gray-200 rounded-lg text-sm py-2 px-3 w-full focus:outline-none focus:ring-2 focus:ring-primary-300"
                                    />
                                </div>

                                {/* To Date */}
                                <div className="min-w-[140px]">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                                    <input
                                        type="date"
                                        value={receiptFilters.endDate}
                                        onChange={e => {
                                            const updated = { ...receiptFilters, endDate: e.target.value }
                                            setReceiptFilters(updated)
                                            fetchReceipts(updated)
                                        }}
                                        className="border border-gray-200 rounded-lg text-sm py-2 px-3 w-full focus:outline-none focus:ring-2 focus:ring-primary-300"
                                    />
                                </div>

                                {/* Clear */}
                                <div>
                                    <button
                                        onClick={() => {
                                            const cleared = { search: '', paymentMethod: '', startDate: '', endDate: '' }
                                            setReceiptFilters(cleared)
                                            fetchReceipts(cleared)
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                                    >
                                        <X className="h-3.5 w-3.5" /> Clear
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Receipts Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary-500" />
                                    All Receipts
                                    {!receiptsLoading && (
                                        <span className="ml-1 text-xs font-normal text-gray-400">({allReceipts.length} found)</span>
                                    )}
                                </h3>
                            </div>

                            {receiptsLoading ? (
                                <div className="flex justify-center items-center py-16">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : allReceipts.length === 0 ? (
                                <div className="text-center py-16">
                                    <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No receipts found</p>
                                    <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt No.</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                                                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {allReceipts.map((payment) => (
                                                <tr key={payment._id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-5 py-3 whitespace-nowrap">
                                                        <span className="text-sm font-mono font-semibold text-primary-600">{payment.receiptNumber}</span>
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {payment.studentId?.name || payment.studentId?.fullName || 'N/A'}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {payment.studentId?.admissionNumber || payment.studentId?.studentId || ''}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                                                        {payment.studentId?.classId?.name || payment.studentId?.class || '-'}
                                                        {payment.studentId?.section ? ` (${payment.studentId.section})` : ''}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap">
                                                        <span className="text-sm font-semibold text-green-700">{formatCurrency(payment.amount)}</span>
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap">
                                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-medium">{payment.paymentMethod}</span>
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {new Date(payment.paymentDate).toLocaleDateString('en-IN')}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap text-right">
                                                        <div className="flex justify-end items-center gap-3">
                                                            <button
                                                                onClick={() => handleViewReceipt(payment._id)}
                                                                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                                                                title="View Receipt"
                                                            >
                                                                <FileText className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadReceipt(payment._id)}
                                                                className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors"
                                                                title="Download Receipt"
                                                            >
                                                                <Printer className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* DISPUTES & ALERTS TAB */}
                {activeTab === 'disputes' && (
                    <div className="space-y-6">
                        {disputesLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
                            </div>
                        ) : (
                            <>
                                {/* Stuck Payments Alert */}
                                {disputesData.stuckPayments?.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                            <div>
                                                <h3 className="text-sm font-semibold text-amber-900">Stuck Payments ({disputesData.stuckPayments.length})</h3>
                                                <p className="text-xs text-amber-700 mt-0.5">These payments have been PENDING for more than 1 hour and may need attention.</p>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-xs font-medium text-amber-800 uppercase tracking-wide border-b border-amber-200">
                                                        <th className="pb-2 pr-4">Student</th>
                                                        <th className="pb-2 pr-4">Invoice</th>
                                                        <th className="pb-2 pr-4">Amount</th>
                                                        <th className="pb-2">Since</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-amber-100">
                                                    {disputesData.stuckPayments.map(p => (
                                                        <tr key={p._id} className="py-2">
                                                            <td className="py-2 pr-4 font-medium text-gray-900">
                                                                {p.studentId?.fullName || p.studentId?.name || 'N/A'}
                                                            </td>
                                                            <td className="py-2 pr-4 text-gray-600">
                                                                {p.invoiceId?.invoiceNumber || '-'}
                                                            </td>
                                                            <td className="py-2 pr-4 text-gray-800 font-mono">
                                                                {formatCurrency(p.amount)}
                                                            </td>
                                                            <td className="py-2 text-gray-500 text-xs">
                                                                {new Date(p.createdAt).toLocaleString('en-IN')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Active Disputes */}
                                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                            <h3 className="font-semibold text-gray-900">Active Disputes</h3>
                                            {disputesData.disputes?.length > 0 && (
                                                <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
                                                    {disputesData.disputes.length}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={fetchDisputes}
                                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                                        >
                                            Refresh
                                        </button>
                                    </div>

                                    {disputesData.disputes?.length === 0 ? (
                                        <div className="text-center py-16">
                                            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-600 font-medium">No active disputes</p>
                                            <p className="text-sm text-gray-400 mt-1">All payment disputes have been resolved</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100">
                                            {disputesData.disputes.map(dispute => (
                                                <div key={dispute._id} className="px-6 py-5">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-semibold text-gray-900">
                                                                    {dispute.studentId?.fullName || dispute.studentId?.name || 'N/A'}
                                                                </span>
                                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${dispute.status === 'RAISED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                                                    }`}>
                                                                    {dispute.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                Invoice: <span className="font-mono font-medium">{dispute.invoiceId?.invoiceNumber || '-'}</span>
                                                                {dispute.invoiceId?.totalAmount && (
                                                                    <> · {formatCurrency(dispute.invoiceId.totalAmount)}</>
                                                                )}
                                                            </p>
                                                            {dispute.reason && (
                                                                <p className="text-sm text-gray-500 mt-1 italic">"{dispute.reason}"</p>
                                                            )}
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                Raised {new Date(dispute.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setResolvingDispute(dispute._id)
                                                                setResolveForm({ action: 'APPROVE', note: '' })
                                                            }}
                                                            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                                                        >
                                                            Resolve
                                                        </button>
                                                    </div>

                                                    {/* Inline resolve form */}
                                                    {resolvingDispute === dispute._id && (
                                                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                            <p className="text-sm font-medium text-gray-700 mb-3">Resolve Dispute</p>
                                                            <div className="flex gap-3 mb-3">
                                                                <button
                                                                    onClick={() => setResolveForm(f => ({ ...f, action: 'APPROVE' }))}
                                                                    className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${resolveForm.action === 'APPROVE'
                                                                            ? 'border-green-500 bg-green-50 text-green-700'
                                                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                                                        }`}
                                                                >
                                                                    ✓ Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => setResolveForm(f => ({ ...f, action: 'REJECT' }))}
                                                                    className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${resolveForm.action === 'REJECT'
                                                                            ? 'border-red-500 bg-red-50 text-red-700'
                                                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                                                        }`}
                                                                >
                                                                    ✗ Reject
                                                                </button>
                                                            </div>
                                                            <textarea
                                                                value={resolveForm.note}
                                                                onChange={e => setResolveForm(f => ({ ...f, note: e.target.value }))}
                                                                placeholder="Admin note (required)..."
                                                                rows={2}
                                                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                                            />
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    onClick={() => setResolvingDispute(null)}
                                                                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    onClick={() => handleResolveDispute(dispute._id)}
                                                                    className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                                                                >
                                                                    Confirm
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
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
            {
                showFeeStructureModal && (
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
                )
            }

            {/* Individual Invoice Modal */}
            {
                showInvoiceModal && (
                    <IndividualInvoiceModal
                        feeStructures={feeStructures}
                        activeSession={activeSession}
                        onClose={() => setShowInvoiceModal(false)}
                        onSuccess={() => {
                            setShowInvoiceModal(false)
                            toast.success('Invoice generated successfully')
                        }}
                    />
                )
            }

            {/* Payment Modal */}
            {
                showPaymentModal && (
                    <PaymentModal
                        student={selectedStudent}
                        invoices={studentInvoices}
                        payments={studentPayments}
                        onPrintReceipt={handlePrintReceipt}
                        onClose={() => {
                            setShowPaymentModal(false)
                            setSelectedStudent(null)
                            setStudentInvoices([])
                            setStudentPayments([])
                        }}
                        onSuccess={() => {
                            setShowPaymentModal(false)
                            setSelectedStudent(null)
                            setStudentInvoices([])
                            if (activeTab === 'dashboard') fetchDashboard()
                            toast.success('Payment collected successfully')
                        }}
                    />
                )
            }

            {/* Edit Invoice Modal */}
            {
                editingInvoice && (
                    <EditInvoiceModal
                        invoice={editingInvoice}
                        onClose={() => setEditingInvoice(null)}
                        onSuccess={() => {
                            setEditingInvoice(null)
                            if (activeTab === 'dashboard') fetchDashboard()
                        }}
                    />
                )
            }
        </div >
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
                    placeholder="Search by name, admission number, phone..."
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
                            <div className="font-medium text-gray-900">{student.fullName || student.name}</div>
                            <div className="text-sm text-gray-600">
                                Admission: {student.admissionNumber || student.studentId || 'N/A'} | Class: {student.classId?.name || student.class || 'N/A'}
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

            // Clean up the form data - convert empty sectionId to null
            const formData = {
                ...form,
                sectionId: form.sectionId || null
            }

            if (feeStructure) {
                await feeStructuresService.update(feeStructure._id, formData)
            } else {
                await feeStructuresService.create(formData)
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
        dueDate: '',
        billingMonth: new Date().getMonth() + 1,
        billingQuarter: Math.ceil((new Date().getMonth() + 1) / 3),
        billingYear: new Date().getFullYear()
    })
    const [isSaving, setIsSaving] = useState(false)

    // Get selected fee structure to determine frequency
    const selectedFeeStructure = feeStructures.find(fs => fs._id === form.feeStructureId)
    const rawFrequency = selectedFeeStructure?.feeHeads?.[0]?.frequency || 'One-time'
    // Normalize frequency to title case for consistent comparison
    const feeFrequency = rawFrequency.charAt(0).toUpperCase() + rawFrequency.slice(1).toLowerCase()

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

            // Build billing period based on frequency
            let billingPeriod = null
            if (feeFrequency === 'Monthly') {
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December']
                billingPeriod = {
                    month: form.billingMonth,
                    year: form.billingYear,
                    displayText: `${monthNames[form.billingMonth - 1]} ${form.billingYear}`
                }
            } else if (feeFrequency === 'Quarterly') {
                const quarterMonths = {
                    1: 'Jan-Mar',
                    2: 'Apr-Jun',
                    3: 'Jul-Sep',
                    4: 'Oct-Dec'
                }
                billingPeriod = {
                    quarter: form.billingQuarter,
                    year: form.billingYear,
                    displayText: `Q${form.billingQuarter} ${form.billingYear} (${quarterMonths[form.billingQuarter]})`
                }
            } else if (feeFrequency === 'Annual') {
                billingPeriod = {
                    year: form.billingYear,
                    displayText: `Academic Year ${form.billingYear}-${form.billingYear + 1}`
                }
            }

            await invoicesService.generate({
                studentId: selectedStudent._id,
                feeStructureId: form.feeStructureId,
                dueDate: form.dueDate,
                academicSessionId: activeSession._id,
                billingPeriod
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
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                                    <p className="text-xs text-blue-600">
                                        Admission: {selectedStudent.admissionNumber || selectedStudent.studentId || 'N/A'} | Class: {selectedStudent.classId?.name || selectedStudent.class || 'N/A'}
                                    </p>
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

                        {/* Billing Period Selection */}
                        {form.feeStructureId && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                                <label className="block text-sm font-semibold text-blue-900">
                                    Billing Period ({feeFrequency})
                                </label>

                                {feeFrequency === 'Monthly' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
                                            <select
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                value={form.billingMonth}
                                                onChange={(e) => setForm({ ...form, billingMonth: parseInt(e.target.value) })}
                                            >
                                                <option value="1">January</option>
                                                <option value="2">February</option>
                                                <option value="3">March</option>
                                                <option value="4">April</option>
                                                <option value="5">May</option>
                                                <option value="6">June</option>
                                                <option value="7">July</option>
                                                <option value="8">August</option>
                                                <option value="9">September</option>
                                                <option value="10">October</option>
                                                <option value="11">November</option>
                                                <option value="12">December</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                                            <input
                                                type="number"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                value={form.billingYear}
                                                onChange={(e) => setForm({ ...form, billingYear: parseInt(e.target.value) })}
                                                min="2020"
                                                max="2050"
                                            />
                                        </div>
                                    </div>
                                )}

                                {feeFrequency === 'Quarterly' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Quarter</label>
                                            <select
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                value={form.billingQuarter}
                                                onChange={(e) => setForm({ ...form, billingQuarter: parseInt(e.target.value) })}
                                            >
                                                <option value="1">Q1 (Jan-Mar)</option>
                                                <option value="2">Q2 (Apr-Jun)</option>
                                                <option value="3">Q3 (Jul-Sep)</option>
                                                <option value="4">Q4 (Oct-Dec)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                                            <input
                                                type="number"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                value={form.billingYear}
                                                onChange={(e) => setForm({ ...form, billingYear: parseInt(e.target.value) })}
                                                min="2020"
                                                max="2050"
                                            />
                                        </div>
                                    </div>
                                )}

                                {feeFrequency === 'Annual' && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Academic Year</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                            value={form.billingYear}
                                            onChange={(e) => setForm({ ...form, billingYear: parseInt(e.target.value) })}
                                            min="2020"
                                            max="2050"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Will show as: Academic Year {form.billingYear}-{form.billingYear + 1}
                                        </p>
                                    </div>
                                )}

                                {feeFrequency === 'One-time' && (
                                    <p className="text-sm text-gray-600">No billing period needed for one-time fees</p>
                                )}
                            </div>
                        )}

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
        dueDate: '',
        billingMonth: new Date().getMonth() + 1, // 1-12
        billingQuarter: Math.ceil((new Date().getMonth() + 1) / 3), // 1-4
        billingYear: new Date().getFullYear()
    })
    const [isSaving, setIsSaving] = useState(false)

    // Get selected fee structure to determine frequency
    const selectedFeeStructure = feeStructures.find(fs => fs._id === form.feeStructureId)
    const rawFrequency = selectedFeeStructure?.feeHeads?.[0]?.frequency || 'One-time'
    // Normalize frequency to title case for consistent comparison
    const feeFrequency = rawFrequency.charAt(0).toUpperCase() + rawFrequency.slice(1).toLowerCase()

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!form.classId || !form.feeStructureId || !form.dueDate) {
            toast.error('Please fill all fields')
            return
        }

        console.log('=== BULK INVOICE FRONTEND ===');
        console.log('Sending classId:', form.classId);
        console.log('Sending feeStructureId:', form.feeStructureId);
        console.log('Sending dueDate:', form.dueDate);
        console.log('Active session ID:', activeSession._id);

        try {
            setIsSaving(true)

            // Build billing period based on frequency
            let billingPeriod = null
            if (feeFrequency === 'Monthly') {
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December']
                billingPeriod = {
                    month: form.billingMonth,
                    year: form.billingYear,
                    displayText: `${monthNames[form.billingMonth - 1]} ${form.billingYear}`
                }
            } else if (feeFrequency === 'Quarterly') {
                const quarterMonths = {
                    1: 'Jan-Mar',
                    2: 'Apr-Jun',
                    3: 'Jul-Sep',
                    4: 'Oct-Dec'
                }
                billingPeriod = {
                    quarter: form.billingQuarter,
                    year: form.billingYear,
                    displayText: `Q${form.billingQuarter} ${form.billingYear} (${quarterMonths[form.billingQuarter]})`
                }
            } else if (feeFrequency === 'Annual') {
                billingPeriod = {
                    year: form.billingYear,
                    displayText: `Academic Year ${form.billingYear}-${form.billingYear + 1}`
                }
            }

            await invoicesService.generateBulk({
                classId: form.classId,
                feeStructureId: form.feeStructureId,
                dueDate: form.dueDate,
                academicSessionId: activeSession._id,
                billingPeriod
            })

            setForm({
                classId: '',
                feeStructureId: '',
                dueDate: '',
                billingMonth: new Date().getMonth() + 1,
                billingQuarter: Math.ceil((new Date().getMonth() + 1) / 3),
                billingYear: new Date().getFullYear()
            })
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

            {/* Billing Period Selection - Show based on frequency */}
            {form.feeStructureId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <label className="block text-sm font-semibold text-blue-900">
                        Billing Period ({feeFrequency})
                    </label>

                    {feeFrequency === 'Monthly' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    value={form.billingMonth}
                                    onChange={(e) => setForm({ ...form, billingMonth: parseInt(e.target.value) })}
                                >
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10">October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    value={form.billingYear}
                                    onChange={(e) => setForm({ ...form, billingYear: parseInt(e.target.value) })}
                                    min="2020"
                                    max="2050"
                                />
                            </div>
                        </div>
                    )}

                    {feeFrequency === 'Quarterly' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Quarter</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    value={form.billingQuarter}
                                    onChange={(e) => setForm({ ...form, billingQuarter: parseInt(e.target.value) })}
                                >
                                    <option value="1">Q1 (Jan-Mar)</option>
                                    <option value="2">Q2 (Apr-Jun)</option>
                                    <option value="3">Q3 (Jul-Sep)</option>
                                    <option value="4">Q4 (Oct-Dec)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    value={form.billingYear}
                                    onChange={(e) => setForm({ ...form, billingYear: parseInt(e.target.value) })}
                                    min="2020"
                                    max="2050"
                                />
                            </div>
                        </div>
                    )}

                    {feeFrequency === 'Annual' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Academic Year</label>
                            <input
                                type="number"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                value={form.billingYear}
                                onChange={(e) => setForm({ ...form, billingYear: parseInt(e.target.value) })}
                                min="2020"
                                max="2050"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Will show as: Academic Year {form.billingYear}-{form.billingYear + 1}
                            </p>
                        </div>
                    )}

                    {feeFrequency === 'One-time' && (
                        <p className="text-sm text-gray-600">No billing period needed for one-time fees</p>
                    )}
                </div>
            )}

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
const PaymentModal = ({ student, invoices, payments = [], onPrintReceipt, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState('collect')
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
        // If no invoices, switch to history tab by default
        if (invoices.length === 0 && payments.length > 0) {
            setActiveTab('history')
        } else if (invoices.length > 0) {
            setActiveTab('collect')
            setSelectedInvoice(invoices[0])
            setForm(f => ({ ...f, amount: invoices[0].balanceAmount }))
        }
    }, [invoices, payments])

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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">Student Fees</h3>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        className={`flex-1 py-4 text-sm font-medium text-center border-b-2 ${activeTab === 'collect' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('collect')}
                    >
                        Collect Payment
                    </button>
                    <button
                        className={`flex-1 py-4 text-sm font-medium text-center border-b-2 ${activeTab === 'history' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('history')}
                    >
                        Payment History
                    </button>
                </div>

                {/* COLLECT TAB */}
                {activeTab === 'collect' && (
                    <div className="p-6">
                        {invoices.length === 0 ? (
                            <div className="text-center py-8">
                                <AlertCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Invoices</h3>
                                <p className="text-gray-600">This student has no pending dues.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Student Info */}
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm font-medium text-gray-600">Student</p>
                                    <p className="text-lg font-bold text-gray-900">{student.fullName || student.name}</p>
                                    <p className="text-sm text-gray-600">ID: {student.studentId || student.admissionNumber}</p>
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

                                <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50" disabled={isSaving}>
                                        {isSaving ? 'Processing...' : 'Collect Payment'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'history' && (
                    <div className="p-6">
                        {payments.length === 0 ? (
                            <div className="text-center py-8">
                                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No History</h3>
                                <p className="text-gray-600">No payment history found for this student.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {payments.map((payment) => (
                                    <div key={payment._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-gray-900">{formatCurrency(payment.amount)}</span>
                                                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Paid</span>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {new Date(payment.paymentDate).toLocaleDateString()} • {payment.paymentMethod}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">Receipt: {payment.receiptNumber}</div>
                                        </div>
                                        <button
                                            onClick={() => onPrintReceipt(payment._id)}
                                            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200"
                                            title="Print Receipt"
                                        >
                                            <Printer className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-6 flex justify-end pt-4 border-t border-gray-200">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// Bulk Delete Invoice Form Component
const BulkDeleteInvoiceForm = ({ classes, activeSession, onSuccess }) => {
    const [form, setForm] = useState({
        classId: '',
        sectionId: ''
    })
    const [isDeleting, setIsDeleting] = useState(false)
    const [isPreviewing, setIsPreviewing] = useState(false)
    const [previewCount, setPreviewCount] = useState(null) // null = not previewed yet

    // Reset preview when class changes
    const handleClassChange = (e) => {
        setForm({ ...form, classId: e.target.value, sectionId: '' })
        setPreviewCount(null)
    }

    const handlePreview = async () => {
        if (!form.classId) {
            toast.error('Please select a class')
            return
        }

        try {
            setIsPreviewing(true)
            const res = await invoicesService.list({
                classId: form.classId,
                academicSessionId: activeSession._id,
                status: 'Pending'
            })
            const invoices = res.data || []
            setPreviewCount(invoices.length)
        } catch (error) {
            console.error('Preview error:', error)
            toast.error('Failed to fetch invoice count')
        } finally {
            setIsPreviewing(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!form.classId) {
            toast.error('Please select a class')
            return
        }

        if (previewCount === null) {
            toast.error('Please preview first to see how many invoices will be deleted')
            return
        }

        if (previewCount === 0) {
            toast.error('No pending invoices found for this class')
            return
        }

        if (!window.confirm(`Are you sure you want to delete ${previewCount} pending invoice(s) for this class? This cannot be undone.`)) {
            return
        }

        try {
            setIsDeleting(true)
            await invoicesService.deleteBulk({
                classId: form.classId,
                sectionId: form.sectionId || undefined,
                academicSessionId: activeSession._id
            })

            toast.success(`Successfully deleted ${previewCount} pending invoice(s)`)
            setForm({ classId: '', sectionId: '' })
            setPreviewCount(null)
            onSuccess()
        } catch (error) {
            console.error('Bulk delete error:', error)
            toast.error(error.response?.data?.message || 'Failed to delete invoices')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    value={form.classId}
                    onChange={handleClassChange}
                    required
                >
                    <option value="">Select Class</option>
                    {classes.map((cls) => (
                        <option key={cls._id} value={cls._id}>{cls.name}</option>
                    ))}
                </select>
            </div>

            {/* Preview Button */}
            {form.classId && previewCount === null && (
                <button
                    type="button"
                    onClick={handlePreview}
                    disabled={isPreviewing}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2 border border-gray-300"
                >
                    {isPreviewing ? 'Checking...' : 'Preview Invoices to Delete'}
                </button>
            )}

            {/* Preview Result */}
            {previewCount !== null && (
                <div className={`rounded-lg p-4 border ${previewCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    {previewCount > 0 ? (
                        <div className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-800">
                                    {previewCount} pending invoice(s) will be deleted
                                </p>
                                <p className="text-xs text-red-600 mt-0.5">Only invoices with no payments will be removed</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm font-medium text-green-800">
                            ✓ No pending invoices found for this class
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => setPreviewCount(null)}
                        className="text-xs text-gray-500 underline mt-2 block"
                    >
                        Re-check
                    </button>
                </div>
            )}

            {/* Delete Button — only shown after preview with results */}
            {previewCount !== null && previewCount > 0 && (
                <button
                    type="submit"
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={isDeleting}
                >
                    <Trash2 className="h-4 w-4" />
                    {isDeleting ? 'Deleting...' : `Delete ${previewCount} Pending Invoice(s)`}
                </button>
            )}

            <p className="text-xs text-red-500 text-center">
                * Only pending invoices with no payments will be deleted.
            </p>
        </form>
    )
}

export default FeesFinance
