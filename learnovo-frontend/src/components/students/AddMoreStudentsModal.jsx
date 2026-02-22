import React, { useState } from 'react';
import { X, Loader2, Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentListService } from '../../services/studentListService';
import StudentSearchDropdown from './StudentSearchDropdown';

const AddMoreStudentsModal = ({ isOpen, onClose, onSuccess, listId }) => {
    const [numbersText, setNumbersText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSelectStudent = (admissionNumber) => {
        setNumbersText((prev) => {
            const current = prev.trim();
            if (current) {
                const existingNumbers = current.split(/[\\n\\s,]+/).map(n => n.trim());
                if (existingNumbers.includes(admissionNumber)) {
                    toast.success('Student already queued for addition');
                    return current;
                }
                return `${current}, ${admissionNumber}`;
            }
            return admissionNumber;
        });
        toast.success(`Added admission number: ${admissionNumber}`);
    };

    // Compute live count of numbers
    const admissionNumbers = numbersText
        .split(/[\\n\\s,]+/)
        .map(n => n.trim())
        .filter(n => n.length > 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (admissionNumbers.length === 0) {
            return toast.error('Please enter at least one admission number');
        }

        try {
            setIsLoading(true);
            const res = await studentListService.addStudents(listId, admissionNumbers);

            if (res.success) {
                toast.success(res.message);
                if (res.warnings) {
                    toast.error(res.warnings, { duration: 5000 });
                }
                onSuccess();
                onClose();
                setNumbersText('');
            } else {
                toast.error(res.message || 'Failed to add students');
            }
        } catch (error) {
            console.error('Error adding students to list:', error);
            toast.error(error.response?.data?.message || 'Server error while adding students');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

                <div className="relative inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-md w-full">
                    <div className="px-4 pt-5 pb-4 bg-white sm:p-6 sm:pb-4 border-b border-gray-100">
                        <div className="flex justify-between items-center mb-5">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                                    <Users className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-medium leading-6 text-gray-900">
                                    Add More Students
                                </h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Admission Numbers
                                    </label>
                                    <span className="text-xs text-primary-600 font-medium bg-primary-50 px-2 py-0.5 rounded-full">
                                        {admissionNumbers.length} to add
                                    </span>
                                </div>
                                <StudentSearchDropdown onSelect={handleSelectStudent} />
                                <textarea
                                    rows={6}
                                    value={numbersText}
                                    onChange={(e) => setNumbersText(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 sm:text-sm resize-none font-mono"
                                    placeholder="Paste admission numbers here...\nSeparate by commas, spaces, or new lines."
                                    autoFocus
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    Students already in the list will be skipped automatically. Invalid numbers will trigger a warning.
                                </p>
                            </div>

                            <div className="pt-5 border-t border-gray-100 flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading || admissionNumbers.length === 0}
                                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4 mr-1 lg:-ml-1" />
                                            Add Students
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddMoreStudentsModal;
