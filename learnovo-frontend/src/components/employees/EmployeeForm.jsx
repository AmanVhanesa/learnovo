import React, { useState, useEffect } from 'react'
import { X, Upload, User, Camera, Eye, EyeOff, AlertCircle, Loader2, CheckCircle } from 'lucide-react'
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

const EmployeeForm = ({ employee, onSave, onCancel, isLoading }) => {
    const [form, setForm] = useState({
        // Basic Info
        name: employee?.name || '',
        phone: employee?.phone || '',
        email: employee?.email || '',
        role: employee?.role || 'teacher',
        designation: employee?.designation || '',
        department: employee?.department || '',
        salary: employee?.salary || '',
        leaveDeductionPerDay: employee?.leaveDeductionPerDay || '',
        dateOfJoining: employee?.dateOfJoining ? employee.dateOfJoining.substring(0, 10) : '',
        photo: employee?.photo || '',

        // Personal Info
        fatherOrHusbandName: employee?.fatherOrHusbandName || '',
        gender: employee?.gender || 'male',
        dateOfBirth: employee?.dateOfBirth ? employee.dateOfBirth.substring(0, 10) : '',
        religion: employee?.religion || '',
        bloodGroup: employee?.bloodGroup || '',
        nationalId: employee?.nationalId || '',
        education: employee?.education || '',
        experience: employee?.experience || '',
        homeAddress: employee?.homeAddress || '',

        // Bank Details
        bankName: employee?.bankName || '',
        accountNumber: employee?.accountNumber || '',
        ifscCode: employee?.ifscCode || '',

        // Subjects (for teachers)
        subjects: employee?.subjects || [],

        // Emergency Contact
        emergencyContact: employee?.emergencyContact || { name: '', phone: '', relation: '' },

        // Leave Balance
        leaveBalance: employee?.leaveBalance || { casual: 12, sick: 12, earned: 15 },

        // Login (for new employees)
        password: '',
        createLogin: true
    })

    const [formErrors, setFormErrors] = useState({})
    const [photoUploading, setPhotoUploading] = useState(false)
    const [photoPreview, setPhotoPreview] = useState(employee?.photo || '')
    const [photoError, setPhotoError] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [ifscLoading, setIfscLoading] = useState(false)
    const [ifscVerified, setIfscVerified] = useState(false)
    const [subjectInput, setSubjectInput] = useState('')

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
        // Clear error when user starts typing
        if (formErrors[field]) {
            setFormErrors(prev => ({ ...prev, [field]: '' }))
        }
    }

    const updateEmergencyContact = (field, value) => {
        setForm(prev => ({
            ...prev,
            emergencyContact: { ...prev.emergencyContact, [field]: value }
        }))
    }

    const updateLeaveBalance = (field, value) => {
        setForm(prev => ({
            ...prev,
            leaveBalance: { ...prev.leaveBalance, [field]: Math.max(0, Number(value) || 0) }
        }))
    }

    // IFSC Code auto-fetch bank name
    useEffect(() => {
        const fetchBankFromIFSC = async () => {
            const ifsc = form.ifscCode?.trim()
            if (!ifsc || ifsc.length !== 11) {
                setIfscVerified(false)
                return
            }
            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
                setIfscVerified(false)
                return
            }

            try {
                setIfscLoading(true)
                const response = await fetch(`https://ifsc.razorpay.com/${ifsc}`)
                if (response.ok) {
                    const data = await response.json()
                    if (data.BANK) {
                        updateField('bankName', data.BANK)
                        setIfscVerified(true)
                    }
                } else {
                    setIfscVerified(false)
                }
            } catch {
                setIfscVerified(false)
            } finally {
                setIfscLoading(false)
            }
        }

        const timer = setTimeout(fetchBankFromIFSC, 500)
        return () => clearTimeout(timer)
    }, [form.ifscCode])

    const validateForm = () => {
        const errors = {}

        // Name validation
        if (!form.name?.trim()) {
            errors.name = 'Full name is required'
        } else if (form.name.trim().length < 2) {
            errors.name = 'Name must be at least 2 characters'
        } else if (!/^[a-zA-Z\s.]+$/.test(form.name.trim())) {
            errors.name = 'Name can only contain letters and spaces'
        }

        // Phone validation - exactly 10 digits (Indian format)
        if (!form.phone?.trim()) {
            errors.phone = 'Phone number is required'
        } else {
            const phoneDigits = form.phone.replace(/[\s\-\+]/g, '')
            if (!/^\d{10,12}$/.test(phoneDigits)) {
                errors.phone = 'Enter a valid 10-digit phone number'
            }
        }

        // Email validation
        if (form.createLogin && !form.email?.trim()) {
            errors.email = 'Email is required when creating login credentials'
        } else if (form.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(form.email)) {
            errors.email = 'Invalid email format'
        }

        // Salary validation
        if (form.salary && Number(form.salary) < 0) {
            errors.salary = 'Salary cannot be negative'
        }

        // Leave deduction validation
        if (form.leaveDeductionPerDay && Number(form.leaveDeductionPerDay) < 0) {
            errors.leaveDeductionPerDay = 'Leave deduction cannot be negative'
        }

        // Date of joining - no future dates
        if (form.dateOfJoining) {
            const doj = new Date(form.dateOfJoining)
            if (doj > new Date()) {
                errors.dateOfJoining = 'Date of joining cannot be in the future'
            }
        }

        // Date of birth - must be 18+
        if (form.dateOfBirth) {
            const dob = new Date(form.dateOfBirth)
            const today = new Date()
            const age = today.getFullYear() - dob.getFullYear()
            const monthDiff = today.getMonth() - dob.getMonth()
            const effectiveAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) ? age - 1 : age
            if (effectiveAge < 18) {
                errors.dateOfBirth = 'Employee must be at least 18 years old'
            }
        }

        // National ID (Aadhaar) - exactly 12 digits if provided
        if (form.nationalId) {
            const cleaned = form.nationalId.replace(/\s/g, '')
            if (!/^\d{12}$/.test(cleaned)) {
                errors.nationalId = 'Aadhaar must be exactly 12 digits'
            }
        }

        // Experience - no negative
        if (form.experience && Number(form.experience) < 0) {
            errors.experience = 'Experience cannot be negative'
        }

        // Bank account number - 9-18 digits if provided
        if (form.accountNumber) {
            const cleaned = form.accountNumber.replace(/\s/g, '')
            if (!/^\d{9,18}$/.test(cleaned)) {
                errors.accountNumber = 'Account number must be 9-18 digits'
            }
        }

        // IFSC Code validation
        if (form.ifscCode) {
            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.toUpperCase())) {
                errors.ifscCode = 'Invalid IFSC format (e.g., SBIN0001234)'
            }
        }

        return errors
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        const errors = validateForm()
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors)
            return
        }
        setFormErrors({})

        const { _pendingPhotoFile, ...payload } = form
        // Clean up empty strings
        if (!payload.email) delete payload.email
        if (!payload.salary) delete payload.salary
        if (!payload.leaveDeductionPerDay) delete payload.leaveDeductionPerDay
        if (!payload.dateOfJoining) delete payload.dateOfJoining
        if (!payload.dateOfBirth) delete payload.dateOfBirth
        if (payload.subjects?.length === 0) delete payload.subjects

        onSave(payload, _pendingPhotoFile)
    }

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setPhotoError('')

        // Validate file type
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
            setPhotoError('Only JPG and PNG files are allowed')
            return
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setPhotoError('Photo must be less than 2MB')
            return
        }

        // Show local preview immediately
        const reader = new FileReader()
        reader.onloadend = () => setPhotoPreview(reader.result)
        reader.readAsDataURL(file)

        // For existing employees, upload to Cloudinary right away
        if (employee?._id) {
            try {
                setPhotoUploading(true)
                const result = await employeesService.uploadPhoto(employee._id, file)
                updateField('photo', result.data.url)
                setPhotoPreview(result.data.url)
            } catch (error) {
                setPhotoError('Upload failed, photo will be saved on form submit')
            } finally {
                setPhotoUploading(false)
            }
        } else {
            // For new employees, keep base64 preview and store file for later
            updateField('_pendingPhotoFile', file)
        }
    }

    const addSubject = () => {
        const trimmed = subjectInput.trim()
        if (trimmed && !form.subjects.includes(trimmed)) {
            updateField('subjects', [...form.subjects, trimmed])
        }
        setSubjectInput('')
    }

    const removeSubject = (index) => {
        updateField('subjects', form.subjects.filter((_, i) => i !== index))
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

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content !max-w-3xl p-0">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                        {employee ? 'Edit Employee' : 'Add New Employee'}
                    </h3>
                    <button onClick={onCancel} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#2C2C2E]">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-6">
                    <div className="max-h-[70vh] overflow-y-auto space-y-6">
                        {/* Photo Upload */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                            <div className="relative flex-shrink-0">
                                {photoPreview ? (
                                    <img
                                        src={photoPreview}
                                        alt="Employee"
                                        className="h-24 w-24 rounded-full object-cover border-2 border-gray-200 dark:border-[#38383A]"
                                    />
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
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png"
                                            className="hidden"
                                            onChange={handlePhotoUpload}
                                            disabled={photoUploading}
                                        />
                                    </label>
                                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-medium cursor-pointer hover:bg-gray-800 active:scale-95 transition-all">
                                        <Camera className="h-3.5 w-3.5" />
                                        Camera
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handlePhotoUpload}
                                            disabled={photoUploading}
                                        />
                                    </label>
                                </div>
                                {photoError && <p className="text-xs text-red-500 mt-2">{photoError}</p>}
                                {photoUploading && <p className="text-xs text-blue-600 mt-2">Uploading photo...</p>}
                            </div>
                        </div>

                        {/* Employee ID (read-only for existing) */}
                        {employee?.employeeId && (
                            <div className="bg-gray-50 dark:bg-[#1C1C1E] rounded-lg px-4 py-3">
                                <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Employee ID</span>
                                <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{employee.employeeId}</p>
                            </div>
                        )}

                        {/* Basic Information */}
                        <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="label">Full Name <span className="text-red-500">*</span></label>
                                    <input
                                        className={`input ${formErrors.name ? 'border-red-500' : ''}`}
                                        value={form.name}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        placeholder="Enter full name"
                                    />
                                    <FieldError field="name" />
                                </div>

                                <div>
                                    <label className="label">Phone <span className="text-red-500">*</span></label>
                                    <input
                                        className={`input ${formErrors.phone ? 'border-red-500' : ''}`}
                                        value={form.phone}
                                        onChange={(e) => updateField('phone', e.target.value)}
                                        placeholder="9876543210"
                                    />
                                    <FieldError field="phone" />
                                </div>

                                <div>
                                    <label className="label">Email {form.createLogin && <span className="text-red-500">*</span>}</label>
                                    <input
                                        type="email"
                                        className={`input ${formErrors.email ? 'border-red-500' : ''}`}
                                        value={form.email}
                                        onChange={(e) => updateField('email', e.target.value)}
                                        placeholder="employee@school.com"
                                    />
                                    <FieldError field="email" />
                                </div>

                                <div>
                                    <label className="label">Role <span className="text-red-500">*</span></label>
                                    <select
                                        className="input"
                                        value={form.role}
                                        onChange={(e) => updateField('role', e.target.value)}
                                        required
                                    >
                                        {ROLE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="label">Designation</label>
                                    <input
                                        className="input"
                                        value={form.designation}
                                        onChange={(e) => updateField('designation', e.target.value)}
                                        placeholder="e.g., Senior Teacher, Principal"
                                    />
                                </div>

                                <div>
                                    <label className="label">Department</label>
                                    <input
                                        className="input"
                                        value={form.department}
                                        onChange={(e) => updateField('department', e.target.value)}
                                        placeholder="e.g., Science, Administration"
                                    />
                                </div>

                                <div>
                                    <label className="label">Monthly Salary</label>
                                    <input
                                        type="number"
                                        className={`input ${formErrors.salary ? 'border-red-500' : ''}`}
                                        value={form.salary}
                                        onChange={(e) => updateField('salary', e.target.value)}
                                        onWheel={(e) => e.target.blur()}
                                        min="0"
                                        placeholder="0"
                                    />
                                    <FieldError field="salary" />
                                </div>

                                <div>
                                    <label className="label">Leave Deduction Per Day</label>
                                    <input
                                        type="number"
                                        className={`input ${formErrors.leaveDeductionPerDay ? 'border-red-500' : ''}`}
                                        value={form.leaveDeductionPerDay}
                                        onChange={(e) => updateField('leaveDeductionPerDay', e.target.value)}
                                        onWheel={(e) => e.target.blur()}
                                        min="0"
                                        step="0.01"
                                        placeholder="0"
                                    />
                                    <FieldError field="leaveDeductionPerDay" />
                                </div>

                                <div>
                                    <label className="label">Date of Joining</label>
                                    <input
                                        type="date"
                                        className={`input ${formErrors.dateOfJoining ? 'border-red-500' : ''}`}
                                        value={form.dateOfJoining}
                                        onChange={(e) => updateField('dateOfJoining', e.target.value)}
                                        max={todayStr}
                                    />
                                    <FieldError field="dateOfJoining" />
                                </div>
                            </div>

                            {/* Subjects field - only visible for Teacher role */}
                            {form.role === 'teacher' && (
                                <div className="mt-4">
                                    <label className="label">Subjects</label>
                                    <div className="flex gap-2">
                                        <input
                                            className="input flex-1"
                                            value={subjectInput}
                                            onChange={(e) => setSubjectInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject() } }}
                                            placeholder="Type subject name and press Enter"
                                        />
                                        <button type="button" onClick={addSubject} className="btn btn-ghost px-3">Add</button>
                                    </div>
                                    {form.subjects.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {form.subjects.map((subject, i) => (
                                                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                                                    {subject}
                                                    <button type="button" onClick={() => removeSubject(i)} className="hover:text-red-500">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Password section for new employees */}
                            {!employee && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="label">Password (optional)</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                className="input pr-10"
                                                value={form.password}
                                                onChange={(e) => updateField('password', e.target.value)}
                                                placeholder="Default: employee123"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
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
                        </div>

                        {/* Personal Information */}
                        <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="min-w-0">
                                    <label className="label">Father/Husband Name</label>
                                    <input
                                        className="input"
                                        value={form.fatherOrHusbandName}
                                        onChange={(e) => updateField('fatherOrHusbandName', e.target.value)}
                                    />
                                </div>

                                <div className="min-w-0">
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

                                <div className="min-w-0">
                                    <label className="label">Date of Birth</label>
                                    <input
                                        type="date"
                                        className={`input max-w-full ${formErrors.dateOfBirth ? 'border-red-500' : ''}`}
                                        value={form.dateOfBirth}
                                        onChange={(e) => updateField('dateOfBirth', e.target.value)}
                                        max={todayStr}
                                    />
                                    <FieldError field="dateOfBirth" />
                                </div>

                                <div className="min-w-0">
                                    <label className="label">Religion</label>
                                    <input
                                        className="input"
                                        value={form.religion}
                                        onChange={(e) => updateField('religion', e.target.value)}
                                    />
                                </div>

                                <div className="min-w-0">
                                    <label className="label">Blood Group</label>
                                    <select
                                        className="input"
                                        value={form.bloodGroup}
                                        onChange={(e) => updateField('bloodGroup', e.target.value)}
                                    >
                                        <option value="">Select</option>
                                        {BLOOD_GROUP_OPTIONS.map(bg => (
                                            <option key={bg} value={bg}>{bg}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="min-w-0">
                                    <label className="label">National ID (Aadhaar)</label>
                                    <input
                                        className={`input ${formErrors.nationalId ? 'border-red-500' : ''}`}
                                        value={form.nationalId}
                                        onChange={(e) => updateField('nationalId', e.target.value.replace(/[^\d\s]/g, ''))}
                                        placeholder="1234 5678 9012"
                                        maxLength={14}
                                    />
                                    <FieldError field="nationalId" />
                                </div>

                                <div className="min-w-0">
                                    <label className="label">Education</label>
                                    <input
                                        className="input"
                                        value={form.education}
                                        onChange={(e) => updateField('education', e.target.value)}
                                        placeholder="e.g., B.Ed, M.Sc"
                                    />
                                </div>

                                <div className="min-w-0">
                                    <label className="label">Experience (years)</label>
                                    <input
                                        type="number"
                                        className={`input ${formErrors.experience ? 'border-red-500' : ''}`}
                                        value={form.experience}
                                        onChange={(e) => updateField('experience', e.target.value)}
                                        onWheel={(e) => e.target.blur()}
                                        min="0"
                                    />
                                    <FieldError field="experience" />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="label">Home Address</label>
                                    <textarea
                                        className="input"
                                        rows="3"
                                        value={form.homeAddress}
                                        onChange={(e) => updateField('homeAddress', e.target.value)}
                                        placeholder="Complete residential address"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Emergency Contact</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="label">Contact Name</label>
                                    <input
                                        className="input"
                                        value={form.emergencyContact.name}
                                        onChange={(e) => updateEmergencyContact('name', e.target.value)}
                                        placeholder="Emergency contact name"
                                    />
                                </div>
                                <div>
                                    <label className="label">Contact Phone</label>
                                    <input
                                        className="input"
                                        value={form.emergencyContact.phone}
                                        onChange={(e) => updateEmergencyContact('phone', e.target.value)}
                                        placeholder="Phone number"
                                    />
                                </div>
                                <div>
                                    <label className="label">Relationship</label>
                                    <input
                                        className="input"
                                        value={form.emergencyContact.relation}
                                        onChange={(e) => updateEmergencyContact('relation', e.target.value)}
                                        placeholder="e.g., Spouse, Parent"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Leave Balance */}
                        <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Leave Balance</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="label">Casual Leave (days)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.leaveBalance.casual}
                                        onChange={(e) => updateLeaveBalance('casual', e.target.value)}
                                        onWheel={(e) => e.target.blur()}
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="label">Sick Leave (days)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.leaveBalance.sick}
                                        onChange={(e) => updateLeaveBalance('sick', e.target.value)}
                                        onWheel={(e) => e.target.blur()}
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="label">Earned Leave (days)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.leaveBalance.earned}
                                        onChange={(e) => updateLeaveBalance('earned', e.target.value)}
                                        onWheel={(e) => e.target.blur()}
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bank Details */}
                        <div className="border-t border-gray-100 dark:border-[#38383A] pt-4">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Bank Details</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">IFSC Code</label>
                                    <div className="relative">
                                        <input
                                            className={`input pr-8 ${formErrors.ifscCode ? 'border-red-500' : ifscVerified ? 'border-green-500' : ''}`}
                                            value={form.ifscCode}
                                            onChange={(e) => updateField('ifscCode', e.target.value.toUpperCase())}
                                            placeholder="e.g., SBIN0001234"
                                            maxLength={11}
                                        />
                                        {ifscLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />}
                                        {ifscVerified && !ifscLoading && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />}
                                    </div>
                                    <FieldError field="ifscCode" />
                                    {ifscVerified && <p className="text-xs text-green-600 mt-1">Bank verified from IFSC</p>}
                                </div>

                                <div>
                                    <label className="label">Bank Name</label>
                                    <input
                                        className="input"
                                        value={form.bankName}
                                        onChange={(e) => updateField('bankName', e.target.value)}
                                        placeholder={ifscLoading ? 'Fetching bank name...' : 'e.g., State Bank of India'}
                                        readOnly={ifscVerified}
                                    />
                                </div>

                                <div>
                                    <label className="label">Account Number</label>
                                    <input
                                        className={`input ${formErrors.accountNumber ? 'border-red-500' : ''}`}
                                        value={form.accountNumber}
                                        onChange={(e) => updateField('accountNumber', e.target.value.replace(/[^\d]/g, ''))}
                                        placeholder="e.g., 1234567890"
                                        maxLength={18}
                                    />
                                    <FieldError field="accountNumber" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
                        <button type="button" onClick={onCancel} className="btn btn-ghost w-full sm:w-auto">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2" disabled={isLoading || photoUploading}>
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isLoading ? 'Saving...' : employee ? 'Update Employee' : 'Add Employee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default EmployeeForm
