import React, { useState, useEffect } from 'react'
import { X, Upload, User, Heart, GraduationCap, Users, FileText } from 'lucide-react'
import api from '../../services/authService'
import transportService from '../../services/transportService'
import { STANDARD_CLASSES } from '../../constants/classes'

const StudentForm = ({ student, onSave, onCancel, isLoading }) => {
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
        class: student?.class || '',
        section: student?.section || '',
        academicYear: student?.academicYear || '2025-2026',
        rollNumber: student?.rollNumber || '',
        admissionDate: student?.admissionDate ? student.admissionDate.substring(0, 10) : '',
        admissionNumber: student?.admissionNumber || '',
        penNumber: student?.penNumber || '',

        subDepartment: student?.subDepartment?._id || student?.subDepartment || '',
        driverId: student?.driverId?._id || student?.driverId || '',

        // Personal Details
        dateOfBirth: student?.dateOfBirth ? student.dateOfBirth.substring(0, 10) : '',
        gender: student?.gender || 'male',
        bloodGroup: student?.bloodGroup || '',
        religion: student?.religion || '',
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
            isPrimary: true
        }],
        address: student?.address || '',

        // Medical & Additional
        medicalConditions: student?.medicalConditions || '',
        allergies: student?.allergies || '',
        notes: student?.notes || '',

        // Login (for new students)
        password: '',
        createLogin: true
    })

    const [subDepartmentOptions, setSubDepartmentOptions] = useState([])
    const [driverOptions, setDriverOptions] = useState([])

    useEffect(() => {
        const fetchSubDepartments = async () => {
            try {
                const response = await api.get('/sub-departments?active=true')
                if (response.data.success) {
                    setSubDepartmentOptions(response.data.data)
                }
            } catch (error) {
                console.error('Error fetching sub-departments', error)
            }
        }

        const fetchDrivers = async () => {
            try {
                const response = await transportService.getDrivers({ limit: 100, status: 'active' })
                if (response.success) {
                    setDriverOptions(response.data)
                }
            } catch (error) {
                console.error('Error fetching drivers', error)
            }
        }

        fetchSubDepartments()
        fetchDrivers()
    }, [])

    const sections = [
        { id: 0, name: 'Student Info', icon: User },
        { id: 1, name: 'Personal Details', icon: Heart },
        { id: 2, name: 'Academic Background', icon: GraduationCap },
        { id: 3, name: 'Guardian Info', icon: Users },
        { id: 4, name: 'Medical & Notes', icon: FileText }
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
            guardians: [...prev.guardians, { relation: 'Mother', name: '', phone: '', email: '', occupation: '', isPrimary: false }]
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(form)
    }

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        // TODO: Implement photo upload to server
        // For now, create a local preview
        const reader = new FileReader()
        reader.onloadend = () => {
            updateField('photo', reader.result)
        }
        reader.readAsDataURL(file)
    }

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content max-w-4xl p-0">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {student ? 'Edit Student' : 'Add New Student'}
                    </h3>
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-md hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Section Tabs */}
                <div className="border-b border-gray-200 px-6">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {sections.map((section) => {
                            const Icon = section.icon
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeSection === section.id
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="max-h-[60vh] overflow-y-auto">
                        {/* Section 0: Student Info */}
                        {activeSection === 0 && (
                            <div className="space-y-6">
                                {/* Photo Upload */}
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        {form.photo ? (
                                            <img
                                                src={form.photo}
                                                alt="Student"
                                                className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
                                            />
                                        ) : (
                                            <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                                                <User className="h-12 w-12 text-gray-400" />
                                            </div>
                                        )}
                                        <label className="absolute bottom-0 right-0 p-1.5 bg-primary-600 rounded-full cursor-pointer hover:bg-primary-700">
                                            <Upload className="h-4 w-4 text-white" />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handlePhotoUpload}
                                            />
                                        </label>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">Student Photo</p>
                                        <p className="text-xs text-gray-500 mt-1">Upload a clear photo (JPG, PNG)</p>
                                    </div>
                                </div>

                                {/* Name Field - Single Input */}
                                <div>
                                    <label className="label">Student Name *</label>
                                    <input
                                        className="input"
                                        value={form.fullName}
                                        onChange={(e) => updateField('fullName', e.target.value)}
                                        required
                                        placeholder="Enter full name"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Enter the complete name as it should appear on records</p>
                                </div>

                                {/* Contact & Login */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Email *</label>
                                        <input
                                            type="email"
                                            className="input"
                                            value={form.email}
                                            onChange={(e) => updateField('email', e.target.value)}
                                            required={!student}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Phone</label>
                                        <input
                                            className="input"
                                            value={form.phone}
                                            onChange={(e) => updateField('phone', e.target.value)}
                                            placeholder="+919876543210"
                                        />
                                    </div>
                                </div>

                                {!student && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="label">Password (optional)</label>
                                            <input
                                                type="password"
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
                                                <span className="text-sm text-gray-700">Create login credentials</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Academic Info */}
                                <div className="border-t border-gray-100 pt-4">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Academic Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="label">Academic Year *</label>
                                            <input
                                                className="input"
                                                value={form.academicYear}
                                                onChange={(e) => updateField('academicYear', e.target.value)}
                                                required
                                                placeholder="2025-2026"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Class *</label>
                                            <select
                                                className="input"
                                                value={form.class}
                                                onChange={(e) => updateField('class', e.target.value)}
                                                required
                                            >
                                                <option value="">Select Class</option>
                                                {STANDARD_CLASSES.map(cls => (
                                                    <option key={cls.value} value={cls.value}>
                                                        {cls.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">Section</label>
                                            <input
                                                className="input"
                                                value={form.section}
                                                onChange={(e) => updateField('section', e.target.value)}
                                                placeholder="A"
                                            />
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <div>
                                            <label className="label">Admission Date</label>
                                            <input
                                                type="date"
                                                className="input"
                                                value={form.admissionDate}
                                                onChange={(e) => updateField('admissionDate', e.target.value)}
                                            />
                                        </div>
                                        {student && (
                                            <div>
                                                <label className="label">Admission Number</label>
                                                <input
                                                    className="input bg-gray-50"
                                                    value={form.admissionNumber}
                                                    readOnly
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
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
                                                className="input bg-gray-50"
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
                                            className="input"
                                            value={form.dateOfBirth}
                                            onChange={(e) => updateField('dateOfBirth', e.target.value)}
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
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                            <span className="text-sm text-gray-700">Orphan Status</span>
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
                                {form.guardians.map((guardian, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-semibold text-gray-900">
                                                {guardian.isPrimary ? 'Primary Guardian' : 'Secondary Guardian'}
                                            </h4>
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
                                                    className="input"
                                                    value={guardian.name}
                                                    onChange={(e) => updateGuardian(index, 'name', e.target.value)}
                                                    required={guardian.isPrimary}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label className="label">Phone *</label>
                                                <input
                                                    className="input"
                                                    value={guardian.phone}
                                                    onChange={(e) => updateGuardian(index, 'phone', e.target.value)}
                                                    required={guardian.isPrimary}
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Email</label>
                                                <input
                                                    type="email"
                                                    className="input"
                                                    value={guardian.email}
                                                    onChange={(e) => updateGuardian(index, 'email', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="label">Occupation</label>
                                            <input
                                                className="input"
                                                value={guardian.occupation}
                                                onChange={(e) => updateGuardian(index, 'occupation', e.target.value)}
                                            />
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

                                <div className="border-t border-gray-100 pt-4">
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
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200 mt-6">
                        <div className="flex gap-2">
                            {activeSection > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setActiveSection(activeSection - 1)}
                                    className="btn btn-outline"
                                >
                                    Previous
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="btn btn-ghost"
                            >
                                Cancel
                            </button>
                            {activeSection < sections.length - 1 ? (
                                <button
                                    type="button"
                                    onClick={() => setActiveSection(activeSection + 1)}
                                    className="btn btn-primary"
                                >
                                    Next
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Saving...' : student ? 'Update Student' : 'Add Student'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default StudentForm
