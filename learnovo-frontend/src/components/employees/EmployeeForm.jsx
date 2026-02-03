import React, { useState } from 'react'
import { X, Upload, User } from 'lucide-react'

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

        // Login (for new employees)
        password: '',
        createLogin: true
    })

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(form)
    }

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onloadend = () => {
            updateField('photo', reader.result)
        }
        reader.readAsDataURL(file)
    }

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content max-w-3xl p-0">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {employee ? 'Edit Employee' : 'Add New Employee'}
                    </h3>
                    <button onClick={onCancel} className="p-2 rounded-md hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="max-h-[70vh] overflow-y-auto space-y-6">
                        {/* Photo Upload */}
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                {form.photo ? (
                                    <img
                                        src={form.photo}
                                        alt="Employee"
                                        className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
                                    />
                                ) : (
                                    <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                                        <User className="h-12 w-12 text-gray-400" />
                                    </div>
                                )}
                                <label className="absolute bottom-0 right-0 p-1.5 bg-primary-600 rounded-full cursor-pointer hover:bg-primary-700">
                                    <Upload className="h-4 w-4 text-white" />
                                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                </label>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Employee Photo</p>
                                <p className="text-xs text-gray-500 mt-1">Upload a clear photo (JPG, PNG)</p>
                            </div>
                        </div>

                        {/* Basic Information */}
                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-4">Basic Information</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="label">Full Name *</label>
                                    <input
                                        className="input"
                                        value={form.name}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="label">Phone *</label>
                                    <input
                                        className="input"
                                        value={form.phone}
                                        onChange={(e) => updateField('phone', e.target.value)}
                                        required
                                        placeholder="+919876543210"
                                    />
                                </div>

                                <div>
                                    <label className="label">Email</label>
                                    <input
                                        type="email"
                                        className="input"
                                        value={form.email}
                                        onChange={(e) => updateField('email', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="label">Role *</label>
                                    <select
                                        className="input"
                                        value={form.role}
                                        onChange={(e) => updateField('role', e.target.value)}
                                        required
                                    >
                                        <option value="teacher">Teacher</option>
                                        <option value="admin">Admin</option>
                                        <option value="accountant">Accountant</option>
                                        <option value="staff">Staff</option>
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
                                        className="input"
                                        value={form.salary}
                                        onChange={(e) => updateField('salary', e.target.value)}
                                        min="0"
                                        placeholder="0"
                                    />
                                </div>

                                <div>
                                    <label className="label">Leave Deduction Per Day</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.leaveDeductionPerDay}
                                        onChange={(e) => updateField('leaveDeductionPerDay', e.target.value)}
                                        min="0"
                                        step="0.01"
                                        placeholder="0"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Amount to deduct per unpaid leave day</p>
                                </div>

                                <div>
                                    <label className="label">Date of Joining</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={form.dateOfJoining}
                                        onChange={(e) => updateField('dateOfJoining', e.target.value)}
                                    />
                                </div>
                            </div>

                            {!employee && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="label">Password (optional)</label>
                                        <input
                                            type="password"
                                            className="input"
                                            value={form.password}
                                            onChange={(e) => updateField('password', e.target.value)}
                                            placeholder="Default: employee123"
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
                                            <span className="text-sm text-gray-700">Create login credentials</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Personal Information */}
                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-4">Personal Information</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Father/Husband Name</label>
                                    <input
                                        className="input"
                                        value={form.fatherOrHusbandName}
                                        onChange={(e) => updateField('fatherOrHusbandName', e.target.value)}
                                    />
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

                                <div>
                                    <label className="label">Date of Birth</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={form.dateOfBirth}
                                        onChange={(e) => updateField('dateOfBirth', e.target.value)}
                                    />
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
                                    <label className="label">National ID (Aadhaar/SSN)</label>
                                    <input
                                        className="input"
                                        value={form.nationalId}
                                        onChange={(e) => updateField('nationalId', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="label">Education</label>
                                    <input
                                        className="input"
                                        value={form.education}
                                        onChange={(e) => updateField('education', e.target.value)}
                                        placeholder="e.g., B.Ed, M.Sc"
                                    />
                                </div>

                                <div>
                                    <label className="label">Experience (years)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.experience}
                                        onChange={(e) => updateField('experience', e.target.value)}
                                        min="0"
                                    />
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

                        {/* Bank Details */}
                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-4">Bank Details</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Bank Name</label>
                                    <input
                                        className="input"
                                        value={form.bankName}
                                        onChange={(e) => updateField('bankName', e.target.value)}
                                        placeholder="e.g., State Bank of India"
                                    />
                                </div>

                                <div>
                                    <label className="label">Account Number</label>
                                    <input
                                        className="input"
                                        value={form.accountNumber}
                                        onChange={(e) => updateField('accountNumber', e.target.value)}
                                        placeholder="e.g., 1234567890"
                                    />
                                </div>

                                <div>
                                    <label className="label">IFSC Code</label>
                                    <input
                                        className="input"
                                        value={form.ifscCode}
                                        onChange={(e) => updateField('ifscCode', e.target.value.toUpperCase())}
                                        placeholder="e.g., SBIN0001234"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                        <button type="button" onClick={onCancel} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? 'Saving...' : employee ? 'Update Employee' : 'Add Employee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default EmployeeForm
