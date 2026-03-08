import React, { useState } from 'react';
import { Download, FileText, Table } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/authService';

/**
 * Reusable Export Button Component
 * Supports CSV and Excel export with filters
 */
const ExportButton = ({
    module = 'students',
    exportUrl = '/api/students/export',
    filters = {},
    label = 'Export',
    className = ''
}) => {
    const [exporting, setExporting] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    const handleExport = async (format = 'csv') => {
        setExporting(true);
        setShowOptions(false);

        try {
            // Build query string from filters
            const queryParams = new URLSearchParams(filters).toString();
            const url = queryParams ? `${exportUrl}?${queryParams}` : exportUrl;

            const response = await api.get(url, {
                responseType: 'blob'
            });

            // Create download link
            const blob = new Blob([response.data], {
                type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;

            const date = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `${module}_export_${date}.${format}`);

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            toast.success(`${module} exported successfully`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error(error.response?.data?.message || 'Failed to export data');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowOptions(!showOptions)}
                disabled={exporting}
                className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? 'Exporting...' : label}
            </button>

            {/* Export Options Dropdown */}
            {showOptions && !exporting && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowOptions(false)}
                    ></div>

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                        <div className="py-1" role="menu">
                            <button
                                onClick={() => handleExport('csv')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                role="menuitem"
                            >
                                <FileText className="h-4 w-4 mr-3 text-gray-400" />
                                Export as CSV
                            </button>
                            <button
                                onClick={() => handleExport('xlsx')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                role="menuitem"
                            >
                                <Table className="h-4 w-4 mr-3 text-gray-400" />
                                Export as Excel
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ExportButton;
