import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, User, Heart, GraduationCap, Users, FileText, Camera, Trash2, Loader2, Search, UserCheck, FileBadge, FileCheck } from 'lucide-react'
import api from '../../services/authService'
import studentsService from '../../services/studentsService'
import transportService from '../../services/transportService'
import { dedupeClassesByName, sortClassObjects } from '../../utils/classOrder'
import { SERVER_URL } from '../../constants/config'
import ImageCropModal from '../ImageCropModal'
import CameraCaptureModal from '../CameraCaptureModal'
import { useSettings } from '../../contexts/SettingsContext'

const currentYear = new Date().getFullYear()
const defaultAcademicYear = `${currentYear}-${currentYear + 1}`
const FALLBACK_ACADEMIC_YEAR = defaultAcademicYear

const StudentForm = ({ student, onSave, onCancel, isLoading }) => {
    const { settings } = useSettings()
    const schoolUdiseCode = settings?.institution?.udiseCode || ''
    const [activeSection, setActiveSection] = useState(0)
    const [form, setForm] = useState({
        // Basic Info
        fullName: student?.fullName || student?.name || '',
        // Keep for backward compatibility but hidden from UI
        firstName: student?.firstName || '',
        middleName: student?.middleName || '',
        lastName: student?.lastName || '',
        email: student?.email || '',
        phone: student?.phone || '',
        photo: student?.photo || '',

        // Academic
        classId: student?.classId?._id || student?.classId || '',
        class: student?.class || '',
        section: student?.section || '',
        academicYear: student?.academicYear || defaultAcademicYear,
        rollNumber: student?.rollNumber || '',
        admissionDate: student?.admissionDate ? student.admissionDate.substring(0, 10) : '',
        admissionClass: student?.admissionClass || '',
        admissionNumber: student?.admissionNumber || '',
        penNumber: student?.penNumber || '',

        subDepartment: student?.subDepartment?._id || student?.subDepartment || '',
        driverId: student?.transportMode === 'Self' ? 'self' : (student?.driverId?._id || student?.driverId || ''),

        // Personal Details
        dateOfBirth: student?.dateOfBirth ? student.dateOfBirth.substring(0, 10) : '',
        gender: student?.gender || 'male',
        bloodGroup: student?.bloodGroup || '',
        religion: student?.religion || '',
        motherTongue: student?.motherTongue || '',
        aadhaarNumber: student?.aadhaarNumber || '',
        category: student?.category || '',
        identificationMark: student?.identificationMark || '',
        isOrphan: student?.isOrphan || false,

        // Academic Background
        previousSchool: student?.previousSchool || '',
        previousBoard: student?.previousBoard || '',
        previousRollNumber: student?.previousRollNumber || '',
        transferNotes: student?.transferNotes || '',

        // Guardian Info
        guardians: student?.guardians || [{
            relation: 'Father',
            name: '',
            phone: '',
            email: '',
            occupation: '',
            aadhaarNumber: '',
            isPrimary: true
        }],
        address: student?.address || '',

        // Medical & Additional
        medicalConditions: student?.medicalConditions || '',
        allergies: student?.allergies || '',
        doctorName: student?.doctorName || '',
        doctorPhone: student?.doctorPhone || '',
        nationality: student?.nationality || '',
        notes: student?.notes || '',

        // Login (for new students)
        password: '',
        createLogin: true
    })

    const [subDepartmentOptions, setSubDepartmentOptions] = useState([])
    const [driverOptions, setDriverOptions] = useState([])
    const [classOptions, setClassOptions] = useState([])
    const [classesLoading, setClassesLoading] = useState(false)
    const [sectionOptions, setSectionOptions] = useState([])
    const [loadingSections, setLoadingSections] = useState(false)
    const [academicYearOptions, setAcademicYearOptions] = useState([])
    const [academicYearsLoading, setAcademicYearsLoading] = useState(false)
    const [academicYearsError, setAcademicYearsError] = useState(null)

    useEffect(() => {
        const fetchSubDepartments = async () => {
            try {
                const response = await api.get('/sub-departments?active=true')
                if (response.data.success) {
                    setSubDepartmentOptions(response.data.data)
                }
            } catch (error) {
            }
        }

        const fetchDrivers = async () => {
            try {
                const response = await transportService.getDrivers({ limit: 100, status: 'active' })
                if (response.success) {
                    setDriverOptions(response.data)
                }
            } catch (error) {
            }
        }

        const fetchAcademicYears = async () => {
            try {
                setAcademicYearsLoading(true)
                setAcademicYearsError(null)
                const response = await api.get('/academic-sessions')
                if (response.data.success && response.data.data) {
                    const sessions = response.data.data
                    setAcademicYearOptions(sessions)
                    // Auto-select the active year for new students, or for existing
                    // students whose stored academicYear is missing/empty (e.g. data
                    // imported before this field was populated).
                    const hasStoredYear = !!student?.academicYear
                    if (!student || !hasStoredYear) {
                        const activeSession = sessions.find(s => s.isActive)
                        if (activeSession) {
                            setForm(prev => ({ ...prev, academicYear: activeSession.name }))
                        } else if (sessions.length > 0) {
                            setForm(prev => ({ ...prev, academicYear: sessions[0].name }))
                        }
                    }
                }
            } catch (error) {
                setAcademicYearsError('Failed to load academic years')
            } finally {
                setAcademicYearsLoading(false)
            }
        }

        fetchSubDepartments()
        fetchDrivers()
        fetchAcademicYears()
    }, [])

    // Fetch classes scoped to the selected academic year (and dedupe defensively)
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                setClassesLoading(true)
                const params = form.academicYear ? `?academicYear=${encodeURIComponent(form.academicYear)}` : ''
                const response = await api.get(`/classes${params}`)
                if (response.data.success) {
                    const all = response.data.data || []
                    const deduped = dedupeClassesByName(all, form.academicYear || null)
                    setClassOptions(sortClassObjects(deduped, 'name'))
                }
            } catch (error) {
            } finally {
                setClassesLoading(false)
            }
        }
        fetchClasses()
    }, [form.academicYear])

    // Fetch sections when class changes
    useEffect(() => {
        const fetchSections = async () => {
            if (!form.classId) {
                setSectionOptions([])
                return
            }

            try {
                setLoadingSections(true)
                // Use the classId directly (already an ObjectId from the API-fetched class list)
                const sectionsResponse = await api.get(`/classes/${form.classId}/sections`)
                if (sectionsResponse.data.success) {
                    setSectionOptions(sectionsResponse.data.data)
                }
            } catch (error) {
                setSectionOptions([])
            } finally {
                setLoadingSections(false)
            }
        }

        fetchSections()
    }, [form.classId])

    const sections = [
        { id: 0, name: 'Student Info', icon: User },
        { id: 1, name: 'Personal Details', icon: Heart },
        { id: 2, name: 'Academic Background', icon: GraduationCap },
        { id: 3, name: 'Guardian Info', icon: Users },
        { id: 4, name: 'Medical & Notes', icon: FileText },
        { id: 5, name: 'Documents', icon: FileBadge }
    ]

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const updateGuardian = (index, field, value) => {
        const newGuardians = [...form.guardians]
        newGuardians[index] = { ...newGuardians[index], [field]: value }
        setForm(prev => ({ ...prev, guardians: newGuardians }))
    }

    const addGuardian = () => {
        setForm(prev => ({
            ...prev,
            guardians: [...prev.guardians, { relation: 'Mother', name: '', phone: '', email: '', occupation: '', aadhaarNumber: '', isPrimary: false }]
        }))
    }

    const [formErrors, setFormErrors] = useState({})

    // Guardian quick-fill from sibling search
    const [guardianSearch, setGuardianSearch] = useState('')
    const [guardianResults, setGuardianResults] = useState([])
    const [guardianSearching, setGuardianSearching] = useState(false)
    const [showGuardianDropdown, setShowGuardianDropdown] = useState(false)
    const guardianSearchRef = useRef(null)
    const guardianDropdownRef = useRef(null)
    const searchTimeoutRef = useRef(null)

    const searchGuardians = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setGuardianResults([])
            setShowGuardianDropdown(false)
            return
        }
        try {
            setGuardianSearching(true)
            const response = await api.get(`/students/guardian-search?q=${encodeURIComponent(query)}`)
            if (response.data.success) {
                setGuardianResults(response.data.data)
                setShowGuardianDropdown(response.data.data.length > 0)
            }
        } catch {
            setGuardianResults([])
        } finally {
            setGuardianSearching(false)
        }
    }, [])

    const handleGuardianSearchChange = (e) => {
        const value = e.target.value
        setGuardianSearch(value)
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = setTimeout(() => searchGuardians(value), 300)
    }

    const applyGuardianFromSibling = (result) => {
        setForm(prev => ({
            ...prev,
            guardians: result.guardians.length > 0
                ? result.guardians.map(g => ({ ...g }))
                : prev.guardians,
            address: result.address || prev.address
        }))
        setGuardianSearch('')
        setShowGuardianDropdown(false)
        setGuardianResults([])
    }

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                guardianDropdownRef.current && !guardianDropdownRef.current.contains(e.target) &&
                guardianSearchRef.current && !guardianSearchRef.current.contains(e.target)
            ) {
                setShowGuardianDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const validateForm = () => {
        const errors = {}
        if (!form.fullName?.trim()) errors.fullName = 'Student name is required'
        if (!form.classId && !form.class) errors.class = 'Class is required'
        if (!form.academicYear) errors.academicYear = 'Academic year is required'

        // Email validation
        if (form.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(form.email)) {
            errors.email = 'Invalid email format'
        }

        // Phone validation - 10-digit Indian format
        if (form.phone) {
            const phoneDigits = form.phone.replace(/[\s\-\+]/g, '')
            if (!/^\d{10,12}$/.test(phoneDigits)) {
                errors.phone = 'Enter a valid 10-digit phone number'
            }
        }

        // Date of birth - student must be under 25
        if (form.dateOfBirth) {
            const dob = new Date(form.dateOfBirth)
            const today = new Date()
            const age = today.getFullYear() - dob.getFullYear()
            if (age > 25) {
                errors.dateOfBirth = 'Student age cannot exceed 25 years'
            }
            if (dob > today) {
                errors.dateOfBirth = 'Date of birth cannot be in the future'
            }
        }

        // Admission date - no future dates
        if (form.admissionDate && new Date(form.admissionDate) > new Date()) {
            errors.admissionDate = 'Admission date cannot be in the future'
        }

        // Guardian validation - at least one contact required
        if (form.guardians && form.guardians.length > 0) {
            const primaryGuardian = form.guardians.find(g => g.isPrimary)
            if (primaryGuardian) {
                if (!primaryGuardian.name?.trim()) {
                    errors.guardianName = 'Primary guardian name is required'
                }
                if (!primaryGuardian.phone?.trim()) {
                    errors.guardianPhone = 'Primary guardian phone is required'
                } else {
                    const gPhone = primaryGuardian.phone.replace(/[\s\-\+]/g, '')
                    if (!/^\d{10,12}$/.test(gPhone)) {
                        errors.guardianPhone = 'Enter a valid guardian phone number'
                    }
                }
            }
            // Validate guardian emails if provided
            form.guardians.forEach((g, i) => {
                if (g.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(g.email)) {
                    errors[`guardianEmail${i}`] = `Guardian ${i + 1} has an invalid email`
                }
                if (g.phone) {
                    const gp = g.phone.replace(/[\s\-\+]/g, '')
                    if (!/^\d{10,12}$/.test(gp)) {
                        errors[`guardianPhone${i}`] = `Guardian ${i + 1} has an invalid phone number`
                    }
                }
            })
        }

        return errors
    }

    const handleSubmit = (e) => {
        e.preventDefault()

        // Validate before submitting
        const errors = validateForm()
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors)
            // Navigate to the first tab with errors
            if (errors.fullName || errors.email || errors.phone || errors.class || errors.academicYear || errors.admissionDate) {
                setActiveSection(0)
            } else if (errors.dateOfBirth) {
                setActiveSection(1)
            } else if (errors.guardianName || errors.guardianPhone || Object.keys(errors).some(k => k.startsWith('guardian'))) {
                setActiveSection(3)
            }
            return
        }
        setFormErrors({})

        // Transform form data to match backend expectations
        const submitData = { ...form }

        // Auto-add honorifics to guardian names
        if (submitData.guardians && Array.isArray(submitData.guardians)) {
            submitData.guardians = submitData.guardians.map(guardian => {
                if (guardian.name && guardian.name.trim()) {
                    let name = guardian.name.trim();

                    // Check if name already has a prefix (Mr., Mrs., Ms., Dr., etc.)
                    const hasPrefix = /^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Miss)\s+/i.test(name);

                    if (!hasPrefix) {
                        // Add appropriate prefix based on relation
                        if (guardian.relation === 'Father') {
                            name = `Mr. ${name}`;
                        } else if (guardian.relation === 'Mother') {
                            name = `Mrs. ${name}`;
                        }
                    }

                    return { ...guardian, name };
                }
                return guardian;
            });
        }

        // Backend expects 'name' not 'fullName'
        if (submitData.fullName) {
            submitData.name = submitData.fullName
            delete submitData.fullName
        }

        // Remove firstName/lastName if they're empty (backend doesn't use them)
        if (!submitData.firstName) delete submitData.firstName
        if (!submitData.middleName) delete submitData.middleName
        if (!submitData.lastName) delete submitData.lastName

        onSave(submitData, pendingDocs)
    }

    const [cropModal, setCropModal] = useState({ isOpen: false, imageSrc: null })
    const [photoError, setPhotoError] = useState(null)
    const [cameraOpen, setCameraOpen] = useState(false)

    // Documents — existing (saved) plus pending (selected but not yet uploaded)
    const [existingDocs, setExistingDocs] = useState(student?.documents || [])
    const [pendingDocs, setPendingDocs] = useState([]) // [{ localId, file, type, guardianIndex }]
    const [tcDocType, setTcDocType] = useState('tc') // 'tc' | 'birth_certificate'
    const [docDeletingId, setDocDeletingId] = useState(null)
    const [docError, setDocError] = useState(null)

    const isValidDocFile = (file) => {
        if (!file) return false
        const okType = file.type.startsWith('image/') || file.type === 'application/pdf'
        if (!okType) {
            setDocError('Only images (JPG, PNG) and PDF are allowed.')
            return false
        }
        if (file.size > 5 * 1024 * 1024) {
            setDocError('File exceeds 5MB. Please upload a smaller file.')
            return false
        }
        setDocError(null)
        return true
    }

    const addPendingDoc = (file, type, guardianIndex) => {
        if (!isValidDocFile(file)) return
        // Replace any existing pending of same type+guardian
        setPendingDocs(prev => {
            const filtered = prev.filter(d => !(d.type === type && d.guardianIndex === guardianIndex))
            return [...filtered, { localId: `${Date.now()}-${Math.random()}`, file, type, guardianIndex }]
        })
    }

    const removePendingDoc = (localId) => {
        setPendingDocs(prev => prev.filter(d => d.localId !== localId))
    }

    const deleteExistingDoc = async (docId) => {
        if (!student?._id) return
        if (!window.confirm('Delete this document? This cannot be undone.')) return
        try {
            setDocDeletingId(docId)
            await studentsService.deleteDocument(student._id, docId)
            setExistingDocs(prev => prev.filter(d => d._id !== docId))
        } catch (err) {
            setDocError(err?.response?.data?.message || 'Failed to delete document')
        } finally {
            setDocDeletingId(null)
        }
    }

    const findExistingDoc = (type, guardianIndex) => {
        if (type === 'guardian_aadhaar') {
            return existingDocs.find(d => d.type === 'guardian_aadhaar' && d.guardianIndex === guardianIndex)
        }
        if (type === 'tc_or_birth_certificate') {
            return existingDocs.find(d => d.type === 'tc' || d.type === 'birth_certificate')
        }
        return existingDocs.find(d => d.type === type)
    }

    const findPendingDoc = (type, guardianIndex) => {
        if (type === 'guardian_aadhaar') {
            return pendingDocs.find(d => d.type === 'guardian_aadhaar' && d.guardianIndex === guardianIndex)
        }
        if (type === 'tc_or_birth_certificate') {
            return pendingDocs.find(d => d.type === 'tc' || d.type === 'birth_certificate')
        }
        return pendingDocs.find(d => d.type === type)
    }

    const handleCameraCapture = (dataUrl) => {
        setCameraOpen(false)
        if (!dataUrl) return
        setPhotoError(null)
        setCropModal({ isOpen: true, imageSrc: dataUrl })
    }

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0]
        // Reset input so the same file can be re-selected later
        e.target.value = ''
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setPhotoError('Please select an image file (JPG or PNG).')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setPhotoError('File size exceeds 5MB. Please choose a smaller image.')
            return
        }
        setPhotoError(null)

        const reader = new FileReader()
        reader.onloadend = () => {
            setCropModal({ isOpen: true, imageSrc: reader.result })
        }
        reader.readAsDataURL(file)
    }

    const handleCropComplete = async (blob) => {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
        updateField('photo', dataUrl)
    }

    const closeCropModal = () => setCropModal({ isOpen: false, imageSrc: null })

    return createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content max-w-4xl p-0 max-h-[100vh] sm:max-h-[90vh] h-full sm:h-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                        {student ? 'Edit Student' : 'Add New Student'}
                    </h3>
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#2C2C2E]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Section Tabs */}
                <div className="border-b border-gray-200 dark:border-[#38383A] px-4 sm:px-6">
                    <nav className="-mb-px flex space-x-4 sm:space-x-6 overflow-x-auto whitespace-nowrap">
                        {sections.map((section) => {
                            const Icon = section.icon
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeSection === section.id
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {section.name}
                                </button>
                            )
                        })}
                    </nav>
                </div>

                {/* Form Content */}
                <form
                    onSubmit={handleSubmit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target?.tagName !== 'TEXTAREA' && activeSection !== sections.length - 1) {
                            e.preventDefault()
                        }
                    }}
                    className="p-4 sm:p-6"
                >
                    {/* Validation error summary */}
                    {(() => {
                        const visibleErrors = Object.values(formErrors).filter(msg => typeof msg === 'string' && msg.trim())
                        if (visibleErrors.length === 0) return null
                        return (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Please fix the following errors:</p>
                                <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-0.5">
                                    {visibleErrors.map((msg, i) => (
                                        <li key={i}>{msg}</li>
                                    ))}
                                </ul>
                            </div>
                        )
                    })()}
                    <div className="max-h-[60vh] overflow-y-auto">
                        {/* Section 0: Student Info */}
                        {activeSection === 0 && (
                            <div className="space-y-6">
                                {/* Photo Upload */}
                                <div className="flex items-center gap-6">
                                    <div className="relative flex-shrink-0">
                                        {form.photo ? (
                                            <img
                                                src={form.photo.startsWith('data:') || form.photo.startsWith('http') ? form.photo : `${SERVER_URL}${form.photo}`}
                                                alt="Student"
                                                className="h-24 w-24 rounded-full object-cover border-2 border-gray-200 dark:border-[#38383A]"
                                            />
                                        ) : (
                                            <div className="h-24 w-24 rounded-full bg-gray-200 dark:bg-[#2C2C2E] flex items-center justify-center">
                                                <User className="h-12 w-12 text-gray-400 dark:text-[#636366]" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Student Photo</p>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-3">Upload a clear photo (JPG, PNG)</p>
                                        {/* Two separate buttons for universal Android/iPad compatibility */}
                                        <div className="flex flex-wrap gap-2">
                                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium cursor-pointer hover:bg-primary-700 active:scale-95 transition-all">
                                                <Upload className="h-3.5 w-3.5" />
                                                Gallery
                                                {/* No capture = opens photo gallery on all devices */}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handlePhotoUpload}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setCameraOpen(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-medium cursor-pointer hover:bg-gray-800 active:scale-95 transition-all"
                                            >
                                                <Camera className="h-3.5 w-3.5" />
                                                Camera
                                            </button>
                                        </div>
                                        {photoError && (
                                            <p className="text-xs text-red-500 mt-2">{photoError}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Name Field - Single Input */}
                                <div>
                                    <label className="label">Student Name *</label>
                                    <input
                                        className={`input ${formErrors.fullName ? 'border-red-500' : ''}`}
                                        value={form.fullName}
                                        onChange={(e) => { updateField('fullName', e.target.value); setFormErrors(prev => ({ ...prev, fullName: undefined })) }}
                                        required
                                        placeholder="Enter full name"
                                    />
                                    {formErrors.fullName ? (
                                        <p className="text-xs text-red-500 mt-1">{formErrors.fullName}</p>
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Enter the complete name as it should appear on records</p>
                                    )}
                                </div>

                                {/* Contact & Login */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Email</label>
                                        <input
                                            type="email"
                                            autoComplete="off"
                                            className={`input ${formErrors.email ? 'border-red-500' : ''}`}
                                            value={form.email}
                                            onChange={(e) => { updateField('email', e.target.value); setFormErrors(prev => ({ ...prev, email: undefined })) }}
                                        />
                                        {formErrors.email && (
                                            <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="label">Phone</label>
                                        <input
                                            className={`input ${formErrors.phone ? 'border-red-500' : ''}`}
                                            value={form.phone}
                                            onChange={(e) => updateField('phone', e.target.value)}
                                            placeholder="9876543210"
                                        />
                                        {formErrors.phone && (
                                            <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>
                                        )}
                                    </div>
                                </div>

                                {!student && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="label">Password (optional)</label>
                                            <input
                                                type="password"
                                                autoComplete="new-password"
                                                className="input"
                                                value={form.password}
                                                onChange={(e) => updateField('password', e.target.value)}
                                                placeholder="Default: student123"
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.createLogin}
                                                    onChange={(e) => updateField('createLogin', e.target.checked)}
                                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-gray-700 dark:text-white">Create login credentials</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Academic Info */}
                                <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Academic Information</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="label">Academic Year *</label>
                                            <select
                                                className={`input ${formErrors.academicYear ? 'border-red-500' : ''}`}
                                                value={form.academicYear}
                                                onChange={(e) => updateField('academicYear', e.target.value)}
                                                required
                                                disabled={academicYearsLoading}
                                            >
                                                {academicYearsLoading ? (
                                                    <option value="">Loading...</option>
                                                ) : academicYearOptions.length > 0 ? (
                                                    <>
                                                        <option value="">Select Academic Year</option>
                                                        {academicYearOptions.map(session => (
                                                            <option key={session._id} value={session.name}>
                                                                {session.name}{session.isActive ? ' (Active)' : ''}
                                                            </option>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="">No academic years found</option>
                                                        <option value={FALLBACK_ACADEMIC_YEAR}>{FALLBACK_ACADEMIC_YEAR}</option>
                                                    </>
                                                )}
                                            </select>
                                            {academicYearsError && (
                                                <p className="text-xs text-red-500 mt-1">{academicYearsError}</p>
                                            )}
                                            {formErrors.academicYear && (
                                                <p className="text-xs text-red-500 mt-1">{formErrors.academicYear}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="label">Class *</label>
                                            <select
                                                className={`input ${formErrors.class ? 'border-red-500' : ''}`}
                                                value={form.classId || ''}
                                                onChange={(e) => {
                                                    const selectedCls = classOptions.find(c => c._id === e.target.value)
                                                    updateField('classId', e.target.value)
                                                    updateField('class', selectedCls?.grade || selectedCls?.name || '')
                                                    // Reset section when class changes
                                                    updateField('section', '')
                                                    updateField('sectionId', '')
                                                }}
                                                required
                                                disabled={classesLoading}
                                            >
                                                <option value="">
                                                    {classesLoading ? 'Loading classes...' : 'Select Class'}
                                                </option>
                                                {classOptions.map(cls => (
                                                    <option key={cls._id} value={cls._id}>
                                                        {cls.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {formErrors.class && (
                                                <p className="text-xs text-red-500 mt-1">{formErrors.class}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="label">Section</label>
                                            <select
                                                className="input"
                                                value={form.section}
                                                onChange={(e) => {
                                                    const selectedSection = sectionOptions.find(s => s.name === e.target.value)
                                                    updateField('section', e.target.value)
                                                    if (selectedSection) {
                                                        updateField('sectionId', selectedSection._id)
                                                    }
                                                }}
                                                disabled={!form.classId || loadingSections}
                                            >
                                                <option value="">
                                                    {loadingSections ? 'Loading sections...' : 'Select Section'}
                                                </option>
                                                {sectionOptions.map(section => (
                                                    <option key={section._id} value={section.name}>
                                                        {section.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {!form.class && (
                                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Please select a class first</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="label">Roll Number</label>
                                            <input
                                                className="input"
                                                value={form.rollNumber}
                                                onChange={(e) => updateField('rollNumber', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className={`grid grid-cols-1 ${student ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mt-4`}>
                                        <div>
                                            <label className="label">Admission Date</label>
                                            <input
                                                type="date"
                                                className={`input ${formErrors.admissionDate ? 'border-red-500' : ''}`}
                                                value={form.admissionDate}
                                                onChange={(e) => updateField('admissionDate', e.target.value)}
                                                max={new Date().toISOString().split('T')[0]}
                                            />
                                            {formErrors.admissionDate && (
                                                <p className="text-xs text-red-500 mt-1">{formErrors.admissionDate}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="label">Admission Class</label>
                                            <select
                                                className="input"
                                                value={form.admissionClass}
                                                onChange={(e) => updateField('admissionClass', e.target.value)}
                                            >
                                                <option value="">Select Admission Class</option>
                                                {classOptions.map(cls => (
                                                    <option key={cls._id} value={cls.grade || cls.name}>
                                                        {cls.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {student && (
                                            <div>
                                                <label className="label">Admission Number</label>
                                                <input
                                                    className="input bg-gray-50 dark:bg-[#2C2C2E]"
                                                    value={form.admissionNumber}
                                                    readOnly
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                        <div>
                                            <label className="label">Sub Department</label>
                                            <select
                                                className="input"
                                                value={form.subDepartment}
                                                onChange={(e) => updateField('subDepartment', e.target.value)}
                                            >
                                                <option value="">Select Sub Department</option>
                                                {subDepartmentOptions.map(opt => (
                                                    <option key={opt._id} value={opt._id}>{opt.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">Assigned Driver</label>
                                            <select
                                                className="input"
                                                value={form.driverId}
                                                onChange={(e) => updateField('driverId', e.target.value)}
                                            >
                                                <option value="">Select Driver</option>
                                                <option value="self">Self (Own Transport)</option>
                                                {driverOptions.map(driver => (
                                                    <option key={driver._id} value={driver._id}>{driver.name} ({driver.phone})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">PEN Number</label>
                                            <input
                                                className="input"
                                                value={form.penNumber}
                                                onChange={(e) => updateField('penNumber', e.target.value)}
                                                placeholder="Permanent Education Number"
                                                readOnly={!!student?.penNumber}
                                            />
                                        </div>
                                        <div>
                                            <label className="label">UDISE Code (School)</label>
                                            <input
                                                className="input bg-gray-50 dark:bg-[#2C2C2E]"
                                                value={student?.udiseCode || 'Inherited'}
                                                readOnly
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 1: Personal Details */}
                        {activeSection === 1 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Date of Birth</label>
                                        <input
                                            type="date"
                                            className={`input ${formErrors.dateOfBirth ? 'border-red-500' : ''}`}
                                            value={form.dateOfBirth}
                                            onChange={(e) => updateField('dateOfBirth', e.target.value)}
                                        />
                                        {formErrors.dateOfBirth && (
                                            <p className="text-xs text-red-500 mt-1">{formErrors.dateOfBirth}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="label">Gender</label>
                                        <select
                                            className="input"
                                            value={form.gender}
                                            onChange={(e) => updateField('gender', e.target.value)}
                                        >
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="label">Blood Group</label>
                                        <select
                                            className="input"
                                            value={form.bloodGroup}
                                            onChange={(e) => updateField('bloodGroup', e.target.value)}
                                        >
                                            <option value="">Select</option>
                                            <option value="A+">A+</option>
                                            <option value="A-">A-</option>
                                            <option value="B+">B+</option>
                                            <option value="B-">B-</option>
                                            <option value="AB+">AB+</option>
                                            <option value="AB-">AB-</option>
                                            <option value="O+">O+</option>
                                            <option value="O-">O-</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Religion</label>
                                        <input
                                            className="input"
                                            value={form.religion}
                                            onChange={(e) => updateField('religion', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Category</label>
                                        <select
                                            className="input"
                                            value={form.category}
                                            onChange={(e) => updateField('category', e.target.value)}
                                        >
                                            <option value="">Select</option>
                                            <option value="General">General</option>
                                            <option value="SC">SC</option>
                                            <option value="ST">ST</option>
                                            <option value="OBC">OBC</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Mother Tongue</label>
                                        <input
                                            className="input"
                                            value={form.motherTongue}
                                            onChange={(e) => updateField('motherTongue', e.target.value)}
                                            placeholder="e.g., Hindi, Marathi, Tamil"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Aadhaar Number</label>
                                        <input
                                            className="input"
                                            value={form.aadhaarNumber}
                                            onChange={(e) => updateField('aadhaarNumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                                            placeholder="12-digit Aadhaar"
                                            inputMode="numeric"
                                            maxLength={12}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Identification Mark</label>
                                        <input
                                            className="input"
                                            value={form.identificationMark}
                                            onChange={(e) => updateField('identificationMark', e.target.value)}
                                            placeholder="e.g., Mole on left cheek"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.isOrphan}
                                                onChange={(e) => updateField('isOrphan', e.target.checked)}
                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-white">Orphan Status</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 2: Academic Background */}
                        {activeSection === 2 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Previous School</label>
                                        <input
                                            className="input"
                                            value={form.previousSchool}
                                            onChange={(e) => updateField('previousSchool', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Previous Board</label>
                                        <input
                                            className="input"
                                            value={form.previousBoard}
                                            onChange={(e) => updateField('previousBoard', e.target.value)}
                                            placeholder="e.g., CBSE, ICSE, State Board"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Previous Roll Number / ID</label>
                                    <input
                                        className="input"
                                        value={form.previousRollNumber}
                                        onChange={(e) => updateField('previousRollNumber', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="label">Transfer Notes</label>
                                    <textarea
                                        className="input"
                                        rows="4"
                                        value={form.transferNotes}
                                        onChange={(e) => updateField('transferNotes', e.target.value)}
                                        placeholder="Any additional notes about transfer or previous academic history"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Section 3: Guardian Info */}
                        {activeSection === 3 && (
                            <div className="space-y-6">
                                {/* Quick Fill from Existing Sibling */}
                                {!student && (
                                    <div className="relative">
                                        <label className="label flex items-center gap-1.5 mb-1">
                                            <UserCheck className="h-3.5 w-3.5" />
                                            Quick Fill from Sibling
                                        </label>
                                        <div className="relative" ref={guardianSearchRef}>
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input
                                                className="input pl-9"
                                                placeholder="Search by student name, guardian name, or phone..."
                                                value={guardianSearch}
                                                onChange={handleGuardianSearchChange}
                                                onFocus={() => guardianResults.length > 0 && setShowGuardianDropdown(true)}
                                            />
                                            {guardianSearching && (
                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                                            )}
                                        </div>
                                        {showGuardianDropdown && (
                                            <div
                                                ref={guardianDropdownRef}
                                                className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                            >
                                                {guardianResults.map((result) => {
                                                    const primary = result.guardians.find(g => g.isPrimary) || result.guardians[0]
                                                    return (
                                                        <button
                                                            key={result.studentId}
                                                            type="button"
                                                            onClick={() => applyGuardianFromSibling(result)}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A] last:border-0 transition-colors"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {result.studentName}
                                                                </span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {result.class} {result.section && `- ${result.section}`}
                                                                </span>
                                                            </div>
                                                            {primary && (
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                    {primary.relation}: {primary.name} {primary.phone && `• ${primary.phone}`}
                                                                </div>
                                                            )}
                                                            {result.address && (
                                                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                                                    {result.address}
                                                                </div>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            Type a sibling's name or guardian's name/phone to auto-fill guardian details & address
                                        </p>
                                    </div>
                                )}

                                {form.guardians.map((guardian, index) => (
                                    <div key={index} className="border border-gray-200 dark:border-[#38383A] rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {guardian.isPrimary ? 'Primary Guardian' : 'Secondary Guardian'}
                                            </h4>
                                            {!guardian.isPrimary && (
                                                <button
                                                    type="button"
                                                    onClick={() => setForm(prev => ({
                                                        ...prev,
                                                        guardians: prev.guardians.filter((_, i) => i !== index)
                                                    }))}
                                                    className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Remove
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="label">Relation *</label>
                                                <select
                                                    className="input"
                                                    value={guardian.relation}
                                                    onChange={(e) => updateGuardian(index, 'relation', e.target.value)}
                                                    required={guardian.isPrimary}
                                                >
                                                    <option value="Father">Father</option>
                                                    <option value="Mother">Mother</option>
                                                    <option value="Guardian">Guardian</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="label">Name *</label>
                                                <input
                                                    className={`input ${(formErrors.guardianName && guardian.isPrimary) ? 'border-red-500' : ''}`}
                                                    value={guardian.name}
                                                    onChange={(e) => updateGuardian(index, 'name', e.target.value)}
                                                    required={guardian.isPrimary}
                                                />
                                                {formErrors.guardianName && guardian.isPrimary && (
                                                    <p className="text-xs text-red-500 mt-1">{formErrors.guardianName}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label className="label">Phone *</label>
                                                <input
                                                    className={`input ${(formErrors.guardianPhone && guardian.isPrimary) || formErrors[`guardianPhone${index}`] ? 'border-red-500' : ''}`}
                                                    value={guardian.phone}
                                                    onChange={(e) => updateGuardian(index, 'phone', e.target.value)}
                                                    required={guardian.isPrimary}
                                                />
                                                {formErrors.guardianPhone && guardian.isPrimary && (
                                                    <p className="text-xs text-red-500 mt-1">{formErrors.guardianPhone}</p>
                                                )}
                                                {formErrors[`guardianPhone${index}`] && (
                                                    <p className="text-xs text-red-500 mt-1">{formErrors[`guardianPhone${index}`]}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="label">Email</label>
                                                <input
                                                    type="email"
                                                    autoComplete="off"
                                                    className={`input ${formErrors[`guardianEmail${index}`] ? 'border-red-500' : ''}`}
                                                    value={guardian.email}
                                                    onChange={(e) => updateGuardian(index, 'email', e.target.value)}
                                                />
                                                {formErrors[`guardianEmail${index}`] && (
                                                    <p className="text-xs text-red-500 mt-1">{formErrors[`guardianEmail${index}`]}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label className="label">Occupation</label>
                                                <input
                                                    className="input"
                                                    value={guardian.occupation}
                                                    onChange={(e) => updateGuardian(index, 'occupation', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Aadhaar Number</label>
                                                <input
                                                    className="input"
                                                    value={guardian.aadhaarNumber || ''}
                                                    onChange={(e) => updateGuardian(index, 'aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
                                                    placeholder="12-digit Aadhaar number"
                                                    inputMode="numeric"
                                                    maxLength={12}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {form.guardians.length < 2 && (
                                    <button
                                        type="button"
                                        onClick={addGuardian}
                                        className="btn btn-outline w-full"
                                    >
                                        + Add Secondary Guardian
                                    </button>
                                )}

                                <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                                    <label className="label">Address</label>
                                    <textarea
                                        className="input"
                                        rows="3"
                                        value={form.address}
                                        onChange={(e) => updateField('address', e.target.value)}
                                        placeholder="Complete residential address"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Section 4: Medical & Notes */}
                        {activeSection === 4 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="label">Medical Conditions</label>
                                    <textarea
                                        className="input"
                                        rows="3"
                                        value={form.medicalConditions}
                                        onChange={(e) => updateField('medicalConditions', e.target.value)}
                                        placeholder="Any chronic illnesses, disabilities, or medical conditions"
                                    />
                                </div>

                                <div>
                                    <label className="label">Allergies</label>
                                    <textarea
                                        className="input"
                                        rows="2"
                                        value={form.allergies}
                                        onChange={(e) => updateField('allergies', e.target.value)}
                                        placeholder="Food allergies, drug allergies, etc."
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Doctor Name</label>
                                        <input
                                            className="input"
                                            value={form.doctorName}
                                            onChange={(e) => updateField('doctorName', e.target.value)}
                                            placeholder="Family doctor or pediatrician"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Doctor Phone</label>
                                        <input
                                            className="input"
                                            value={form.doctorPhone}
                                            onChange={(e) => updateField('doctorPhone', e.target.value)}
                                            placeholder="Doctor's contact number"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Nationality</label>
                                    <input
                                        className="input"
                                        value={form.nationality}
                                        onChange={(e) => updateField('nationality', e.target.value)}
                                        placeholder="e.g., Indian"
                                    />
                                </div>

                                <div>
                                    <label className="label">Additional Notes</label>
                                    <textarea
                                        className="input"
                                        rows="4"
                                        value={form.notes}
                                        onChange={(e) => updateField('notes', e.target.value)}
                                        placeholder="Any other important information about the student"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Section 5: Documents */}
                        {activeSection === 5 && (
                            <div className="space-y-6">
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-xs text-blue-800 dark:text-blue-300">
                                        Upload supporting documents (JPG, PNG, or PDF, max 5MB each).
                                        {!student && ' Files will be uploaded after the student is saved.'}
                                    </p>
                                </div>

                                {docError && (
                                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                        <p className="text-xs text-red-700 dark:text-red-300">{docError}</p>
                                    </div>
                                )}

                                {/* Student Aadhaar */}
                                <DocSlot
                                    label="Student Aadhaar Card"
                                    description="Upload the student's Aadhaar card (front and back combined, if possible)."
                                    icon={FileCheck}
                                    docType="student_aadhaar"
                                    existing={findExistingDoc('student_aadhaar')}
                                    pending={findPendingDoc('student_aadhaar')}
                                    onPick={(file) => addPendingDoc(file, 'student_aadhaar')}
                                    onRemovePending={removePendingDoc}
                                    onDeleteExisting={deleteExistingDoc}
                                    deletingId={docDeletingId}
                                />

                                {/* TC or Birth Certificate */}
                                <div className="border border-gray-200 dark:border-[#38383A] rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">TC / Birth Certificate</p>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-3">
                                        Upload Transfer Certificate (for transferring students) or Birth Certificate (for fresh admissions).
                                    </p>
                                    <div className="mb-3">
                                        <label className="label">Document Type</label>
                                        <select
                                            className="input"
                                            value={tcDocType}
                                            onChange={(e) => setTcDocType(e.target.value)}
                                            disabled={!!findExistingDoc('tc_or_birth_certificate') || !!findPendingDoc('tc_or_birth_certificate')}
                                        >
                                            <option value="tc">Transfer Certificate (TC)</option>
                                            <option value="birth_certificate">Birth Certificate</option>
                                        </select>
                                    </div>
                                    <DocSlotBody
                                        existing={findExistingDoc('tc_or_birth_certificate')}
                                        pending={findPendingDoc('tc_or_birth_certificate')}
                                        onPick={(file) => addPendingDoc(file, tcDocType)}
                                        onRemovePending={removePendingDoc}
                                        onDeleteExisting={deleteExistingDoc}
                                        deletingId={docDeletingId}
                                    />
                                </div>

                                {/* Per-guardian Aadhaar */}
                                <div className="space-y-3">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Guardian Aadhaar Cards</p>
                                    {(form.guardians || []).length === 0 && (
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Add a guardian in the Guardian Info section to upload their Aadhaar.</p>
                                    )}
                                    {(form.guardians || []).map((guardian, gi) => (
                                        <DocSlot
                                            key={gi}
                                            label={`${guardian.relation || 'Guardian'}${guardian.name ? ' — ' + guardian.name : ''} (Aadhaar)`}
                                            description="Upload this guardian's Aadhaar card."
                                            icon={FileCheck}
                                            docType="guardian_aadhaar"
                                            existing={findExistingDoc('guardian_aadhaar', gi)}
                                            pending={findPendingDoc('guardian_aadhaar', gi)}
                                            onPick={(file) => addPendingDoc(file, 'guardian_aadhaar', gi)}
                                            onRemovePending={removePendingDoc}
                                            onDeleteExisting={deleteExistingDoc}
                                            deletingId={docDeletingId}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
                        <div className="flex gap-2">
                            {activeSection > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setActiveSection(activeSection - 1)}
                                    className="btn btn-outline w-full sm:w-auto"
                                >
                                    Previous
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="btn btn-ghost w-full sm:w-auto"
                            >
                                Cancel
                            </button>
                            {activeSection < sections.length - 1 ? (
                                <button
                                    key="student-form-next-btn"
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveSection(activeSection + 1) }}
                                    className="btn btn-primary w-full sm:w-auto"
                                >
                                    Next
                                </button>
                            ) : (
                                <button
                                    key="student-form-submit-btn"
                                    type="submit"
                                    className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
                                    disabled={isLoading}
                                >
                                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isLoading ? 'Saving...' : student ? 'Update Student' : 'Add Student'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
            <ImageCropModal
                isOpen={cropModal.isOpen}
                onClose={closeCropModal}
                onCropComplete={handleCropComplete}
                imageSrc={cropModal.imageSrc}
                aspectRatio={1}
                title="Crop Student Photo"
                minWidth={400}
                minHeight={400}
                outputFormat="image/jpeg"
            />
            <CameraCaptureModal
                isOpen={cameraOpen}
                onCancel={() => setCameraOpen(false)}
                onCapture={handleCameraCapture}
            />
        </div>,
        document.body
    )
}

// Reusable doc-slot UI for the Documents section
const DocSlotBody = ({ existing, pending, onPick, onRemovePending, onDeleteExisting, deletingId }) => {
    const handleChange = (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) onPick(file)
    }

    if (existing) {
        return (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 min-w-0">
                    <FileCheck className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <a
                        href={existing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-800 dark:text-green-300 truncate hover:underline"
                    >
                        {existing.name || 'View document'}
                    </a>
                </div>
                <button
                    type="button"
                    onClick={() => onDeleteExisting(existing._id)}
                    disabled={deletingId === existing._id}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                    {deletingId === existing._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Remove
                </button>
            </div>
        )
    }

    if (pending) {
        return (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-amber-800 dark:text-amber-300 truncate">
                        {pending.file.name} <span className="opacity-70">(uploads on save)</span>
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => onRemovePending(pending.localId)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                    <Trash2 className="h-3 w-3" />
                    Remove
                </button>
            </div>
        )
    }

    return (
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-[#38383A] cursor-pointer hover:border-primary-500 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors">
            <Upload className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
            <span className="text-xs text-gray-700 dark:text-[#C7C7CC]">Choose file (JPG, PNG, PDF — max 5MB)</span>
            <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleChange}
            />
        </label>
    )
}

const DocSlot = ({ label, description, icon: Icon, existing, pending, onPick, onRemovePending, onDeleteExisting, deletingId }) => {
    return (
        <div className="border border-gray-200 dark:border-[#38383A] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
                {Icon && <Icon className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />}
                <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
            </div>
            {description && (
                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-3">{description}</p>
            )}
            <DocSlotBody
                existing={existing}
                pending={pending}
                onPick={onPick}
                onRemovePending={onRemovePending}
                onDeleteExisting={onDeleteExisting}
                deletingId={deletingId}
            />
        </div>
    )
}

export default StudentForm
