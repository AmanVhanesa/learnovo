import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Check, FileText, Printer, AlertCircle } from 'lucide-react';
import certificateService from '../../services/certificateService';
import studentsService from '../../services/studentsService'; // Assuming this exists for search
import { toast } from 'react-hot-toast';

const CertificateGeneration = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [certType, setCertType] = useState('BONAFIDE');
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [autoDeactivate, setAutoDeactivate] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Step 1: Search Logic
    // Live Search Logic with Debounce
    React.useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.trim().length >= 2) { // Only search if 2 or more chars
                setSearching(true);
                try {
                    const response = await studentsService.list({ search: searchTerm.trim(), limit: 10 });
                    setSearchResults(response.data || []);
                } catch (error) {
                    console.error("Search failed", error);
                } finally {
                    setSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 500); // 500ms delay

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const selectStudent = (student) => {
        setSelectedStudent(student);
        setSearchResults([]);
        setSearchTerm('');
    };

    // Step 2: Preview Logic
    const handlePreview = async () => {
        if (!selectedStudent) return;
        setLoading(true);
        try {
            const data = await certificateService.previewCertificate(selectedStudent._id, certType);
            setPreviewData(data);
            setStep(2);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to generate preview');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Generation Logic
    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const response = await certificateService.generateCertificate(
                selectedStudent._id,
                certType,
                previewData, // Sending back confirmed/edited data
                autoDeactivate
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${certType}_${selectedStudent.firstName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Certificate generated successfully!');
            navigate('/app/certificates');
        } catch (error) {
            toast.error('Generation failed');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/app/certificates')} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">Generate Certificate</h1>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center mb-10">
                <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                    <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold border-current">1</div>
                    <span>Select Student</span>
                </div>
                <div className="w-16 h-0.5 bg-gray-200 mx-4"></div>
                <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                    <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold border-current">2</div>
                    <span>Preview & Validate</span>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-8">

                {/* STEP 1: SELECTION */}
                {step === 1 && (
                    <div className="max-w-xl mx-auto space-y-8">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Certificate Type</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setCertType('BONAFIDE')}
                                    className={`p-4 border rounded-lg text-center transition-all ${certType === 'BONAFIDE' ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50'}`}
                                >
                                    Bonafide Certificate
                                </button>
                                <button
                                    onClick={() => setCertType('TC')}
                                    className={`p-4 border rounded-lg text-center transition-all ${certType === 'TC' ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50'}`}
                                >
                                    Leaving Certificate (TC)
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search Student</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Enter Name or Admission Number..."
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="animate-spin text-gray-400 w-5 h-5" />
                                    </div>
                                )}
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto">
                                    {searchResults.map(student => (
                                        <div
                                            key={student._id}
                                            onClick={() => selectStudent(student)}
                                            className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-medium">{student.fullName}</p>
                                                <p className="text-sm text-gray-500">{student.admissionNumber} | Class {student.class}</p>
                                            </div>
                                            <div className="text-blue-600 text-sm">Select</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedStudent && (
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                                        <Check size={18} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-emerald-900">{selectedStudent.fullName}</p>
                                        <p className="text-sm text-emerald-700">Selected for {certType}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedStudent(null)} className="text-sm text-gray-500 hover:text-gray-700 underline">Change</button>
                            </div>
                        )}

                        <div className="pt-4">
                            <button
                                onClick={handlePreview}
                                disabled={!selectedStudent || loading}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Continue to Preview'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: PREVIEW */}
                {step === 2 && previewData && (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2 mb-4 text-gray-700 font-semibold border-b pb-2">
                                <FileText size={20} />
                                Certificate Preview Data
                            </div>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div><span className="text-gray-500">Student Name:</span> <span className="font-medium ml-2">{previewData.studentName}</span></div>
                                <div><span className="text-gray-500">Father's Name:</span> <span className="font-medium ml-2">{previewData.fatherName}</span></div>
                                <div><span className="text-gray-500">Admission No:</span> <span className="font-medium ml-2">{previewData.admissionNumber}</span></div>
                                <div><span className="text-gray-500">Class:</span> <span className="font-medium ml-2">{previewData.class}</span></div>
                                <div><span className="text-gray-500">Fees Status:</span> <span className="font-medium text-emerald-600 ml-2">{previewData.feeStatus}</span></div>

                                {certType === 'TC' && (
                                    <>
                                        <div className="col-span-2 mt-2 pt-2 border-t"></div>
                                        <div className="col-span-2">
                                            <label className="block text-gray-500 mb-1">Reason for Leaving</label>
                                            <div className="space-y-2">
                                                <select
                                                    className="w-full p-2 border rounded"
                                                    value={['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(previewData.leavingReason) ? previewData.leavingReason : 'Other'}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === 'Other') {
                                                            setPreviewData({ ...previewData, leavingReason: '' });
                                                        } else {
                                                            setPreviewData({ ...previewData, leavingReason: val });
                                                        }
                                                    }}
                                                >
                                                    <option value="Parent Request">Parent Request</option>
                                                    <option value="Completed Studies">Completed Studies</option>
                                                    <option value="Transfer">Transfer</option>
                                                    <option value="Medical Grounds">Medical Grounds</option>
                                                    <option value="Other">Other (Custom)</option>
                                                </select>

                                                {/* Show text input if 'Other' is selected (or value is not in presets) */}
                                                {!['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(previewData.leavingReason) && (
                                                    <input
                                                        type="text"
                                                        placeholder="Enter custom reason..."
                                                        className="w-full p-2 border rounded bg-gray-50"
                                                        value={previewData.leavingReason}
                                                        onChange={(e) => setPreviewData({ ...previewData, leavingReason: e.target.value })}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-gray-500 mb-1">Remarks</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border rounded"
                                                value={previewData.remarks}
                                                onChange={(e) => setPreviewData({ ...previewData, remarks: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-2 mt-4">
                                            <label className="flex items-center gap-2 cursor-pointer p-3 bg-red-50 border border-red-100 rounded-lg text-red-800">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500"
                                                    checked={autoDeactivate}
                                                    onChange={(e) => setAutoDeactivate(e.target.checked)}
                                                />
                                                <span className="font-medium text-sm">Automatically deactivate student profile upon generation</span>
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <p>Please review the details carefully. Once generated, a certificate number will be assigned and it cannot be edited. Reprints will carry the same number.</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => setStep(1)}
                                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {generating ? 'Generating...' : (
                                    <>
                                        <Printer size={18} />
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

// Simple loader component if needed, or import from lucide
const Loader2 = ({ className }) => <svg className={`w-5 h-5 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>;

export default CertificateGeneration;
