import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { studentsService } from '../../services/studentsService';

const StudentSearchDropdown = ({ onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchStudents = async () => {
            if (!query.trim()) {
                setResults([]);
                setIsOpen(false);
                return;
            }

            setIsLoading(true);
            try {
                const response = await studentsService.list({ search: query, limit: 10 });
                if (response.success) {
                    setResults(response.data);
                    setIsOpen(true);
                }
            } catch (error) {
                console.error('Error searching students:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const debounceTimer = setTimeout(searchStudents, 300);

        return () => clearTimeout(debounceTimer);
    }, [query]);

    const handleSelect = (student) => {
        if (student && student.admissionNumber) {
            onSelect(student.admissionNumber);
            setQuery('');
            setIsOpen(false);
        }
    };

    return (
        <div className="relative mb-4" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Search & Add Student
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or admission number..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    onFocus={() => {
                        if (results.length > 0) setIsOpen(true);
                    }}
                />
                {isLoading && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
                    </div>
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 overflow-auto ring-1 ring-black ring-opacity-5">
                    {results.map((student) => (
                        <button
                            key={student._id}
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 focus:outline-none focus:bg-primary-50 transition-colors"
                            onClick={() => handleSelect(student)}
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="font-medium text-gray-900">{student.fullName || student.name}</span>
                                    <span className="text-xs text-gray-500">
                                        {student.class || '-'} {student.section ? `(${student.section})` : ''}
                                    </span>
                                </div>
                                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    {student.admissionNumber || 'N/A'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )
            }

            {
                isOpen && query.trim() && !isLoading && results.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-4 px-4 text-sm text-center text-gray-500 ring-1 ring-black ring-opacity-5">
                        No students found matching "{query}"
                    </div>
                )
            }
        </div >
    );
};

export default StudentSearchDropdown;
