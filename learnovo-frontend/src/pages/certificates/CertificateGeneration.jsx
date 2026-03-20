import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, Check, FileText, Printer, AlertCircle } from 'lucide-react';
import certificateService from '../../services/certificateService';
import studentsService from '../../services/studentsService';
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
        mutationFn: () => certificateService.generateCertificate(selectedStudent._id, certType, previewData, autoDeactivate),
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
            queryClient.invalidateQueries({ queryKey: ['certificate-history'] });
            navigate('/app/certificates');
        },
        onError: async (error) => {
            // Extract error message from blob error responses
            let message = 'Generation failed';
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const parsed = JSON.parse(text);
                    message = parsed.message || message;
                } catch { /* use default */ }
            } else if (error.message) {
                message = error.message;
            }
            toast.error(message);
        },
    });

    const handleGenerate = () => {
        generateMutation.mutate();
    };

    const generating = generateMutation.isPending;

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
                        <div className="bg-gray-50 dark:bg-[#2C2C2E] p-6 rounded-xl border border-gray-100 dark:border-[#38383A]">
                            <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-[#8E8E93] font-semibold border-b border-gray-200 dark:border-[#38383A] pb-3">
                                <FileText className="h-5 w-5" />
                                Certificate Preview Data
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Student Name:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.studentName}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Father's Name:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.fatherName}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Admission No:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.admissionNumber}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Class:</span> <span className="font-medium text-gray-900 dark:text-white ml-2">{previewData.class}</span></div>
                                <div><span className="text-gray-500 dark:text-[#8E8E93]">Fees Status:</span> <span className={`font-medium ml-2 ${previewData.feeStatus?.toLowerCase() === 'clear' || previewData.feeStatus?.toLowerCase() === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{previewData.feeStatus}</span></div>

                                {certType === 'TC' && (
                                    <>
                                        <div className="col-span-2 mt-2 pt-2 border-t border-gray-200 dark:border-[#38383A]" />
                                        <div className="col-span-2">
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
                                        <div className="col-span-2">
                                            <label className="label mb-1.5 block">Remarks</label>
                                            <input type="text" className="input" value={previewData.remarks} onChange={(e) => setPreviewData({ ...previewData, remarks: e.target.value })} />
                                        </div>
                                        <div className="col-span-2 mt-4">
                                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-400">
                                                <input type="checkbox" className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500" checked={autoDeactivate} onChange={(e) => setAutoDeactivate(e.target.checked)} />
                                                <span className="font-medium text-sm">Automatically deactivate student profile upon generation</span>
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 rounded-xl text-sm border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <p>Please review the details carefully. Once generated, a certificate number will be assigned and it cannot be edited. Reprints will carry the same number.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                            <button onClick={() => setStep(1)} className="btn btn-outline w-full sm:w-auto">Back</button>
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
        </div>
    );
};

export default CertificateGeneration;
