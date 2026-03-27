import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, Check, FileText, Printer, AlertCircle, AlertTriangle, Edit3, Eye, Download, X } from 'lucide-react';
import certificateService from '../../services/certificateService';
import studentsService from '../../services/studentsService';
import { generateCertificateDocx } from '../../utils/certificateDocxExport';
import { reportsService } from '../../services/reportsService';
import { toast } from 'react-hot-toast';

const Loader2 = ({ className }) => <svg className={`w-5 h-5 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>;

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

    // TC override fields — ephemeral, only used for this certificate generation
    const [categoryOverride, setCategoryOverride] = useState('');
    const [classOverride, setClassOverride] = useState('');
    const [penOverride, setPenOverride] = useState('');
    const [customCategory, setCustomCategory] = useState(false); // true when admin types a custom category
    const [showPreviewModal, setShowPreviewModal] = useState(false);

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
            return response.data || [];
        },
        enabled: debouncedSearch.length >= 2,
    });

    const selectStudent = (student) => {
        setSelectedStudent(student);
        setSearchTerm('');
        setDebouncedSearch('');
    };

    const previewMutation = useMutation({
        mutationFn: () => certificateService.previewCertificate(selectedStudent._id, certType),
        onSuccess: (data) => {
            setPreviewData(data);
            // Pre-fill TC override fields from DB values
            setCategoryOverride(data.category || '');
            setClassOverride(data.class || '');
            setPenOverride(data.penNumber || '');
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
            // Pass TC overrides (only effective for TC type)
            certType === 'TC' ? categoryOverride : undefined,
            certType === 'TC' ? classOverride : undefined,
            certType === 'TC' ? penOverride : undefined
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
            link.setAttribute('download', `${certType}_${selectedStudent.fullName || selectedStudent.name || 'certificate'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Certificate generated successfully!');
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
        generateMutation.mutate();
    };

    const generating = generateMutation.isPending;

    // Build the merged data for preview/export (includes TC overrides)
    const getMergedData = () => {
        if (!previewData) return {};
        return {
            ...previewData,
            ...(certType === 'TC' ? { category: categoryOverride || previewData.category, class: classOverride || previewData.class, penNumber: penOverride || previewData.penNumber } : {}),
        };
    };

    const handleExportWord = async () => {
        try {
            const data = getMergedData();
            await generateCertificateDocx(certType, data);
            const certLabel = certType === 'TC' ? 'Leaving Certificate' : 'Bonafide Certificate';
            reportsService.logActivity({
                type: 'certificate', action: 'word_export',
                message: `${certLabel} exported as Word document for ${selectedStudent.fullName || selectedStudent.name}`,
                studentName: selectedStudent.fullName || selectedStudent.name
            });
            toast.success('Word document exported!');
        } catch {
            toast.error('Failed to export Word document');
        }
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

    // Certificate preview rows helper
    const getPreviewRows = () => {
        const d = getMergedData();
        if (certType === 'TC') {
            return [
                ['Student Name', d.studentName],
                ["Father's / Guardian's Name", d.fatherName],
                ["Mother's Name", d.motherName],
                ['Nationality', d.nationality],
                ['Category', d.category],
                ['Date of Birth', d.dob],
                ['Date of Birth (in words)', d.dobWords],
                ['Admission Number', d.admissionNumber],
                ['Date of First Admission', d.admissionDate],
                ['Class in which Last Studied', d.class],
                ['Section', d.section],
                ['Academic Year', d.academicYear],
                ['Board Examination Result', d.boardResult],
                ['Promotion Status', d.promotionStatus],
                ['Subjects Studied', d.subjects],
                ['Fee Status', d.feeStatus],
                ['General Conduct', d.conduct],
                ['Date of Application', d.applicationDate],
                ['Date of Issue', d.issueDate],
                ['Reason for Leaving', d.leavingReason],
                ['Remarks', d.remarks],
            ];
        }
        return [
            ['Student Name', d.studentName],
            ["Father's Name", d.fatherName],
            ["Mother's Name", d.motherName],
            ['Admission Number', d.admissionNumber],
            ['Date of Birth', d.dob],
            ['Class', d.class],
            ['Section', d.section],
            ['Academic Year', d.academicYear],
            ['Category', d.category],
            ['Purpose', d.purpose],
        ];
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
                                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{student.admissionNumber} | Class {student.class}</p>
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

                {/* STEP 2 */}
                {step === 2 && previewData && (
                    <div className="space-y-6">

                        {/* Read-only confirmation fields */}
                        <div className="bg-gray-50 dark:bg-[#2C2C2E] p-6 rounded-xl border border-gray-100 dark:border-[#38383A]">
                            <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-[#8E8E93] font-semibold border-b border-gray-200 dark:border-[#38383A] pb-3">
                                <FileText className="h-5 w-5" />
                                Certificate Preview Data
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Student Name:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.studentName}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Father's Name:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.fatherName}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Mother's Name:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.motherName}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Date of Birth:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.dob}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Admission No:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.admissionNumber}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Date of Issue:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.issueDate}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Fees Status:</span> <span className={`font-medium ml-2 ${previewData.feeStatus?.toLowerCase()?.includes('paid') || previewData.feeStatus?.toLowerCase() === 'clear' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{previewData.feeStatus}</span></div>
                            </div>
                        </div>

                        {/* TC-specific: Override / Confirm Details section */}
                        {certType === 'TC' && (
                            <div className="bg-gray-50 dark:bg-[#2C2C2E] p-6 rounded-xl border border-gray-100 dark:border-[#38383A]">
                                <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-[#8E8E93] font-semibold border-b border-gray-200 dark:border-[#38383A] pb-3">
                                    <Edit3 className="h-5 w-5" />
                                    Override / Confirm Details
                                </div>
                                <p className="text-xs text-gray-500 dark:text-[#636366] mb-5">These overrides apply only to this certificate. The student's master record will not be changed.</p>

                                {/* Warning if category or class was empty in DB */}
                                {(!previewData.category || previewData.category === '-') && (
                                    <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 rounded-lg text-xs border border-amber-200 dark:border-amber-800">
                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>Category was not set in the student record. Please confirm or enter the correct value below.</span>
                                    </div>
                                )}
                                {(!previewData.class || previewData.class === '-') && (
                                    <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 rounded-lg text-xs border border-amber-200 dark:border-amber-800">
                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>Class was not set in the student record. Please confirm or enter the correct value below.</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                                    {/* Category / Caste — hybrid dropdown + custom */}
                                    <div>
                                        <label className="label mb-1.5 block">Category / Caste</label>
                                        {!customCategory ? (
                                            <select
                                                className="input"
                                                value={['General', 'SC', 'ST', 'OBC'].includes(categoryOverride) ? categoryOverride : '__custom__'}
                                                onChange={(e) => {
                                                    if (e.target.value === '__custom__') {
                                                        setCustomCategory(true);
                                                        setCategoryOverride('');
                                                    } else {
                                                        setCategoryOverride(e.target.value);
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
                                                    value={categoryOverride}
                                                    onChange={(e) => setCategoryOverride(e.target.value)}
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCustomCategory(false);
                                                        setCategoryOverride(previewData.category || 'General');
                                                    }}
                                                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white underline whitespace-nowrap"
                                                >
                                                    Use dropdown
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">DB value: {previewData.category || '-'}</p>
                                    </div>

                                    {/* Class in which Last Studied — free text */}
                                    <div>
                                        <label className="label mb-1.5 block">Class in which Last Studied</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Nursery, LKG, UKG, Class 1..."
                                            className="input"
                                            value={classOverride}
                                            onChange={(e) => setClassOverride(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">DB value: {previewData.class || '-'}</p>
                                    </div>

                                    {/* PEN Number — free text */}
                                    <div>
                                        <label className="label mb-1.5 block">PEN Number</label>
                                        <input
                                            type="text"
                                            placeholder="Enter PEN Number..."
                                            className="input"
                                            value={penOverride}
                                            onChange={(e) => setPenOverride(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">DB value: {previewData.penNumber || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TC-specific: Leaving Reason, Remarks, Auto-deactivate */}
                        {certType === 'TC' && (
                            <div className="bg-gray-50 dark:bg-[#2C2C2E] p-6 rounded-xl border border-gray-100 dark:border-[#38383A]">
                                <div className="grid grid-cols-1 gap-y-5">
                                    <div>
                                        <label className="label mb-1.5 block">Reason for Leaving</label>
                                        <div className="space-y-2">
                                            <select
                                                className="input"
                                                value={['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(previewData.leavingReason) ? previewData.leavingReason : 'Other'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setPreviewData({ ...previewData, leavingReason: val === 'Other' ? '' : val });
                                                }}
                                            >
                                                <option value="Parent Request">Parent Request</option>
                                                <option value="Completed Studies">Completed Studies</option>
                                                <option value="Transfer">Transfer</option>
                                                <option value="Medical Grounds">Medical Grounds</option>
                                                <option value="Other">Other (Custom)</option>
                                            </select>
                                            {!['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(previewData.leavingReason) && (
                                                <input type="text" placeholder="Enter custom reason..." className="input bg-gray-50 dark:bg-[#1C1C1E]" value={previewData.leavingReason} onChange={(e) => setPreviewData({ ...previewData, leavingReason: e.target.value })} />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label mb-1.5 block">Remarks</label>
                                        <input type="text" className="input" value={previewData.remarks} onChange={(e) => setPreviewData({ ...previewData, remarks: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-400">
                                            <input type="checkbox" className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500" checked={autoDeactivate} onChange={(e) => setAutoDeactivate(e.target.checked)} />
                                            <span className="font-medium text-sm">Automatically deactivate student profile upon generation</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

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
                        <div className="w-full flex items-center justify-between bg-[#1C1C1E] px-5 py-3 rounded-t-2xl">
                            <h3 className="text-white font-semibold text-sm">Certificate Preview</h3>
                            <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* A4 Paper area with dark background */}
                        <div className="w-full flex-1 overflow-y-auto bg-[#2C2C2E] p-6 sm:p-10 flex justify-center">
                            <div className="bg-white w-full max-w-[595px] min-h-[842px] shadow-2xl relative overflow-hidden" style={{ fontFamily: 'serif' }}>
                                {/* PREVIEW Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 1 }}>
                                    <span className="text-gray-200 font-bold tracking-widest" style={{ fontSize: '72px', transform: 'rotate(-35deg)', opacity: 0.35 }}>PREVIEW</span>
                                </div>

                                {/* Certificate content */}
                                <div className="relative p-8 sm:p-12" style={{ zIndex: 2 }}>
                                    {/* Border frame */}
                                    <div className="border-2 border-gray-400 p-6 sm:p-8" style={{ borderColor: '#b08d57' }}>
                                        {/* School name */}
                                        <h1 className="text-center font-bold text-lg sm:text-xl text-gray-900 mb-1">{getMergedData().schoolName || 'School Name'}</h1>
                                        <p className="text-center text-xs text-gray-500 mb-4">{getMergedData().schoolAddress}</p>

                                        {/* Certificate title */}
                                        <h2 className="text-center font-bold text-base sm:text-lg underline mb-4 text-gray-800">
                                            {certType === 'TC' ? 'SCHOOL LEAVING CERTIFICATE' : 'BONAFIDE CERTIFICATE'}
                                        </h2>

                                        {/* Certificate number & date */}
                                        <div className="text-right text-xs text-gray-600 mb-4 space-y-0.5">
                                            <p>Certificate No: <span className="font-medium">To be assigned</span></p>
                                            <p>Date: <span className="font-medium">{getMergedData().issueDate}</span></p>
                                        </div>

                                        {/* Bonafide declaration */}
                                        {certType === 'BONAFIDE' && (
                                            <p className="text-sm text-gray-700 mb-4">
                                                This is to certify that <strong>{getMergedData().studentName}</strong> is a bonafide student of this school. The details are as follows:
                                            </p>
                                        )}

                                        {/* Data table */}
                                        <table className="w-full text-xs border-collapse mb-6">
                                            <tbody>
                                                {getPreviewRows().map(([label, value], i) => (
                                                    <tr key={i} className="border-b border-gray-200">
                                                        <td className="py-1.5 pr-3 font-semibold text-gray-700 w-2/5 align-top">{label}</td>
                                                        <td className="py-1.5 text-gray-900">{value || 'N/A'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Signature block */}
                                        <div className="flex justify-between mt-10 pt-4">
                                            <div className="text-center">
                                                <div className="w-32 border-t border-gray-400 mb-1"></div>
                                                <p className="text-xs font-semibold text-gray-700">Class Teacher</p>
                                            </div>
                                            <div className="text-center">
                                                <div className="w-32 border-t border-gray-400 mb-1"></div>
                                                <p className="text-xs font-semibold text-gray-700">Principal</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal footer with action buttons */}
                        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 bg-[#1C1C1E] px-5 py-4 rounded-b-2xl">
                            <button
                                onClick={() => { setShowPreviewModal(false); handleGenerate(); }}
                                disabled={generating}
                                className="btn btn-primary gap-2 w-full sm:w-auto text-sm"
                            >
                                <Download className="h-4 w-4" />
                                Export as PDF
                            </button>
                            <button
                                onClick={handleExportWord}
                                className="btn gap-2 w-full sm:w-auto text-sm bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <FileText className="h-4 w-4" />
                                Export as Word
                            </button>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="btn btn-outline w-full sm:w-auto text-sm border-gray-500 text-gray-300 hover:text-white hover:border-gray-300"
                            >
                                Close
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
