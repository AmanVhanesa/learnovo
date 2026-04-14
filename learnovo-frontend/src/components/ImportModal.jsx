import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/authService';

/**
 * Reusable Import Modal Component
 * Supports CSV/Excel file upload with preview and validation
 */
const ImportModal = ({
    isOpen,
    onClose,
    module = 'students',
    title = 'Import Students',
    templateUrl = '/api/students/import/template',
    previewUrl = '/api/students/import/preview',
    executeUrl = '/api/students/import/execute',
    onSuccess
}) => {
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [step, setStep] = useState('upload'); // upload, preview, importing, complete
    const [previewData, setPreviewData] = useState(null);
    const [importing, setImporting] = useState(false);
    // 'skip' = skip duplicates, 'replace' = overwrite existing, 'new' = always insert as new
    const [duplicateAction, setDuplicateAction] = useState('skip');

    if (!isOpen) return null;

    // Handle file selection
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            validateAndSetFile(selectedFile);
        }
    };

    // Validate file
    const validateAndSetFile = (selectedFile) => {
        const validTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        const isValidType = validTypes.includes(selectedFile.type);
        const isValidExt = /\.(csv|xlsx|xls)$/i.test(selectedFile.name);
        if (!isValidType && !isValidExt) {
            toast.error('Please upload a CSV or Excel file');
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) { // 10MB
            toast.error('File size must be less than 10MB');
            return;
        }

        setFile(selectedFile);
    };

    // Handle drag and drop
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    };

    // Download template
    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get(templateUrl, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${module}_import_template.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Template downloaded successfully');
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    // Preview import
    const handlePreview = async () => {
        if (!file) {
            toast.error('Please select a file');
            return;
        }

        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Don't set Content-Type header - let axios set it automatically for FormData
            // This preserves the Authorization header from the interceptor
            const response = await api.post(previewUrl, formData);

            if (response.data.success) {
                setPreviewData(response.data);
                setStep('preview');

                if (response.data.errors && response.data.errors.length > 0) {
                    toast.error(`Found ${response.data.errors.length} validation errors`);
                } else {
                    toast.success('File validated successfully');
                }
            } else {
                toast.error(response.data.message || 'Validation failed');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to validate file');
        } finally {
            setImporting(false);
        }
    };

    // Execute import
    const handleExecuteImport = async () => {
        if (!previewData) {
            toast.error('No data to import');
            return;
        }

        // When replacing or inserting as new, include the duplicate rows as well
        // (previewData.validData only contains non-duplicate rows)
        const duplicateRows = (previewData.duplicates || []).map(d => d.data);
        let dataToSend = [...(previewData.validData || [])];
        if (duplicateAction === 'replace' || duplicateAction === 'new') {
            dataToSend = [...dataToSend, ...duplicateRows];
        }

        if (dataToSend.length === 0) {
            toast.error('No records to import. All rows were skipped.');
            return;
        }

        setImporting(true);
        setStep('importing');

        try {
            const response = await api.post(executeUrl, {
                validData: dataToSend,
                options: {
                    skipErrors: true,
                    skipDuplicates: duplicateAction === 'skip',
                    replaceDuplicates: duplicateAction === 'replace'
                    // duplicateAction === 'new' means neither flag set → always insert
                }
            }, {
                timeout: 300000 // 5 minutes for large imports
            });

            if (response.data.success) {
                const result = response.data.data;
                // Store the response data for completion display
                setPreviewData(prev => ({
                    ...prev,
                    data: result
                }));
                setStep('complete');

                // Log error details to console for debugging
                if (result?.errorSample?.length > 0) {
                    console.error('[Import] Error sample from server:', result.errorSample);
                }

                // Only auto-close (call onSuccess) if there were no significant failures
                const failCount = result?.failed || 0;
                const totalProcessed = (result?.success || 0) + (result?.replaced || 0) + (result?.skipped || 0) + failCount;
                if (failCount === 0 || failCount < totalProcessed * 0.1) {
                    // Few/no failures — auto-close and notify parent
                    toast.success(response.data.message);
                    if (onSuccess) {
                        onSuccess(result);
                    }
                } else {
                    // Significant failures — stay on complete step so user can see error details
                    toast.error(`${failCount} of ${totalProcessed} rows failed. Check error details below.`, { duration: 6000 });
                }
            } else {
                toast.error(response.data.message || 'Import failed');
                setStep('preview');
            }
        } catch (error) {
            const errData = error.response?.data;
            const errMsg = errData?.message || 'Failed to import data';
            const errDetail = errData?.error;

            // Show detailed error to user
            if (errDetail) {
                toast.error(`${errMsg}: ${errDetail}`, { duration: 8000 });
            } else {
                toast.error(errMsg, { duration: 6000 });
            }

            // Store error info for display
            setPreviewData(prev => ({
                ...prev,
                importError: errDetail || errMsg
            }));
            setStep('preview');
        } finally {
            setImporting(false);
        }
    };

    // Calculate records that will be processed based on duplicate action
    const getRecordsToImport = () => {
        if (!previewData) return 0;
        const validRows = previewData.summary.validRows || 0;
        const duplicates = previewData.summary.duplicatesInDB || 0;
        if (duplicateAction === 'skip') return validRows; // duplicates excluded
        return validRows + duplicates; // replace or new: all rows processed
    };

    // Download error report
    const handleDownloadErrors = () => {
        if (!previewData || !previewData.errors) return;

        const csvContent = [
            ['Row Number', 'Field', 'Error', 'Invalid Value'],
            ...previewData.errors.map(err => [
                err.row || err.rowNumber || '',
                err.field || '',
                err.message || '',
                err.value || ''
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${module}_import_errors.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    // Reset modal
    const handleClose = () => {
        setFile(null);
        setStep('upload');
        setPreviewData(null);
        setImporting(false);
        setDuplicateAction('skip');
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-4xl sm:mx-4 h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-[#38383A] shrink-0">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate pr-2">{title}</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                    {/* Upload Step */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            {/* Instructions */}
                            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-4">
                                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-400 mb-2">Instructions:</h3>
                                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                                    <li>Upload a CSV file with {module} details.</li>
                                    <li>Download the template below to see the required format.</li>
                                    <li>Make sure all required columns are filled.</li>
                                    <li>Maximum file size: 10MB</li>
                                </ul>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="mt-3 inline-flex items-center text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 font-medium"
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download Template CSV
                                </button>
                            </div>

                            {/* File Upload Area */}
                            <div
                                className={`border-2 border-dashed rounded-lg p-6 sm:p-12 text-center transition-colors ${dragActive
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-300 dark:border-[#38383A] hover:border-gray-400'
                                    }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-sm text-gray-600 dark:text-[#8E8E93] mb-2">
                                    {file ? file.name : 'Drag and drop your CSV file here, or click to browse'}
                                </p>
                                <input
                                    type="file"
                                    id="file-upload"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="inline-block px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 cursor-pointer transition-colors"
                                >
                                    Choose File
                                </label>
                                {file && (
                                    <div className="mt-4 flex items-center justify-center text-sm text-gray-600 dark:text-[#8E8E93]">
                                        <FileText className="h-4 w-4 mr-2" />
                                        {file.name} ({(file.size / 1024).toFixed(2)} KB)
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Preview Step */}
                    {step === 'preview' && previewData && (
                        <div className="space-y-6">
                            {/* Import Error Banner */}
                            {previewData.importError && (
                                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-semibold text-red-800 dark:text-red-400">Import Failed</h4>
                                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{previewData.importError}</p>
                                            <p className="text-xs text-red-500 dark:text-red-400/70 mt-2">Please check your data and try again. If the issue persists, try importing in smaller batches.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Summary */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                <div className="bg-gray-50 dark:bg-[#000000] rounded-lg p-4">
                                    <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Total Rows</p>
                                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{previewData.summary.totalRows}</p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-4">
                                    <p className="text-sm text-green-600 dark:text-green-400">Valid Rows</p>
                                    <p className="text-2xl font-semibold text-green-900 dark:text-green-300">{previewData.summary.validRows}</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-4">
                                    <p className="text-sm text-red-600 dark:text-red-400">Invalid Rows</p>
                                    <p className="text-2xl font-semibold text-red-900 dark:text-red-300">{previewData.summary.invalidRows}</p>
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-500/10 rounded-lg p-4">
                                    <p className="text-sm text-yellow-600 dark:text-yellow-400">Already Exist</p>
                                    <p className="text-2xl font-semibold text-yellow-900 dark:text-yellow-300">
                                        {previewData.summary.duplicatesInDB || 0}
                                    </p>
                                </div>
                            </div>

                            {/* Breakdown hint */}
                            {previewData.summary.breakdown && (
                                <div className="bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg px-4 py-2">
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] font-mono">
                                        {previewData.summary.breakdown}
                                    </p>
                                </div>
                            )}

                            {/* Duplicates Warning & Action Choice */}
                            {previewData.summary.duplicatesInDB > 0 && (
                                <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-2xl p-4">
                                    <div className="flex items-start">
                                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
                                        <div className="flex-1">
                                            <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">
                                                {previewData.summary.duplicatesInDB} student(s) already exist in the system
                                            </h3>
                                            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                                                These students have admission numbers matching existing records. Choose what to do:
                                            </p>
                                            <div className="space-y-2">
                                                <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-500/20 transition-colors">
                                                    <input
                                                        type="radio"
                                                        name="duplicateAction"
                                                        value="skip"
                                                        checked={duplicateAction === 'skip'}
                                                        onChange={() => setDuplicateAction('skip')}
                                                        className="mt-0.5 h-4 w-4 text-primary-600"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-medium text-yellow-900 dark:text-yellow-300">Skip duplicates</span>
                                                        <p className="text-xs text-yellow-700 dark:text-yellow-400/70">Existing students will not be changed</p>
                                                    </div>
                                                </label>
                                                <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-500/20 transition-colors">
                                                    <input
                                                        type="radio"
                                                        name="duplicateAction"
                                                        value="replace"
                                                        checked={duplicateAction === 'replace'}
                                                        onChange={() => setDuplicateAction('replace')}
                                                        className="mt-0.5 h-4 w-4 text-primary-600"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-medium text-yellow-900 dark:text-yellow-300">Replace (update) existing students</span>
                                                        <p className="text-xs text-yellow-700 dark:text-yellow-400/70">Existing records will be overwritten with CSV data</p>
                                                    </div>
                                                </label>
                                                <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-500/20 transition-colors">
                                                    <input
                                                        type="radio"
                                                        name="duplicateAction"
                                                        value="new"
                                                        checked={duplicateAction === 'new'}
                                                        onChange={() => setDuplicateAction('new')}
                                                        className="mt-0.5 h-4 w-4 text-primary-600"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-medium text-yellow-900 dark:text-yellow-300">Import as new</span>
                                                        <p className="text-xs text-yellow-700 dark:text-yellow-400/70">Duplicates will be inserted as separate new records</p>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {previewData.errors && previewData.errors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center">
                                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                                            <h3 className="text-sm font-medium text-red-900 dark:text-red-400">
                                                {previewData.errors.length} Validation Error(s)
                                            </h3>
                                        </div>
                                        <button
                                            onClick={handleDownloadErrors}
                                            className="text-sm text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 font-medium"
                                        >
                                            Download Error Report
                                        </button>
                                    </div>

                                    {/* Error summary by type */}
                                    {previewData.summary.errorsByType && (
                                        <div className="mb-3 p-2 bg-red-100 dark:bg-red-500/20 rounded-lg">
                                            <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">Error breakdown:</p>
                                            <ul className="text-xs text-red-700 dark:text-red-400 space-y-0.5">
                                                {Object.entries(previewData.summary.errorsByType)
                                                    .sort(([, a], [, b]) => b - a)
                                                    .slice(0, 5)
                                                    .map(([msg, count], i) => (
                                                        <li key={i} className="font-mono">{count}x — {msg}</li>
                                                    ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="max-h-40 overflow-y-auto">
                                        <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                                            {previewData.errors.slice(0, 10).map((error, index) => (
                                                <li key={index}>
                                                    Row {error.row || error.rowNumber}: {error.field} - {error.message}
                                                </li>
                                            ))}
                                            {previewData.errors.length > 10 && (
                                                <li className="font-medium">
                                                    ... and {previewData.errors.length - 10} more errors
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Preview Table */}
                            {previewData.preview && previewData.preview.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                                        Preview (First 10 valid rows)
                                    </h3>
                                    <div className="overflow-x-auto border border-gray-200 dark:border-[#38383A] rounded-lg">
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
                                            <thead className="bg-gray-50 dark:bg-[#000000]">
                                                <tr>
                                                    {Object.keys(previewData.preview[0]).filter(key => key !== '_rowNumber').map((key) => (
                                                        <th
                                                            key={key}
                                                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider"
                                                        >
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-200 dark:divide-dark-border">
                                                {previewData.preview.map((row, index) => (
                                                    <tr key={index}>
                                                        {Object.entries(row).filter(([key]) => key !== '_rowNumber').map(([key, value]) => (
                                                            <td key={key} className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                                                {value || '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Importing Step */}
                    {step === 'importing' && (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
                            <p className="text-lg font-medium text-gray-900 dark:text-white">Importing data...</p>
                            <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-2">Please wait while we process your file</p>
                        </div>
                    )}

                    {/* Complete Step */}
                    {step === 'complete' && (
                        <div className="text-center py-12">
                            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-900 dark:text-white">Import Completed Successfully!</p>
                            {previewData && (
                                <div className="mt-4 space-y-2">
                                    {previewData.data?.success !== undefined && (
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                            <span className="font-semibold text-green-600">{previewData.data.success}</span> {module} imported successfully
                                        </p>
                                    )}
                                    {previewData.data?.allocationsCreated !== undefined && (
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                            <span className="font-semibold text-green-600">{previewData.data.allocationsCreated}</span> fee allocations created
                                        </p>
                                    )}
                                    {previewData.data?.invoicesCreated !== undefined && (
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                            <span className="font-semibold text-green-600">{previewData.data.invoicesCreated}</span> invoices created
                                        </p>
                                    )}
                                    {previewData.data?.paymentsCreated !== undefined && (
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                            <span className="font-semibold text-green-600">{previewData.data.paymentsCreated}</span> payments recorded
                                        </p>
                                    )}
                                    {previewData.data?.replaced > 0 && (
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                            <span className="font-semibold text-blue-600">{previewData.data.replaced}</span> {module} replaced (updated)
                                        </p>
                                    )}
                                    {previewData.data?.skipped > 0 && (
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                            <span className="font-semibold text-yellow-600">{previewData.data.skipped}</span> {module} skipped (already exist)
                                        </p>
                                    )}
                                    {previewData.data?.failed > 0 && (
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                                <span className="font-semibold text-red-600">{previewData.data.failed}</span> rows failed to import
                                            </p>
                                            {/* Show error details */}
                                            {previewData.data?.errorSample?.length > 0 && (
                                                <div className="mt-3 text-left bg-red-50 dark:bg-red-500/10 rounded-lg p-3 max-h-40 overflow-y-auto">
                                                    <p className="text-xs font-semibold text-red-700 mb-1">Error details:</p>
                                                    {previewData.data.errorSample.map((err, i) => (
                                                        <p key={i} className="text-xs text-red-600 py-0.5">{err}</p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#000000] shrink-0">
                    {step === 'upload' && (
                        <>
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#8E8E93] bg-white dark:bg-[#1C1C1E] border border-gray-300 dark:border-[#38383A] rounded-md hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePreview}
                                disabled={!file || importing}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {importing ? 'Validating...' : 'Validate & Preview'}
                            </button>
                        </>
                    )}

                    {step === 'preview' && (
                        <>
                            <button
                                onClick={() => setStep('upload')}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#8E8E93] bg-white dark:bg-[#1C1C1E] border border-gray-300 dark:border-[#38383A] rounded-md hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleExecuteImport}
                                disabled={!previewData || getRecordsToImport() === 0 || importing}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Import {getRecordsToImport()} Record{getRecordsToImport() !== 1 ? 's' : ''}
                            </button>
                        </>
                    )}

                    {step === 'complete' && (
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImportModal;
