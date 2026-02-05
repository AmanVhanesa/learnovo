import React, { useState } from 'react';
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
    const [skipDuplicates, setSkipDuplicates] = useState(false);

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

        if (!validTypes.includes(selectedFile.type)) {
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
            console.error('Download template error:', error);
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
            console.error('Preview error:', error);
            toast.error(error.response?.data?.message || 'Failed to validate file');
        } finally {
            setImporting(false);
        }
    };

    // Execute import
    const handleExecuteImport = async () => {
        if (!previewData || !previewData.validData) {
            toast.error('No valid data to import');
            return;
        }

        setImporting(true);
        setStep('importing');

        try {
            const response = await api.post(executeUrl, {
                validData: previewData.validData,
                options: {
                    skipErrors: true,
                    skipDuplicates: skipDuplicates
                }
            });

            if (response.data.success) {
                // Store the response data for completion display
                setPreviewData(prev => ({
                    ...prev,
                    data: response.data.data
                }));
                setStep('complete');
                toast.success(response.data.message);

                if (onSuccess) {
                    onSuccess(response.data.data);
                }
            } else {
                toast.error(response.data.message || 'Import failed');
                setStep('preview');
            }
        } catch (error) {
            console.error('Execute import error:', error);
            toast.error(error.response?.data?.message || 'Failed to import data');
            setStep('preview');
        } finally {
            setImporting(false);
        }
    };

    // Calculate records to import based on skipDuplicates setting
    const getRecordsToImport = () => {
        if (!previewData) return 0;
        const validRows = previewData.summary.validRows || 0;
        const duplicates = previewData.summary.duplicatesInDB || 0;
        return skipDuplicates ? validRows : validRows + duplicates;
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
        setSkipDuplicates(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* Upload Step */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            {/* Instructions */}
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                <h3 className="text-sm font-medium text-blue-900 mb-2">Instructions:</h3>
                                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                                    <li>Upload a CSV file with {module} details.</li>
                                    <li>Download the template below to see the required format.</li>
                                    <li>Make sure all required columns are filled.</li>
                                    <li>Maximum file size: 10MB</li>
                                </ul>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="mt-3 inline-flex items-center text-sm text-blue-700 hover:text-blue-900 font-medium"
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download Template CSV
                                </button>
                            </div>

                            {/* File Upload Area */}
                            <div
                                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-sm text-gray-600 mb-2">
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
                                    <div className="mt-4 flex items-center justify-center text-sm text-gray-600">
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
                            {/* Summary */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Total Rows</p>
                                    <p className="text-2xl font-semibold text-gray-900">{previewData.summary.totalRows}</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-4">
                                    <p className="text-sm text-green-600">Valid Rows</p>
                                    <p className="text-2xl font-semibold text-green-900">{previewData.summary.validRows}</p>
                                </div>
                                <div className="bg-red-50 rounded-lg p-4">
                                    <p className="text-sm text-red-600">Invalid Rows</p>
                                    <p className="text-2xl font-semibold text-red-900">{previewData.summary.invalidRows}</p>
                                </div>
                                <div className="bg-yellow-50 rounded-lg p-4">
                                    <p className="text-sm text-yellow-600">Already Exist</p>
                                    <p className="text-2xl font-semibold text-yellow-900">
                                        {previewData.summary.duplicatesInDB || 0}
                                    </p>
                                </div>
                            </div>

                            {/* Duplicates Warning & Skip Option */}
                            {previewData.summary.duplicatesInDB > 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                                    <div className="flex items-start">
                                        <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                                        <div className="flex-1">
                                            <h3 className="text-sm font-medium text-yellow-900 mb-2">
                                                {previewData.summary.duplicatesInDB} student(s) already exist in the system
                                            </h3>
                                            <p className="text-sm text-yellow-700 mb-3">
                                                These students have admission numbers that match existing records.
                                                You can choose to skip them during import.
                                            </p>
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={skipDuplicates}
                                                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                                />
                                                <span className="ml-2 text-sm font-medium text-yellow-900">
                                                    Skip students that already exist (based on admission number)
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {previewData.errors && previewData.errors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center">
                                            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                                            <h3 className="text-sm font-medium text-red-900">
                                                {previewData.errors.length} Validation Error(s)
                                            </h3>
                                        </div>
                                        <button
                                            onClick={handleDownloadErrors}
                                            className="text-sm text-red-700 hover:text-red-900 font-medium"
                                        >
                                            Download Error Report
                                        </button>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto">
                                        <ul className="text-sm text-red-700 space-y-1">
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
                                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                                        Preview (First 10 valid rows)
                                    </h3>
                                    <div className="overflow-x-auto border rounded-lg">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    {Object.keys(previewData.preview[0]).filter(key => key !== '_rowNumber').map((key) => (
                                                        <th
                                                            key={key}
                                                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                        >
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {previewData.preview.map((row, index) => (
                                                    <tr key={index}>
                                                        {Object.entries(row).filter(([key]) => key !== '_rowNumber').map(([key, value]) => (
                                                            <td key={key} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
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
                            <p className="text-lg font-medium text-gray-900">Importing data...</p>
                            <p className="text-sm text-gray-600 mt-2">Please wait while we process your file</p>
                        </div>
                    )}

                    {/* Complete Step */}
                    {step === 'complete' && (
                        <div className="text-center py-12">
                            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-900">Import Completed Successfully!</p>
                            {previewData && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold text-green-600">{previewData.data?.success || 0}</span> students imported successfully
                                    </p>
                                    {previewData.data?.skipped > 0 && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-semibold text-yellow-600">{previewData.data.skipped}</span> students skipped (already exist)
                                        </p>
                                    )}
                                    {previewData.data?.failed > 0 && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-semibold text-red-600">{previewData.data.failed}</span> students failed to import
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                    {step === 'upload' && (
                        <>
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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
        </div>
    );
};

export default ImportModal;
