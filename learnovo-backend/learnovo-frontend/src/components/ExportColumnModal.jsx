import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

const ExportColumnModal = ({ isOpen, onClose, onExport }) => {
    // Define all available fields grouped by category
    const fieldCategories = {
        basic: {
            label: 'Basic Info',
            fields: {
                admissionNumber: 'Admission No',
                name: 'Name',
                class: 'Class',
                section: 'Section',
                rollNumber: 'Roll No',
                status: 'Status'
            }
        },
        academic: {
            label: 'Academic',
            fields: {
                academicYear: 'Academic Year',
                admissionDate: 'Admission Date',
                penNumber: 'PEN Number',
                subDepartment: 'Sub Department'
            }
        },
        contact: {
            label: 'Contact',
            fields: {
                fatherName: 'Father Name',
                motherName: 'Mother Name',
                guardianName: 'Guardian Name',
                mobile: 'Mobile',
                altMobile: 'Alt Mobile',
                email: 'Email',
                address: 'Address'
            }
        },
        personal: {
            label: 'Personal',
            fields: {
                dob: 'DOB',
                gender: 'Gender',
                bloodGroup: 'Blood Group',
                category: 'Category',
                religion: 'Religion'
            }
        },
        transport: {
            label: 'Transport',
            fields: {
                driverName: 'Driver',
                driverPhone: 'Driver Phone',
                transportMode: 'Transport Mode'
            }
        }
    };

    // Preset configurations
    const presets = {
        basic: ['admissionNumber', 'name', 'class', 'section', 'rollNumber', 'status'],
        full: Object.keys(fieldCategories).flatMap(cat => Object.keys(fieldCategories[cat].fields)),
        contact: ['admissionNumber', 'name', 'class', 'section', 'fatherName', 'motherName', 'mobile', 'altMobile', 'email', 'address']
    };

    const [selectedFields, setSelectedFields] = useState(presets.full);

    if (!isOpen) return null;

    const toggleField = (fieldKey) => {
        setSelectedFields(prev =>
            prev.includes(fieldKey)
                ? prev.filter(f => f !== fieldKey)
                : [...prev, fieldKey]
        );
    };

    const selectAll = () => {
        setSelectedFields(presets.full);
    };

    const deselectAll = () => {
        setSelectedFields([]);
    };

    const applyPreset = (presetName) => {
        setSelectedFields(presets[presetName]);
    };

    const handleExport = () => {
        onExport(selectedFields);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">Select Export Columns</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {/* Presets */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Presets</h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => applyPreset('basic')}
                                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                            >
                                Basic Details
                            </button>
                            <button
                                onClick={() => applyPreset('contact')}
                                className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                            >
                                Contact Info Only
                            </button>
                            <button
                                onClick={selectAll}
                                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                            >
                                Select All
                            </button>
                            <button
                                onClick={deselectAll}
                                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                            >
                                Deselect All
                            </button>
                        </div>
                    </div>

                    {/* Field Selection */}
                    <div className="space-y-6">
                        {Object.entries(fieldCategories).map(([categoryKey, category]) => (
                            <div key={categoryKey} className="border rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3">{category.label}</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(category.fields).map(([fieldKey, fieldLabel]) => (
                                        <label
                                            key={fieldKey}
                                            className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                                        >
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFields.includes(fieldKey)}
                                                    onChange={() => toggleField(fieldKey)}
                                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                                />
                                                {selectedFields.includes(fieldKey) && (
                                                    <Check className="h-3 w-3 text-white absolute left-0.5 pointer-events-none" />
                                                )}
                                            </div>
                                            <span className="ml-2 text-sm text-gray-700">{fieldLabel}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Selected Count */}
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-900">
                            <span className="font-semibold">{selectedFields.length}</span> column{selectedFields.length !== 1 ? 's' : ''} selected
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={selectedFields.length === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Export {selectedFields.length} Column{selectedFields.length !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportColumnModal;
