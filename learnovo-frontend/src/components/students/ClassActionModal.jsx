import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const ClassActionModal = ({ isOpen, onClose, onConfirm, type, student, isLoading }) => {
    if (!isOpen || !student) return null;

    const currentYear = new Date().getFullYear();
    const defaultAcademicYear = `${currentYear}-${currentYear + 1}`;

    const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
    const [targetClass, setTargetClass] = useState('');
    const [targetSection, setTargetSection] = useState(student.section || '');
    const [remarks, setRemarks] = useState('');
    const [forceOverride, setForceOverride] = useState(false);
    const [showOverrideWarning, setShowOverrideWarning] = useState(false);

    // Auto calculate target based on basic logic if we want, but it's simpler to let admin select, 
    // or provide the sequence. Let's provide a basic manual selection for maximum flexibility
    const classSequence = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

    // Pre-select next/prev class
    React.useEffect(() => {
        const index = classSequence.indexOf(student.class);
        if (index !== -1) {
            if (type === 'promote' && index < classSequence.length - 1) {
                setTargetClass(classSequence[index + 1]);
            } else if (type === 'demote' && index > 0) {
                setTargetClass(classSequence[index - 1]);
            }
        }
    }, [student, type]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!targetClass) {
            return toast.error('Please select a target class');
        }

        try {
            await onConfirm({
                toClass: targetClass,
                toSection: targetSection,
                academicYear,
                remarks,
                forceOverride
            });
        } catch (error) {
            if (error?.response?.data?.requiresOverride) {
                setShowOverrideWarning(true);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

                <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

                <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <h3 className="text-lg font-medium leading-6 text-gray-900 capitalize">
                                    {type} Student
                                </h3>
                                <div className="mt-2 text-sm text-gray-500 mb-4">
                                    {type === 'promote' ? 'Promoting' : 'Demoting'} <strong>{student.name || student.fullName}</strong>.
                                    <br />Current Class: <strong>{student.class} {student.section && `(${student.section})`}</strong>
                                </div>

                                {showOverrideWarning && (
                                    <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md flex items-start gap-3">
                                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-sm">Warning: Duplicate Action Detected</p>
                                            <p className="text-xs">This student has already been promoted/demoted in this academic year. Are you sure you want to do this again?</p>
                                            <label className="flex items-center mt-2 text-sm font-medium">
                                                <input
                                                    type="checkbox"
                                                    className="mr-2 rounded border-gray-300 text-primary-600"
                                                    checked={forceOverride}
                                                    onChange={(e) => setForceOverride(e.target.checked)}
                                                />
                                                Yes, override and {type} anyway
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Target Class *</label>
                                            <select
                                                required
                                                value={targetClass}
                                                onChange={(e) => setTargetClass(e.target.value)}
                                                className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                            >
                                                <option value="">Select Class...</option>
                                                {classSequence.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Target Section</label>
                                            <input
                                                type="text"
                                                value={targetSection}
                                                onChange={(e) => setTargetSection(e.target.value.toUpperCase())}
                                                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                                placeholder="e.g. A"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Academic Year *</label>
                                        <input
                                            type="text"
                                            required
                                            value={academicYear}
                                            onChange={(e) => setAcademicYear(e.target.value)}
                                            className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                            placeholder="e.g. 2025-2026"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Remarks (Optional)</label>
                                        <textarea
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            rows="2"
                                            className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                            placeholder={`Reason for ${type}...`}
                                        />
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isLoading || (showOverrideWarning && !forceOverride)}
                            className={`inline-flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none sm:ml-3 sm:w-auto sm:text-sm ${type === 'promote' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                } disabled:opacity-50`}
                        >
                            {isLoading ? 'Processing...' : `Confirm ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClassActionModal;
