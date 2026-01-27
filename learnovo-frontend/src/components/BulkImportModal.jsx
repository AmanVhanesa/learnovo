import React, { useState } from 'react';
import { X, Upload, FileText, Check, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentsService } from '../services/studentsService';

const BulkImportModal = ({ onClose, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
            toast.error('Please upload a CSV file');
            return;
        }
        setFile(selectedFile);
        setResult(null);
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        try {
            const response = await studentsService.importBulk(file);
            setResult(response);
            toast.success('Import process completed');
            if (response.data && response.data.success > 0) {
                onSuccess && onSuccess();
            }
        } catch (error) {
            console.error('Import error:', error);
            toast.error(error.response?.data?.message || 'Failed to import students');
        } finally {
            setIsUploading(false);
        }
    };

    const downloadTemplate = () => {
        const headers = ['firstName', 'lastName', 'email', 'class', 'section', 'academicYear', 'rollNumber', 'phone', 'fatherName', 'fatherPhone'];
        const csvContent = headers.join(',') + '\nJohn,Doe,john@example.com,10th,A,2025-2026,101,9876543210,Robert Doe,9876543211';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'student_import_template.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content p-4 max-w-lg w-full">
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <h3 className="text-lg font-semibold text-gray-900">Bulk Import Students</h3>
                    <button className="p-2 rounded-md hover:bg-gray-100" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!result ? (
                        <>
                            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
                                <p className="font-semibold mb-1">Instructions:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Upload a CSV file with student details.</li>
                                    <li>Required columns: <strong>name</strong>, <strong>email</strong>.</li>
                                    <li>Recommended: class, rollNumber, phone.</li>
                                    <li><button onClick={downloadTemplate} className="underline text-blue-800 font-medium">Download Template CSV</button></li>
                                </ul>
                            </div>

                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
                                <input
                                    type="file"
                                    id="csv-upload"
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                />
                                <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                                    <FileText className="h-12 w-12 text-gray-400 mb-3" />
                                    <span className="text-sm font-medium text-gray-900">
                                        {file ? file.name : 'Click to upload CSV'}
                                    </span>
                                    <span className="text-xs text-gray-500 mt-1">
                                        {file ? `${(file.size / 1024).toFixed(2)} KB` : 'CSV files only'}
                                    </span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleUpload}
                                    disabled={!file || isUploading}
                                >
                                    {isUploading ? 'Uploading...' : 'Import Students'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
                                    <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                    <div className="text-2xl font-bold text-green-700">{result.data?.success || 0}</div>
                                    <div className="text-sm text-green-800">Successfully Imported</div>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center">
                                    <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                                    <div className="text-2xl font-bold text-red-700">{result.data?.failed || 0}</div>
                                    <div className="text-sm text-red-800">Failed Records</div>
                                </div>
                            </div>

                            {result.data?.errors && result.data.errors.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto border border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Error Log:</h4>
                                    <ul className="text-xs text-red-600 space-y-1">
                                        {result.data.errors.map((err, idx) => (
                                            <li key={idx}>• {err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button className="btn btn-primary" onClick={onClose}>Close</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkImportModal;
