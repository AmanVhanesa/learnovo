import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, Check, FileText, Printer, AlertCircle, AlertTriangle, Edit3, Eye, Download, X, Plus, Tag } from 'lucide-react';
import certificateService from '../../services/certificateService';
import studentsService from '../../services/studentsService';
import { reportsService } from '../../services/reportsService';
import { toast } from 'react-hot-toast';
import CertificatePreviewContent from './CertificatePreviewContent';
import { highQualityPrint } from '../../utils/highQualityPrint';

const Loader2 = ({ className }) => <svg className={`w-5 h-5 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>;

const ModifiedBadge = () => (
    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium">Modified</span>
);

const EditableField = ({ label, field, placeholder = '', value, modified, onChange }) => (
    <div>
        <label className="label mb-1.5 flex items-center gap-2">
            {label}
            {modified && <ModifiedBadge />}
        </label>
        <input type="text" className="input" placeholder={placeholder} value={value || ''} onChange={(e) => onChange(field, e.target.value)} />
    </div>
);

const SelectField = ({ label, field, options, value, modified, onChange }) => (
    <div>
        <label className="label mb-1.5 flex items-center gap-2">
            {label}
            {modified && <ModifiedBadge />}
        </label>
        <select className="input" value={value || options[0]} onChange={(e) => onChange(field, e.target.value)}>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);

const DEFAULT_TC_REMARKS = [
    'No dues pending against the student.',
    'The student has been regular in attendance.',
    'The student bears a good moral character.',
    'The student is promoted to the next class.',
    'The student has participated in extracurricular activities.',
    'No disciplinary action has been taken against the student.',
];

const CUSTOM_REMARKS_KEY = 'learnovo_custom_tc_remarks';

const getCustomRemarks = () => {
    try {
        return JSON.parse(localStorage.getItem(CUSTOM_REMARKS_KEY) || '[]');
    } catch { return []; }
};

const saveCustomRemarks = (remarks) => {
    localStorage.setItem(CUSTOM_REMARKS_KEY, JSON.stringify(remarks));
};

const CertificateGeneration = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [certType, setCertType] = useState('BONAFIDE');
    const [previewData, setPreviewData] = useState(null);
    const [autoDeactivate, setAutoDeactivate] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [originalData, setOriginalData] = useState(null); // snapshot for "modified" indicators
    const [customCategory, setCustomCategory] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [showFeesModal, setShowFeesModal] = useState(false);
    const [isPrintLoading, setIsPrintLoading] = useState(false);
    const certPrintRef = useRef(null);
    const [feesSkipped, setFeesSkipped] = useState(false);
    const [cancelInvoices, setCancelInvoices] = useState(false);
    const [customRemarks, setCustomRemarks] = useState(getCustomRemarks);
    const [newCustomRemark, setNewCustomRemark] = useState('');

    // Debounce the search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: searchResults = [], isFetching: searching } = useQuery({
        queryKey: ['student-search', debouncedSearch],
        queryFn: async () => {
            const response = await studentsService.list({ search: debouncedSearch, limit: 10 });
            const results = response.data || [];
            // Sort: admission number matches first, then name, then phone/other
            const term = debouncedSearch.toLowerCase();
            return results.sort((a, b) => {
                const aAdm = a.admissionNumber && String(a.admissionNumber).toLowerCase().includes(term);
                const bAdm = b.admissionNumber && String(b.admissionNumber).toLowerCase().includes(term);
                if (aAdm && !bAdm) return -1;
                if (!aAdm && bAdm) return 1;
                const aName = (a.fullName || a.name || '').toLowerCase().includes(term);
                const bName = (b.fullName || b.name || '').toLowerCase().includes(term);
                if (aName && !bName) return -1;
                if (!aName && bName) return 1;
                return 0;
            });
        },
        enabled: debouncedSearch.length >= 2,
    });

    const getMatchedField = (student) => {
        if (!debouncedSearch) return null;
        const term = debouncedSearch.toLowerCase();
        const fields = [
            { key: 'admissionNumber', label: 'Admission No' },
            { key: 'name', label: 'Name' },
            { key: 'fullName', label: 'Name' },
            { key: 'rollNumber', label: 'Roll No' },
            { key: 'studentId', label: 'Student ID' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
        ];
        for (const { key, label } of fields) {
            const val = student[key];
            if (val && String(val).toLowerCase().includes(term)) return { label, value: String(val) };
        }
        return null;
    };

    const selectStudent = (student) => {
        setSelectedStudent(student);
        setSearchTerm('');
        setDebouncedSearch('');
    };

    const previewMutation = useMutation({
        mutationFn: () => certificateService.previewCertificate(selectedStudent._id, certType),
        onSuccess: (data) => {
            setPreviewData({ ...data });
            setOriginalData({ ...data }); // snapshot for "modified" indicators
            setCustomCategory(!['General', 'SC', 'ST', 'OBC'].includes(data.category));
            setStep(2);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to generate preview');
        },
    });

    const handlePreview = () => {
        if (!selectedStudent) return;
        previewMutation.mutate();
    };

    const loading = previewMutation.isPending;

    const generateMutation = useMutation({
        mutationFn: () => certificateService.generateCertificate(
            selectedStudent._id,
            certType,
            previewData,
            autoDeactivate,
            undefined, undefined, undefined,
            certType === 'TC' ? feesSkipped : undefined,
            certType === 'TC' ? cancelInvoices : undefined
        ),
        onSuccess: async (response) => {
            // Verify we got a valid PDF blob (not a JSON error wrapped as blob)
            const blob = response.data;
            if (blob.type && blob.type.includes('application/json')) {
                const text = await blob.text();
                const err = JSON.parse(text);
                throw new Error(err.message || 'Generation failed');
            }

            const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            const studentName = (selectedStudent.fullName || selectedStudent.name || 'certificate').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
            link.setAttribute('download', `${certType}_${studentName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Certificate generated successfully!');
            // Sync any modified student details back to the student profile
            await syncModifiedFieldsToProfile();
            const certLabel = certType === 'TC' ? 'Leaving Certificate' : 'Bonafide Certificate';
            reportsService.logActivity({
                type: 'certificate', action: 'pdf_export',
                message: `${certLabel} exported as PDF for ${selectedStudent.fullName || selectedStudent.name}`,
                studentName: selectedStudent.fullName || selectedStudent.name
            });
            queryClient.invalidateQueries({ queryKey: ['certificate-history'] });
            navigate('/app/certificates');
        },
        onError: async (error) => {
            // Extract error message from blob error responses (409 duplicate, 400 validation, 500 server)
            let message = 'Generation failed';
            try {
                const respData = error.response?.data;
                if (respData instanceof Blob) {
                    const text = await respData.text();
                    const parsed = JSON.parse(text);
                    message = parsed.message || message;
                } else if (respData && typeof respData === 'object' && respData.message) {
                    message = respData.message;
                } else if (respData && typeof respData.text === 'function') {
                    // ArrayBuffer or other blob-like
                    const text = await respData.text();
                    const parsed = JSON.parse(text);
                    message = parsed.message || message;
                } else if (error.message) {
                    message = error.message;
                }
            } catch {
                // If all parsing fails, use the status-based message
                if (error.response?.status === 409) {
                    const certLabel = certType === 'TC' ? 'Leaving Certificate' : 'Bonafide Certificate';
                    message = `${certLabel} has already been generated for this student. You can download it from the Certificate Manager.`;
                }
            }
            toast.error(message);
        },
    });

    const handleGenerate = () => {
        // Gate: check pending fees for TC before generating
        if (certType === 'TC' && previewData?.pendingFeesInfo?.hasPending && !feesSkipped) {
            setShowFeesModal(true);
            return;
        }
        generateMutation.mutate();
    };

    const handleSkipFees = () => {
        setFeesSkipped(true);
        setCancelInvoices(false);
        setShowFeesModal(false);
        // Proceed with generation after marking fees as skipped
        generateMutation.mutate();
    };

    const handleCancelInvoicesAndGenerate = () => {
        setFeesSkipped(true);
        setCancelInvoices(true);
        setShowFeesModal(false);
        // Proceed with generation — backend will cancel all pending invoices
        generateMutation.mutate();
    };

    const generating = generateMutation.isPending;

    // Build the merged data for preview/export
    const getMergedData = () => {
        if (!previewData) return {};
        return { ...previewData };
    };

    // Helpers for the editable form
    const isModified = (field) => originalData && previewData && previewData[field] !== originalData[field];

    const handleFieldChange = useCallback((field, value) => {
        setPreviewData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Fields that map certificate preview → student profile
    const PROFILE_FIELD_MAP = {
        studentName: 'fullName',
        fatherName: 'fatherOrHusbandName',
        motherName: 'motherName', // updated via guardians array on backend
        dob: 'dateOfBirth',
        nationality: 'nationality',
        category: 'category',
    };

    const syncModifiedFieldsToProfile = async () => {
        if (!originalData || !previewData || !selectedStudent?._id) return;
        const updates = {};
        for (const [certField, userField] of Object.entries(PROFILE_FIELD_MAP)) {
            if (previewData[certField] !== originalData[certField] && previewData[certField]) {
                updates[userField] = previewData[certField];
            }
        }
        if (Object.keys(updates).length === 0) return;

        // Handle special guardian-based fields
        const guardianUpdates = [];
        if (updates.fatherOrHusbandName) {
            guardianUpdates.push({ relation: 'Father', name: updates.fatherOrHusbandName });
        }
        if (updates.motherName) {
            guardianUpdates.push({ relation: 'Mother', name: updates.motherName });
            delete updates.motherName;
        }

        try {
            const payload = { ...updates };
            if (guardianUpdates.length > 0) {
                // Merge with existing guardians
                const existingGuardians = selectedStudent.guardians || [];
                const mergedGuardians = [...existingGuardians];
                for (const gu of guardianUpdates) {
                    const idx = mergedGuardians.findIndex(g => g.relation === gu.relation);
                    if (idx >= 0) {
                        mergedGuardians[idx] = { ...mergedGuardians[idx], ...gu };
                    } else {
                        mergedGuardians.push(gu);
                    }
                }
                payload.guardians = mergedGuardians;
                delete payload.fatherOrHusbandName;
            }
            await studentsService.update(selectedStudent._id, payload);
            queryClient.invalidateQueries({ queryKey: ['students'] });
        } catch {
            // Silent fail — certificate was already generated successfully
        }
    };

    const addCustomRemark = () => {
        const trimmed = newCustomRemark.trim();
        if (!trimmed) return;
        if ([...DEFAULT_TC_REMARKS, ...customRemarks].includes(trimmed)) {
            toast.error('This remark already exists');
            return;
        }
        const updated = [...customRemarks, trimmed];
        setCustomRemarks(updated);
        saveCustomRemarks(updated);
        setNewCustomRemark('');
        toast.success('Custom remark saved');
    };

    const removeCustomRemark = (remark) => {
        const updated = customRemarks.filter(r => r !== remark);
        setCustomRemarks(updated);
        saveCustomRemarks(updated);
    };

    const appendRemark = (remark) => {
        setPreviewData(prev => {
            const current = (prev.remarks || '').trim();
            if (current.includes(remark)) return prev;
            const separator = current ? '\n' : '';
            return { ...prev, remarks: current + separator + remark };
        });
    };

    const handleOpenPreview = () => {
        setShowPreviewModal(true);
        const certLabel = certType === 'TC' ? 'Leaving Certificate' : 'Bonafide Certificate';
        reportsService.logActivity({
            type: 'certificate', action: 'preview',
            message: `${certLabel} previewed for student ${selectedStudent.fullName || selectedStudent.name}`,
            studentName: selectedStudent.fullName || selectedStudent.name
        });
    };

    const handlePrintPreview = async () => {
        if (!certPrintRef.current) return;
        setIsPrintLoading(true);
        try {
            const filename = certType === 'TC' ? 'Transfer-Certificate' : 'Bonafide-Certificate';
            await highQualityPrint(certPrintRef.current, filename, {
                scale: 4, format: 'a5', orientation: 'portrait', margin: 0,
            });
            toast.success('PDF downloaded — open it and print for best quality', { duration: 4000 });
        } catch (error) {
            console.error('Print failed:', error);
            toast.error('Failed to prepare print. Please try again.');
        } finally {
            setIsPrintLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/app/certificates')} className="btn-icon flex-shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Generate Certificate</h1>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center">
                <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-[#636366]'}`}>
                    <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold border-current flex-shrink-0">{step > 1 ? <Check className="h-4 w-4" /> : '1'}</div>
                    <span className="text-xs sm:text-sm font-medium hidden sm:inline">Select Student</span>
                </div>
                <div className="w-8 sm:w-16 h-0.5 bg-gray-200 dark:bg-[#38383A] mx-2 sm:mx-4" />
                <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-[#636366]'}`}>
                    <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold border-current flex-shrink-0">2</div>
                    <span className="text-xs sm:text-sm font-medium hidden sm:inline">Preview & Validate</span>
                </div>
            </div>

            {/* Content Card */}
            <div className="card p-4 sm:p-8">

                {/* STEP 1 */}
                {step === 1 && (
                    <div className="max-w-xl mx-auto space-y-8">
                        <div>
                            <label className="label mb-2 block">Certificate Type</label>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { value: 'BONAFIDE', label: 'Bonafide Certificate' },
                                    { value: 'TC', label: 'Leaving Certificate (TC)' }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setCertType(opt.value)}
                                        className={`p-4 border rounded-xl text-center text-sm font-medium transition-all duration-200 ${certType === opt.value
                                            ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:ring-primary-500/30'
                                            : 'border-gray-200 dark:border-[#38383A] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93]'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="label mb-2 block">Search Student</label>
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                <input
                                    type="text"
                                    placeholder="Enter Name or Admission Number..."
                                    className="input pl-10 py-3"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="animate-spin text-gray-400 dark:text-[#636366]" />
                                    </div>
                                )}
                            </div>

                            {searchResults.length > 0 && (
                                <div className="mt-2 border border-gray-200 dark:border-[#38383A] rounded-xl max-h-60 overflow-y-auto">
                                    {searchResults.map(student => (
                                        <div
                                            key={student._id}
                                            onClick={() => selectStudent(student)}
                                            className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer border-b border-gray-100 dark:border-[#38383A] last:border-0 flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">{student.fullName}</p>
                                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                                    {student.admissionNumber} | Class {student.class}
                                                    {(() => {
                                                        const match = getMatchedField(student);
                                                        return match && match.label !== 'Name' && match.value !== String(student.admissionNumber)
                                                            ? <span className="ml-1 text-amber-600 dark:text-amber-400"> · Matched {match.label}: {match.value}</span>
                                                            : null;
                                                    })()}
                                                </p>
                                            </div>
                                            <span className="text-xs font-medium text-primary-600 dark:text-primary-400">Select</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedStudent && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                                        <Check className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">{selectedStudent.fullName}</p>
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Selected for {certType}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedStudent(null)} className="text-xs text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] underline">Change</button>
                            </div>
                        )}

                        <div className="pt-4">
                            <button
                                onClick={handlePreview}
                                disabled={!selectedStudent || loading}
                                className="btn btn-primary w-full py-3 gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Continue to Preview'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2 — Unified Editable Form */}
                {step === 2 && previewData && (
                    <div className="space-y-6">

                        {/* Info banner */}
                        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-400 rounded-xl text-sm border border-blue-200 dark:border-blue-800">
                            <Edit3 className="h-5 w-5 shrink-0 mt-0.5" />
                            <p>All fields below are editable. Changes to <strong>student name, parents&apos; names, date of birth, nationality, and category</strong> will also update the student&apos;s profile. Other overrides apply only to this certificate.</p>
                        </div>

                        {/* Student Details */}
                        <div className="bg-gray-50 dark:bg-[#2C2C2E] p-6 rounded-xl border border-gray-100 dark:border-[#38383A]">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] border-b border-gray-200 dark:border-[#38383A] pb-3 mb-5">Student Details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                                <EditableField label="Student Name" field="studentName" value={previewData.studentName} modified={isModified('studentName')} onChange={handleFieldChange} />
                                <EditableField label="Father's Name" field="fatherName" value={previewData.fatherName} modified={isModified('fatherName')} onChange={handleFieldChange} />
                                <EditableField label="Mother's Name" field="motherName" value={previewData.motherName} modified={isModified('motherName')} onChange={handleFieldChange} />
                                <EditableField label="Date of Birth" field="dob" placeholder="e.g. 15 Mar 2015" value={previewData.dob} modified={isModified('dob')} onChange={handleFieldChange} />
                                {certType === 'TC' && <EditableField label="Date of Birth (in Words)" field="dobWords" placeholder="e.g. Fifteenth March, Two Thousand Fifteen" value={previewData.dobWords} modified={isModified('dobWords')} onChange={handleFieldChange} />}
                                <EditableField label="Nationality" field="nationality" value={previewData.nationality} modified={isModified('nationality')} onChange={handleFieldChange} />
                                {/* Category — hybrid dropdown + custom */}
                                <div>
                                    <label className="label mb-1.5 flex items-center gap-2">
                                        Category / Caste
                                        {isModified('category') && <ModifiedBadge />}
                                    </label>
                                    {!customCategory ? (
                                        <select
                                            className="input"
                                            value={['General', 'SC', 'ST', 'OBC'].includes(previewData.category) ? previewData.category : '__custom__'}
                                            onChange={(e) => {
                                                if (e.target.value === '__custom__') {
                                                    setCustomCategory(true);
                                                    setPreviewData(prev => ({ ...prev, category: '' }));
                                                } else {
                                                    setPreviewData(prev => ({ ...prev, category: e.target.value }));
                                                }
                                            }}
                                        >
                                            <option value="General">General</option>
                                            <option value="SC">SC</option>
                                            <option value="ST">ST</option>
                                            <option value="OBC">OBC</option>
                                            <option value="__custom__">Enter custom...</option>
                                        </select>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="e.g. Gupta, Rajput, Brahmin..."
                                                className="input flex-1"
                                                value={previewData.category || ''}
                                                onChange={(e) => setPreviewData(prev => ({ ...prev, category: e.target.value }))}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCustomCategory(false);
                                                    setPreviewData(prev => ({ ...prev, category: originalData?.category || 'General' }));
                                                }}
                                                className="text-xs text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white underline whitespace-nowrap"
                                            >
                                                Use dropdown
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Academic Details */}
                        <div className="bg-gray-50 dark:bg-[#2C2C2E] p-6 rounded-xl border border-gray-100 dark:border-[#38383A]">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] border-b border-gray-200 dark:border-[#38383A] pb-3 mb-5">Academic Details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                                <EditableField label="Admission Number" field="admissionNumber" value={previewData.admissionNumber} modified={isModified('admissionNumber')} onChange={handleFieldChange} />
                                <EditableField label="Date of Admission" field="admissionDate" value={previewData.admissionDate} modified={isModified('admissionDate')} onChange={handleFieldChange} />
                                <EditableField label={certType === 'TC' ? 'Class in which Last Studied' : 'Class'} field="class" placeholder="e.g. Nursery, LKG, Class 5" value={previewData.class} modified={isModified('class')} onChange={handleFieldChange} />
                                {certType === 'BONAFIDE' && <EditableField label="Section" field="section" value={previewData.section} modified={isModified('section')} onChange={handleFieldChange} />}
                                {certType === 'BONAFIDE' && <EditableField label="Academic Year" field="academicYear" value={previewData.academicYear} modified={isModified('academicYear')} onChange={handleFieldChange} />}
                                {certType === 'TC' && <EditableField label="PEN Number" field="penNumber" value={previewData.penNumber} modified={isModified('penNumber')} onChange={handleFieldChange} />}
                                {certType === 'TC' && <EditableField label="Subjects Studied" field="subjects" value={previewData.subjects} modified={isModified('subjects')} onChange={handleFieldChange} />}
                                {certType === 'TC' && <SelectField label="Board Exam Result" field="boardResult" options={['Passed', 'Failed', 'Appeared', 'Not Appeared']} value={previewData.boardResult} modified={isModified('boardResult')} onChange={handleFieldChange} />}
                                {certType === 'TC' && <SelectField label="Qualified for Promotion" field="promotionStatus" options={['Yes', 'No']} value={previewData.promotionStatus} modified={isModified('promotionStatus')} onChange={handleFieldChange} />}
                            </div>
                        </div>

                        {/* Leaving Details — TC only */}
                        {certType === 'TC' && (
                            <div className="bg-gray-50 dark:bg-[#2C2C2E] p-6 rounded-xl border border-gray-100 dark:border-[#38383A]">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] border-b border-gray-200 dark:border-[#38383A] pb-3 mb-5">Leaving Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                                    {/* Reason for Leaving — dropdown + custom */}
                                    <div>
                                        <label className="label mb-1.5 flex items-center gap-2">
                                            Reason for Leaving
                                            {isModified('leavingReason') && <ModifiedBadge />}
                                        </label>
                                        <div className="space-y-2">
                                            <select
                                                className="input"
                                                value={['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(previewData.leavingReason) ? previewData.leavingReason : 'Other'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setPreviewData(prev => ({ ...prev, leavingReason: val === 'Other' ? '' : val }));
                                                }}
                                            >
                                                <option value="Parent Request">Parent Request</option>
                                                <option value="Completed Studies">Completed Studies</option>
                                                <option value="Transfer">Transfer</option>
                                                <option value="Medical Grounds">Medical Grounds</option>
                                                <option value="Other">Other (Custom)</option>
                                            </select>
                                            {!['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(previewData.leavingReason) && (
                                                <input type="text" placeholder="Enter custom reason..." className="input" value={previewData.leavingReason || ''} onChange={(e) => setPreviewData(prev => ({ ...prev, leavingReason: e.target.value }))} />
                                            )}
                                        </div>
                                    </div>
                                    <SelectField label="General Conduct" field="conduct" options={['Good', 'Very Good', 'Excellent', 'Satisfactory', 'Needs Improvement']} value={previewData.conduct} modified={isModified('conduct')} onChange={handleFieldChange} />
                                    <SelectField label="Fee Status" field="feeStatus" options={['Paid up to date', 'Pending', 'Partially Paid']} value={previewData.feeStatus} modified={isModified('feeStatus')} onChange={handleFieldChange} />
                                    <EditableField label="Date of Application" field="applicationDate" value={previewData.applicationDate} modified={isModified('applicationDate')} onChange={handleFieldChange} />
                                    <EditableField label="Date of Issue" field="issueDate" value={previewData.issueDate} modified={isModified('issueDate')} onChange={handleFieldChange} />
                                </div>
                            </div>
                        )}

                        {/* Certificate Details — Bonafide only */}
                        {certType === 'BONAFIDE' && (
                            <div className="bg-gray-50 dark:bg-[#2C2C2E] p-6 rounded-xl border border-gray-100 dark:border-[#38383A]">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] border-b border-gray-200 dark:border-[#38383A] pb-3 mb-5">Certificate Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                                    <EditableField label="Purpose" field="purpose" placeholder="e.g. For school admission" value={previewData.purpose} modified={isModified('purpose')} onChange={handleFieldChange} />
                                    <EditableField label="Date of Issue" field="issueDate" value={previewData.issueDate} modified={isModified('issueDate')} onChange={handleFieldChange} />
                                </div>
                            </div>
                        )}

                        {/* Additional Information */}
                        <div className="bg-gray-50 dark:bg-[#2C2C2E] p-6 rounded-xl border border-gray-100 dark:border-[#38383A]">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] border-b border-gray-200 dark:border-[#38383A] pb-3 mb-5">Additional Information</h3>
                            <div className="grid grid-cols-1 gap-y-5">
                                {/* Remarks with preset selection */}
                                <div>
                                    <label className="label mb-1.5 flex items-center gap-2">
                                        Remarks
                                        {isModified('remarks') && <ModifiedBadge />}
                                    </label>
                                    <textarea
                                        className="input min-h-[80px] resize-y"
                                        placeholder="Type remarks or select from presets below..."
                                        value={previewData.remarks || ''}
                                        onChange={(e) => handleFieldChange('remarks', e.target.value)}
                                        rows={3}
                                    />

                                    {/* Quick-select remark chips */}
                                    {certType === 'TC' && (
                                        <div className="mt-3 space-y-3">
                                            <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93]">Quick add remarks (click to append):</p>
                                            <div className="flex flex-wrap gap-2">
                                                {[...DEFAULT_TC_REMARKS, ...customRemarks].map((remark) => {
                                                    const isActive = (previewData.remarks || '').includes(remark);
                                                    const isCustom = customRemarks.includes(remark);
                                                    return (
                                                        <button
                                                            key={remark}
                                                            type="button"
                                                            onClick={() => appendRemark(remark)}
                                                            className={`group relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all duration-150 ${
                                                                isActive
                                                                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400'
                                                                    : 'bg-white dark:bg-[#1C1C1E] border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600'
                                                            }`}
                                                        >
                                                            <Tag className="h-3 w-3 shrink-0" />
                                                            <span className="max-w-[200px] truncate">{remark}</span>
                                                            {isActive && <Check className="h-3 w-3 shrink-0 text-primary-500" />}
                                                            {isCustom && !isActive && (
                                                                <span
                                                                    onClick={(e) => { e.stopPropagation(); removeCustomRemark(remark); }}
                                                                    className="hidden group-hover:inline-flex ml-0.5 text-red-400 hover:text-red-600"
                                                                    title="Remove custom remark"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Add custom remark */}
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    className="input text-sm flex-1"
                                                    placeholder="Add a custom remark template..."
                                                    value={newCustomRemark}
                                                    onChange={(e) => setNewCustomRemark(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomRemark(); } }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={addCustomRemark}
                                                    disabled={!newCustomRemark.trim()}
                                                    className="btn btn-outline text-sm gap-1.5 px-3 py-2 shrink-0"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {certType === 'TC' && selectedStudent?.isActive !== false && (
                                    <div>
                                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-400">
                                            <input type="checkbox" className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500" checked={autoDeactivate} onChange={(e) => setAutoDeactivate(e.target.checked)} />
                                            <span className="font-medium text-sm">Automatically deactivate student profile upon generation</span>
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 rounded-xl text-sm border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <p>Please review the details carefully. Once generated, a certificate number will be assigned and it cannot be edited. Reprints will carry the same number.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                            <button onClick={() => setStep(1)} className="btn btn-outline w-full sm:w-auto">Back</button>
                            <button onClick={handleOpenPreview} className="btn btn-outline gap-2 w-full sm:w-auto">
                                <Eye className="h-4 w-4" />
                                Preview
                            </button>
                            <button onClick={handleGenerate} disabled={generating} className="btn btn-primary gap-2 w-full sm:w-auto">
                                {generating ? 'Generating...' : (
                                    <>
                                        <Printer className="h-4 w-4" />
                                        Issue Certificate
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {/* Certificate Preview Modal */}
            {showPreviewModal && previewData && createPortal(
                <div className="modal-overlay" onClick={() => setShowPreviewModal(false)} style={{ zIndex: 50 }}>
                    <div className="flex flex-col items-center max-h-[95vh] w-full max-w-3xl mx-4" onClick={e => e.stopPropagation()}>
                        {/* Modal header */}
                        <div className="w-full flex items-center justify-between bg-white dark:bg-[#1C1C1E] border-b border-gray-200 dark:border-[#38383A] px-5 py-3 rounded-t-2xl">
                            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">Certificate Preview</h3>
                            <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* A4 Paper area */}
                        <div className="w-full flex-1 min-h-0 overflow-y-auto bg-gray-100 dark:bg-[#2C2C2E] p-6 sm:p-10 flex justify-center">
                            <div ref={certPrintRef}>
                                <CertificatePreviewContent
                                    type={certType}
                                    data={getMergedData()}
                                    certificateNumber="To be assigned"
                                    showPreviewWatermark={false}
                                />
                            </div>
                        </div>

                        {/* Modal footer with action buttons */}
                        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 bg-white dark:bg-[#1C1C1E] border-t border-gray-200 dark:border-[#38383A] px-5 py-4 rounded-b-2xl">
                            <button
                                onClick={handlePrintPreview}
                                disabled={isPrintLoading}
                                className="btn btn-primary gap-2 w-full sm:w-auto text-sm"
                            >
                                <Printer className="h-4 w-4" />
                                {isPrintLoading ? 'Preparing High Quality Print...' : 'Print'}
                            </button>
                            <button
                                onClick={() => { setShowPreviewModal(false); handleGenerate(); }}
                                disabled={generating}
                                className="btn btn-outline gap-2 w-full sm:w-auto text-sm"
                            >
                                <Download className="h-4 w-4" />
                                Export as PDF
                            </button>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="btn btn-outline w-full sm:w-auto text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Pending Fees / Outstanding Dues Modal ── */}
            {showFeesModal && previewData?.pendingFeesInfo && createPortal(
                <div className="modal-overlay" onClick={() => setShowFeesModal(false)}>
                    <div
                        className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg ring-1 ring-white dark:ring-[#1C1C1E] max-w-lg w-full mx-4 animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 pb-0">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Outstanding Dues</h3>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">This student has pending fees that need attention</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {/* Student & Total Due */}
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Student</span>
                                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{selectedStudent?.fullName || selectedStudent?.name}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Due Amount</span>
                                    <span className="font-bold text-red-600 dark:text-red-400 text-xl">
                                        {'\u20B9'}{previewData.pendingFeesInfo.totalAmount?.toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>

                            {/* Invoice Breakdown */}
                            {previewData.pendingFeesInfo.invoices?.length > 0 && (
                                <div className="border border-gray-100 dark:border-[#38383A] rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-gray-50 dark:bg-[#2C2C2E] text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider flex items-center justify-between">
                                        <span>Pending Invoices ({previewData.pendingFeesInfo.invoices.length})</span>
                                        <span>Balance</span>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-[#38383A]">
                                        {previewData.pendingFeesInfo.invoices.map((inv, i) => (
                                            <div key={inv.id || i} className="px-3 py-2.5 flex items-center justify-between text-sm">
                                                <div className="min-w-0 flex-1 mr-3">
                                                    <p className="text-gray-800 dark:text-gray-200 font-medium truncate">{inv.description}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-gray-400 dark:text-[#636366]">{inv.invoiceNumber}</span>
                                                        {inv.periodLabel && <span className="text-xs text-gray-400 dark:text-[#636366]">&middot; {inv.periodLabel}</span>}
                                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                                            inv.status === 'Overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                            inv.status === 'Partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        }`}>{inv.status}</span>
                                                    </div>
                                                </div>
                                                <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{'\u20B9'}{inv.balance?.toLocaleString('en-IN')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Legacy Fee Breakdown (if any) */}
                            {previewData.pendingFeesInfo.breakdown?.length > 0 && (
                                <div className="border border-gray-100 dark:border-[#38383A] rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-gray-50 dark:bg-[#2C2C2E] text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                        Other Pending Fees ({previewData.pendingFeesInfo.breakdown.length})
                                    </div>
                                    <div className="max-h-32 overflow-y-auto divide-y divide-gray-100 dark:divide-[#38383A]">
                                        {previewData.pendingFeesInfo.breakdown.map((fee, i) => (
                                            <div key={fee.id || i} className="px-3 py-2 flex items-center justify-between text-sm">
                                                <div>
                                                    <p className="text-gray-800 dark:text-gray-200 font-medium">{fee.description}</p>
                                                    <p className="text-xs text-gray-400 dark:text-[#636366] capitalize">{fee.feeType} &middot; {fee.status}</p>
                                                </div>
                                                <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{'\u20B9'}{fee.balance?.toLocaleString('en-IN')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-gray-400 dark:text-[#636366] leading-relaxed">
                                Choose how to handle the outstanding dues before issuing the Leaving Certificate. All actions will be recorded in the certificate audit.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="p-6 pt-2 space-y-2">
                            {/* Option 1: Collect fees first */}
                            <button
                                onClick={() => {
                                    setShowFeesModal(false);
                                    navigate(`/app/fees?student=${selectedStudent._id}`);
                                }}
                                className="btn btn-primary w-full gap-2 justify-center"
                            >
                                <span className="text-sm">Collect Fees First</span>
                            </button>

                            {/* Option 2: Cancel invoices & issue TC */}
                            {previewData.pendingFeesInfo.invoices?.length > 0 && (
                                <button
                                    onClick={handleCancelInvoicesAndGenerate}
                                    disabled={generating}
                                    className="btn w-full gap-2 justify-center bg-red-500 hover:bg-red-600 text-white text-sm"
                                >
                                    {generating ? (
                                        <><Loader2 className="animate-spin" /> Generating...</>
                                    ) : (
                                        `Cancel All Invoices & Issue TC`
                                    )}
                                </button>
                            )}

                            {/* Option 3: Skip fees and issue */}
                            <button
                                onClick={handleSkipFees}
                                disabled={generating}
                                className="btn w-full gap-2 justify-center bg-amber-500 hover:bg-amber-600 text-white text-sm"
                            >
                                {generating ? (
                                    <><Loader2 className="animate-spin" /> Generating...</>
                                ) : (
                                    'Skip & Issue TC (Keep Dues Pending)'
                                )}
                            </button>

                            <button
                                onClick={() => setShowFeesModal(false)}
                                className="btn btn-outline w-full text-sm"
                            >
                                Go Back
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CertificateGeneration;
