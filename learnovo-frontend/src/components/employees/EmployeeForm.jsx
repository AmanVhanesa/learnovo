import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, User, Camera, Eye, EyeOff, AlertCircle, Loader2, Briefcase, GraduationCap, BookMarked, FileText, Plus, Trash2 } from 'lucide-react'
import employeesService from '../../services/employeesService'

const ROLE_OPTIONS = [
    { value: 'teacher', label: 'Teacher' },
    { value: 'admin', label: 'Admin' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'librarian', label: 'Librarian' },
    { value: 'driver', label: 'Driver' },
    { value: 'support_staff', label: 'Support Staff' },
    { value: 'principal', label: 'Principal' },
    { value: 'vice_principal', label: 'Vice Principal' },
    { value: 'staff', label: 'Staff' },
]

const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const EMPLOYMENT_TYPES = [
    { value: '', label: 'Select' },
    { value: 'permanent', label: 'Permanent' },
    { value: 'probation', label: 'Probation' },
    { value: 'contract', label: 'Contract' },
    { value: 'temporary', label: 'Temporary' },
    { value: 'visiting', label: 'Visiting' },
]
const MARITAL_OPTIONS = [
    { value: '', label: 'Select' },
    { value: 'single', label: 'Single' },
    { value: 'married', label: 'Married' },
    { value: 'divorced', label: 'Divorced' },
    { value: 'widowed', label: 'Widowed' },
]

const EmployeeForm = ({ employee, onSave, onCancel, isLoading }) => {
    const [activeSection, setActiveSection] = useState(0)
    const [form, setForm] = useState({
        // Personal
        name: employee?.name || '',
        phone: employee?.phone || '',
        email: employee?.email || '',
        photo: employee?.photo || '',
        guardianRelation: employee?.guardianRelation || 'father',
        fatherOrHusbandName: employee?.fatherOrHusbandName || '',
        gender: employee?.gender || 'male',
        dateOfBirth: employee?.dateOfBirth ? employee.dateOfBirth.substring(0, 10) : '',
        bloodGroup: employee?.bloodGroup || '',
        religion: employee?.religion || '',
        nationality: employee?.nationality || '',
        maritalStatus: employee?.maritalStatus || '',
        nationalId: employee?.nationalId || '',
        homeAddress: employee?.homeAddress || '',

        // Appointment
        role: employee?.role || 'teacher',
        designation: employee?.designation || '',
        department: employee?.department || '',
        dateOfJoining: employee?.dateOfJoining ? employee.dateOfJoining.substring(0, 10) : '',
        employmentType: employee?.employmentType || '',
        appointmentOrderNo: employee?.appointmentOrderNo || '',
        probationEndDate: employee?.probationEndDate ? employee.probationEndDate.substring(0, 10) : '',
        reportingTo: employee?.reportingTo || '',

        // Qualifications
        education: employee?.education || '',
        qualifications: employee?.qualifications || '',
        specialization: employee?.specialization || '',
        experience: employee?.experience || '',
        previousEmployer: employee?.previousEmployer || '',
        previousDesignation: employee?.previousDesignation || '',
        subjects: employee?.subjects || [],
        certifications: employee?.certifications || [],

        // Service Record
        postings: employee?.postings || [],
        promotions: employee?.promotions || [],
        trainings: employee?.trainings || [],
        awards: employee?.awards || [],

        // Other
        emergencyContact: employee?.emergencyContact || { name: '', phone: '', relation: '' },
        leaveBalance: employee?.leaveBalance || { casual: 12, sick: 12, earned: 15 },
        serviceRemarks: employee?.serviceRemarks || '',

        // Login
        password: '',
        createLogin: true,
    })

    const sections = [
        { id: 0, name: 'Personal Info', icon: User },
        { id: 1, name: 'Appointment', icon: Briefcase },
        { id: 2, name: 'Qualifications', icon: GraduationCap },
        { id: 3, name: 'Service Record', icon: BookMarked },
        { id: 4, name: 'Other Details', icon: FileText },
    ]

    const [formErrors, setFormErrors] = useState({})
    const [photoUploading, setPhotoUploading] = useState(false)
    const [photoPreview, setPhotoPreview] = useState(employee?.photo || '')
    const [photoError, setPhotoError] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [subjectInput, setSubjectInput] = useState('')
    const [certInput, setCertInput] = useState('')

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
        if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
    const updateNested = (parent, field, value) => {
        setForm(prev => ({ ...prev, [parent]: { ...prev[parent], [field]: value } }))
    }
    const updateLeaveBalance = (field, value) => {
        setForm(prev => ({ ...prev, leaveBalance: { ...prev.leaveBalance, [field]: Math.max(0, Number(value) || 0) } }))
    }

    // Generic array helpers for service-record sub-arrays
    const addRow = (key, blank) => setForm(prev => ({ ...prev, [key]: [...prev[key], blank] }))
    const updateRow = (key, idx, field, value) => setForm(prev => ({
        ...prev,
        [key]: prev[key].map((row, i) => i === idx ? { ...row, [field]: value } : row),
    }))
    const removeRow = (key, idx) => setForm(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }))

    const addSubject = () => {
        const t = subjectInput.trim()
        if (t && !form.subjects.includes(t)) updateField('subjects', [...form.subjects, t])
        setSubjectInput('')
    }
    const removeSubject = (i) => updateField('subjects', form.subjects.filter((_, idx) => idx !== i))
    const addCert = () => {
        const t = certInput.trim()
        if (t && !form.certifications.includes(t)) updateField('certifications', [...form.certifications, t])
        setCertInput('')
    }
    const removeCert = (i) => updateField('certifications', form.certifications.filter((_, idx) => idx !== i))

    const validateForm = () => {
        const errors = {}
        if (!form.name?.trim()) errors.name = 'Full name is required'
        else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters'
        else if (!/^[a-zA-Z\s.]+$/.test(form.name.trim())) errors.name = 'Name can only contain letters and spaces'

        if (!form.phone?.trim()) errors.phone = 'Phone number is required'
        else {
            const d = form.phone.replace(/[\s\-\+]/g, '')
            if (!/^\d{10,12}$/.test(d)) errors.phone = 'Enter a valid 10-digit phone number'
        }

        if (form.createLogin && !form.email?.trim()) errors.email = 'Email is required when creating login credentials'
        else if (form.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(form.email)) errors.email = 'Invalid email format'

        if (form.dateOfJoining) {
            const doj = new Date(form.dateOfJoining)
            if (doj > new Date()) errors.dateOfJoining = 'Date of joining cannot be in the future'
        }

        if (form.dateOfBirth) {
            const dob = new Date(form.dateOfBirth)
            const today = new Date()
            const age = today.getFullYear() - dob.getFullYear()
            const md = today.getMonth() - dob.getMonth()
            const eff = md < 0 || (md === 0 && today.getDate() < dob.getDate()) ? age - 1 : age
            if (eff < 18) errors.dateOfBirth = 'Employee must be at least 18 years old'
        }

        if (form.nationalId) {
            const c = form.nationalId.replace(/\s/g, '')
            if (!/^\d{12}$/.test(c)) errors.nationalId = 'Aadhaar must be exactly 12 digits'
        }

        if (form.experience && Number(form.experience) < 0) errors.experience = 'Experience cannot be negative'

        return errors
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const errors = validateForm()
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors)
            if (errors.name || errors.phone || errors.email || errors.dateOfBirth || errors.nationalId) setActiveSection(0)
            else if (errors.dateOfJoining) setActiveSection(1)
            else if (errors.experience) setActiveSection(2)
            return
        }
        setFormErrors({})

        const { _pendingPhotoFile, ...payload } = form
        if (!payload.email) delete payload.email
        if (!payload.dateOfJoining) delete payload.dateOfJoining
        if (!payload.dateOfBirth) delete payload.dateOfBirth
        if (!payload.probationEndDate) delete payload.probationEndDate
        if (payload.subjects?.length === 0) delete payload.subjects
        if (payload.certifications?.length === 0) delete payload.certifications
        onSave(payload, _pendingPhotoFile)
    }

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setPhotoError('')
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
            setPhotoError('Only JPG and PNG files are allowed')
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setPhotoError('Photo must be less than 2MB')
            return
        }
        const reader = new FileReader()
        reader.onloadend = () => setPhotoPreview(reader.result)
        reader.readAsDataURL(file)

        if (employee?._id) {
            try {
                setPhotoUploading(true)
                const result = await employeesService.uploadPhoto(employee._id, file)
                updateField('photo', result.data.url)
                setPhotoPreview(result.data.url)
            } catch {
                setPhotoError('Upload failed, photo will be saved on form submit')
            } finally {
                setPhotoUploading(false)
            }
        } else {
            updateField('_pendingPhotoFile', file)
        }
    }

    const FieldError = ({ field }) => {
        if (!formErrors[field]) return null
        return (
            <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                {formErrors[field]}
            </p>
        )
    }

    const todayStr = new Date().toISOString().split('T')[0]

    return createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content max-w-4xl p-0 max-h-[100vh] sm:max-h-[90vh] h-full sm:h-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                        {employee ? 'Edit Employee — Service Book' : 'Add New Employee — Service Book'}
                    </h3>
                    <button onClick={onCancel} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#2C2C2E]">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Section Tabs */}
                <div className="border-b border-gray-200 dark:border-[#38383A] px-4 sm:px-6">
                    <nav className="-mb-px flex space-x-4 sm:space-x-6 overflow-x-auto whitespace-nowrap">
                        {sections.map((s) => {
                            const Icon = s.icon
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setActiveSection(s.id)}
                                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeSection === s.id
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {s.name}
                                </button>
                            )
                        })}
                    </nav>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6">
                    {Object.values(formErrors).filter(Boolean).length > 0 && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Please fix the following errors:</p>
                            <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-0.5">
                                {Object.values(formErrors).filter(Boolean).map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="max-h-[60vh] overflow-y-auto">
                        {/* ── Section 0: Personal Info ── */}
                        {activeSection === 0 && (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                    <div className="relative flex-shrink-0">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Employee" className="h-24 w-24 rounded-full object-cover border-2 border-gray-200 dark:border-[#38383A]" />
                                        ) : (
                                            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-teal-400 to-teal-700 flex items-center justify-center">
                                                <User className="h-12 w-12 text-white" />
                                            </div>
                                        )}
                                        {photoUploading && (
                                            <div className="absolute inset-0 rounded-full bg-black bg-opacity-40 flex items-center justify-center">
                                                <Loader2 className="h-6 w-6 text-white animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Employee Photo</p>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-3">JPG or PNG, max 2MB</p>
                                        <div className="flex flex-wrap gap-2">
                                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium cursor-pointer hover:bg-primary-700 active:scale-95 transition-all">
                                                <Upload className="h-3.5 w-3.5" />
                                                Gallery
                                                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
                                            </label>
                                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-medium cursor-pointer hover:bg-gray-800 active:scale-95 transition-all">
                                                <Camera className="h-3.5 w-3.5" />
                                                Camera
                                                <input type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
                                            </label>
                                        </div>
                                        {photoError && <p className="text-xs text-red-500 mt-2">{photoError}</p>}
                                    </div>
                                </div>

                                {employee?.employeeId && (
                                    <div className="bg-gray-50 dark:bg-[#1C1C1E] rounded-lg px-4 py-3">
                                        <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Employee ID</span>
                                        <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{employee.employeeId}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="label">Full Name <span className="text-red-500">*</span></label>
                                    <input className={`input ${formErrors.name ? 'border-red-500' : ''}`} value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Enter full name" />
                                    <FieldError field="name" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Phone <span className="text-red-500">*</span></label>
                                        <input className={`input ${formErrors.phone ? 'border-red-500' : ''}`} value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="9876543210" />
                                        <FieldError field="phone" />
                                    </div>
                                    <div>
                                        <label className="label">Email {form.createLogin && <span className="text-red-500">*</span>}</label>
                                        <input type="email" autoComplete="off" className={`input ${formErrors.email ? 'border-red-500' : ''}`} value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="employee@school.com" />
                                        <FieldError field="email" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="min-w-0">
                                        <label className="label">{form.guardianRelation === 'father' ? "Father's" : "Husband's"} Name</label>
                                        <div className="flex gap-2">
                                            <select className="input w-[130px] shrink-0" value={form.guardianRelation} onChange={(e) => updateField('guardianRelation', e.target.value)}>
                                                <option value="father">Father</option>
                                                <option value="husband">Husband</option>
                                            </select>
                                            <input className="input flex-1 min-w-0" placeholder="Enter name" value={form.fatherOrHusbandName} onChange={(e) => updateField('fatherOrHusbandName', e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label">Gender</label>
                                        <select className="input" value={form.gender} onChange={(e) => updateField('gender', e.target.value)}>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="label">Date of Birth</label>
                                        <input type="date" className={`input ${formErrors.dateOfBirth ? 'border-red-500' : ''}`} value={form.dateOfBirth} onChange={(e) => updateField('dateOfBirth', e.target.value)} max={todayStr} />
                                        <FieldError field="dateOfBirth" />
                                    </div>
                                    <div>
                                        <label className="label">Blood Group</label>
                                        <select className="input" value={form.bloodGroup} onChange={(e) => updateField('bloodGroup', e.target.value)}>
                                            <option value="">Select</option>
                                            {BLOOD_GROUP_OPTIONS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Marital Status</label>
                                        <select className="input" value={form.maritalStatus} onChange={(e) => updateField('maritalStatus', e.target.value)}>
                                            {MARITAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="label">Religion</label>
                                        <input className="input" value={form.religion} onChange={(e) => updateField('religion', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="label">Nationality</label>
                                        <input className="input" value={form.nationality} onChange={(e) => updateField('nationality', e.target.value)} placeholder="e.g., Indian" />
                                    </div>
                                    <div>
                                        <label className="label">National ID (Aadhaar)</label>
                                        <input className={`input ${formErrors.nationalId ? 'border-red-500' : ''}`} value={form.nationalId} onChange={(e) => updateField('nationalId', e.target.value.replace(/[^\d\s]/g, ''))} placeholder="1234 5678 9012" maxLength={14} />
                                        <FieldError field="nationalId" />
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Home Address</label>
                                    <textarea className="input" rows="3" value={form.homeAddress} onChange={(e) => updateField('homeAddress', e.target.value)} placeholder="Complete residential address" />
                                </div>
                            </div>
                        )}

                        {/* ── Section 1: Appointment ── */}
                        {activeSection === 1 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Role <span className="text-red-500">*</span></label>
                                        <select className="input" value={form.role} onChange={(e) => updateField('role', e.target.value)} required>
                                            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Designation</label>
                                        <input className="input" value={form.designation} onChange={(e) => updateField('designation', e.target.value)} placeholder="e.g., Senior Teacher, Principal" />
                                    </div>
                                    <div>
                                        <label className="label">Department</label>
                                        <input className="input" value={form.department} onChange={(e) => updateField('department', e.target.value)} placeholder="e.g., Science, Administration" />
                                    </div>
                                    <div>
                                        <label className="label">Date of Joining</label>
                                        <input type="date" className={`input ${formErrors.dateOfJoining ? 'border-red-500' : ''}`} value={form.dateOfJoining} onChange={(e) => updateField('dateOfJoining', e.target.value)} max={todayStr} />
                                        <FieldError field="dateOfJoining" />
                                    </div>
                                    <div>
                                        <label className="label">Employment Type</label>
                                        <select className="input" value={form.employmentType} onChange={(e) => updateField('employmentType', e.target.value)}>
                                            {EMPLOYMENT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Appointment Order No.</label>
                                        <input className="input" value={form.appointmentOrderNo} onChange={(e) => updateField('appointmentOrderNo', e.target.value)} placeholder="e.g., HR/APP/2024/045" />
                                    </div>
                                    <div>
                                        <label className="label">Probation End Date</label>
                                        <input type="date" className="input" value={form.probationEndDate} onChange={(e) => updateField('probationEndDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="label">Reporting To</label>
                                        <input className="input" value={form.reportingTo} onChange={(e) => updateField('reportingTo', e.target.value)} placeholder="Supervisor name / designation" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Section 2: Qualifications ── */}
                        {activeSection === 2 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Highest Education</label>
                                        <input className="input" value={form.education} onChange={(e) => updateField('education', e.target.value)} placeholder="e.g., B.Ed, M.Sc" />
                                    </div>
                                    <div>
                                        <label className="label">Specialization</label>
                                        <input className="input" value={form.specialization} onChange={(e) => updateField('specialization', e.target.value)} placeholder="e.g., Mathematics, English Literature" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="label">Qualifications (Detailed)</label>
                                        <textarea className="input" rows="3" value={form.qualifications} onChange={(e) => updateField('qualifications', e.target.value)} placeholder="Degrees, institutes, year of completion, marks..." />
                                    </div>
                                    <div>
                                        <label className="label">Total Experience (years)</label>
                                        <input type="number" className={`input ${formErrors.experience ? 'border-red-500' : ''}`} value={form.experience} onChange={(e) => updateField('experience', e.target.value)} onWheel={(e) => e.target.blur()} min="0" />
                                        <FieldError field="experience" />
                                    </div>
                                    <div />
                                    <div>
                                        <label className="label">Previous Employer</label>
                                        <input className="input" value={form.previousEmployer} onChange={(e) => updateField('previousEmployer', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="label">Previous Designation</label>
                                        <input className="input" value={form.previousDesignation} onChange={(e) => updateField('previousDesignation', e.target.value)} />
                                    </div>
                                </div>

                                {form.role === 'teacher' && (
                                    <div>
                                        <label className="label">Subjects</label>
                                        <div className="flex gap-2">
                                            <input className="input flex-1" value={subjectInput} onChange={(e) => setSubjectInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject() } }} placeholder="Type subject name and press Enter" />
                                            <button type="button" onClick={addSubject} className="btn btn-ghost px-3">Add</button>
                                        </div>
                                        {form.subjects.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {form.subjects.map((s, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                                                        {s}
                                                        <button type="button" onClick={() => removeSubject(i)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="label">Certifications / Training Certificates</label>
                                    <div className="flex gap-2">
                                        <input className="input flex-1" value={certInput} onChange={(e) => setCertInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCert() } }} placeholder="Type certification name and press Enter" />
                                        <button type="button" onClick={addCert} className="btn btn-ghost px-3">Add</button>
                                    </div>
                                    {form.certifications.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {form.certifications.map((c, i) => (
                                                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs rounded-full">
                                                    {c}
                                                    <button type="button" onClick={() => removeCert(i)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Section 3: Service Record ── */}
                        {activeSection === 3 && (
                            <div className="space-y-6">
                                {/* Postings */}
                                <div className="border border-gray-200 dark:border-[#38383A] rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Postings / Transfers</h4>
                                        <button type="button" onClick={() => addRow('postings', { fromDate: '', toDate: '', post: '', location: '', remarks: '' })} className="btn btn-ghost px-3 inline-flex items-center gap-1 text-xs">
                                            <Plus className="h-3 w-3" /> Add
                                        </button>
                                    </div>
                                    {form.postings.length === 0 && <p className="text-xs text-gray-500 dark:text-[#8E8E93]">No postings recorded.</p>}
                                    {form.postings.map((row, i) => (
                                        <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                                            <input type="date" className="input" value={row.fromDate ? row.fromDate.substring(0, 10) : ''} onChange={(e) => updateRow('postings', i, 'fromDate', e.target.value)} placeholder="From" />
                                            <input type="date" className="input" value={row.toDate ? row.toDate.substring(0, 10) : ''} onChange={(e) => updateRow('postings', i, 'toDate', e.target.value)} placeholder="To" />
                                            <input className="input" value={row.post} onChange={(e) => updateRow('postings', i, 'post', e.target.value)} placeholder="Post" />
                                            <input className="input" value={row.location} onChange={(e) => updateRow('postings', i, 'location', e.target.value)} placeholder="Location" />
                                            <div className="flex gap-1">
                                                <input className="input flex-1" value={row.remarks} onChange={(e) => updateRow('postings', i, 'remarks', e.target.value)} placeholder="Remarks" />
                                                <button type="button" onClick={() => removeRow('postings', i)} className="text-red-500 hover:text-red-700 p-2"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Promotions */}
                                <div className="border border-gray-200 dark:border-[#38383A] rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Promotions</h4>
                                        <button type="button" onClick={() => addRow('promotions', { date: '', fromDesignation: '', toDesignation: '', orderNo: '', remarks: '' })} className="btn btn-ghost px-3 inline-flex items-center gap-1 text-xs">
                                            <Plus className="h-3 w-3" /> Add
                                        </button>
                                    </div>
                                    {form.promotions.length === 0 && <p className="text-xs text-gray-500 dark:text-[#8E8E93]">No promotions recorded.</p>}
                                    {form.promotions.map((row, i) => (
                                        <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                                            <input type="date" className="input" value={row.date ? row.date.substring(0, 10) : ''} onChange={(e) => updateRow('promotions', i, 'date', e.target.value)} />
                                            <input className="input" value={row.fromDesignation} onChange={(e) => updateRow('promotions', i, 'fromDesignation', e.target.value)} placeholder="From designation" />
                                            <input className="input" value={row.toDesignation} onChange={(e) => updateRow('promotions', i, 'toDesignation', e.target.value)} placeholder="To designation" />
                                            <input className="input" value={row.orderNo} onChange={(e) => updateRow('promotions', i, 'orderNo', e.target.value)} placeholder="Order No." />
                                            <div className="flex gap-1">
                                                <input className="input flex-1" value={row.remarks} onChange={(e) => updateRow('promotions', i, 'remarks', e.target.value)} placeholder="Remarks" />
                                                <button type="button" onClick={() => removeRow('promotions', i)} className="text-red-500 hover:text-red-700 p-2"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Trainings */}
                                <div className="border border-gray-200 dark:border-[#38383A] rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Trainings Attended</h4>
                                        <button type="button" onClick={() => addRow('trainings', { name: '', fromDate: '', toDate: '', institute: '', remarks: '' })} className="btn btn-ghost px-3 inline-flex items-center gap-1 text-xs">
                                            <Plus className="h-3 w-3" /> Add
                                        </button>
                                    </div>
                                    {form.trainings.length === 0 && <p className="text-xs text-gray-500 dark:text-[#8E8E93]">No trainings recorded.</p>}
                                    {form.trainings.map((row, i) => (
                                        <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                                            <input className="input" value={row.name} onChange={(e) => updateRow('trainings', i, 'name', e.target.value)} placeholder="Training name" />
                                            <input type="date" className="input" value={row.fromDate ? row.fromDate.substring(0, 10) : ''} onChange={(e) => updateRow('trainings', i, 'fromDate', e.target.value)} />
                                            <input type="date" className="input" value={row.toDate ? row.toDate.substring(0, 10) : ''} onChange={(e) => updateRow('trainings', i, 'toDate', e.target.value)} />
                                            <input className="input" value={row.institute} onChange={(e) => updateRow('trainings', i, 'institute', e.target.value)} placeholder="Institute" />
                                            <div className="flex gap-1">
                                                <input className="input flex-1" value={row.remarks} onChange={(e) => updateRow('trainings', i, 'remarks', e.target.value)} placeholder="Remarks" />
                                                <button type="button" onClick={() => removeRow('trainings', i)} className="text-red-500 hover:text-red-700 p-2"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Awards */}
                                <div className="border border-gray-200 dark:border-[#38383A] rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Awards & Recognitions</h4>
                                        <button type="button" onClick={() => addRow('awards', { name: '', date: '', description: '' })} className="btn btn-ghost px-3 inline-flex items-center gap-1 text-xs">
                                            <Plus className="h-3 w-3" /> Add
                                        </button>
                                    </div>
                                    {form.awards.length === 0 && <p className="text-xs text-gray-500 dark:text-[#8E8E93]">No awards recorded.</p>}
                                    {form.awards.map((row, i) => (
                                        <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                                            <input className="input" value={row.name} onChange={(e) => updateRow('awards', i, 'name', e.target.value)} placeholder="Award name" />
                                            <input type="date" className="input" value={row.date ? row.date.substring(0, 10) : ''} onChange={(e) => updateRow('awards', i, 'date', e.target.value)} />
                                            <div className="flex gap-1">
                                                <input className="input flex-1" value={row.description} onChange={(e) => updateRow('awards', i, 'description', e.target.value)} placeholder="Description" />
                                                <button type="button" onClick={() => removeRow('awards', i)} className="text-red-500 hover:text-red-700 p-2"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Section 4: Other Details ── */}
                        {activeSection === 4 && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Emergency Contact</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="label">Contact Name</label>
                                            <input className="input" value={form.emergencyContact.name} onChange={(e) => updateNested('emergencyContact', 'name', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label">Contact Phone</label>
                                            <input className="input" value={form.emergencyContact.phone} onChange={(e) => updateNested('emergencyContact', 'phone', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label">Relationship</label>
                                            <input className="input" value={form.emergencyContact.relation} onChange={(e) => updateNested('emergencyContact', 'relation', e.target.value)} placeholder="e.g., Spouse, Parent" />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Leave Balance</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="label">Casual Leave (days)</label>
                                            <input type="number" className="input" value={form.leaveBalance.casual} onChange={(e) => updateLeaveBalance('casual', e.target.value)} onWheel={(e) => e.target.blur()} min="0" />
                                        </div>
                                        <div>
                                            <label className="label">Sick Leave (days)</label>
                                            <input type="number" className="input" value={form.leaveBalance.sick} onChange={(e) => updateLeaveBalance('sick', e.target.value)} onWheel={(e) => e.target.blur()} min="0" />
                                        </div>
                                        <div>
                                            <label className="label">Earned Leave (days)</label>
                                            <input type="number" className="input" value={form.leaveBalance.earned} onChange={(e) => updateLeaveBalance('earned', e.target.value)} onWheel={(e) => e.target.blur()} min="0" />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                                    <label className="label">Service Remarks</label>
                                    <textarea className="input" rows="4" value={form.serviceRemarks} onChange={(e) => updateField('serviceRemarks', e.target.value)} placeholder="Any service-related remarks, notes, or observations" />
                                </div>

                                {!employee && (
                                    <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Login Credentials</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="label">Password (optional)</label>
                                                <div className="relative">
                                                    <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="input pr-10" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Default: employee123" />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-end">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={form.createLogin} onChange={(e) => updateField('createLogin', e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                                                    <span className="text-sm text-gray-700 dark:text-white">Create login credentials</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
                        <div className="flex gap-2">
                            {activeSection > 0 && (
                                <button type="button" onClick={() => setActiveSection(activeSection - 1)} className="btn btn-outline w-full sm:w-auto">Previous</button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={onCancel} className="btn btn-ghost w-full sm:w-auto">Cancel</button>
                            {activeSection < sections.length - 1 ? (
                                <button type="button" onClick={() => setActiveSection(activeSection + 1)} className="btn btn-primary w-full sm:w-auto">Next</button>
                            ) : (
                                <button type="submit" className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2" disabled={isLoading || photoUploading}>
                                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isLoading ? 'Saving...' : employee ? 'Update Employee' : 'Add Employee'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    )
}

export default EmployeeForm
