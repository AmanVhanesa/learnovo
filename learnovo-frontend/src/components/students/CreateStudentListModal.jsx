import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentListService } from '../../services/studentListService';
import StudentSearchDropdown from './StudentSearchDropdown';

const CreateStudentListModal = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [numbersText, setNumbersText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSelectStudent = (admissionNumber) => {
        setNumbersText((prev) => {
            const current = prev.trim();
            if (current) {
                // Check if number already exists to avoid duplicates
                const existingNumbers = current.split(/[\\n\\s,]+/).map(n => n.trim());
                if (existingNumbers.includes(admissionNumber)) {
                    toast.success('Student already added to the list');
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
        if (!name.trim()) {
            return toast.error('List name is required');
        }

        try {
            setIsLoading(true);
            const res = await studentListService.create({
                name: name.trim(),
                description: description.trim(),
                admissionNumbers
            });

            if (res.success) {
                toast.success(res.message);
                if (res.warnings) {
                    toast.error(res.warnings, { duration: 5000 });
                }
                onSuccess(res.data);
                onClose();
                setName('');
                setDescription('');
                setNumbersText('');
            } else {
                toast.error(res.message || 'Failed to create list');
            }
        } catch (error) {
            console.error('Error creating list:', error);
            toast.error(error.response?.data?.message || 'Server error while creating list');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

                <div className="relative inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="px-4 pt-5 pb-4 bg-white sm:p-6 sm:pb-4 border-b border-gray-100">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">
                                Create Custom Student List
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-500 focus:outline-none"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    List Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                    placeholder="e.g. Annual Tour List"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description <span className="text-gray-400 font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                    placeholder="Brief description of this list..."
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Admission Numbers
                                    </label>
                                    <span className="text-xs text-gray-500">
                                        {admissionNumbers.length} number{admissionNumbers.length !== 1 && 's'} recognized
                                    </span>
                                </div>

                                <StudentSearchDropdown onSelect={handleSelectStudent} />

                                <textarea
                                    rows={5}
                                    value={numbersText}
                                    onChange={(e) => setNumbersText(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 sm:text-sm resize-none font-mono"
                                    placeholder="Paste admission numbers here...\nSeparate by commas, spaces, or new lines."
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Invalid numbers will be skipped and shown as a warning.
                                </p>
                            </div>

                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        'Create List'
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

export default CreateStudentListModal;
