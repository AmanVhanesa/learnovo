import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsService } from '../services/studentsService';
import { Search, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Loader, CheckSquare, Square, ArrowLeft, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const classSequence = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/;

const BulkPromotion = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Source Filters
    const [sourceClass, setSourceClass] = useState('');
    const [sourceSection, setSourceSection] = useState('');

    // Student Data
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination for large classes
    const [currentPage, setCurrentPage] = useState(1);

    // Target Action Form
    const currentYear = new Date().getFullYear();
    const defaultAcademicYear = `${currentYear}-${currentYear + 1}`;

    const [actionType, setActionType] = useState('promoted');
    const [targetClass, setTargetClass] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [targetYear, setTargetYear] = useState(defaultAcademicYear);
    const [remarks, setRemarks] = useState('');
    const [forceOverride, setForceOverride] = useState(false);

    const [executionSummary, setExecutionSummary] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Fetch filter options
    const { data: filterOptions = { classes: [], sections: [] } } = useQuery({
        queryKey: ['bulk-promotion-filters'],
        queryFn: async () => {
            const response = await studentsService.getFilters();
            if (response.success) {
                return {
                    classes: response.data.classes || [],
                    sections: response.data.sections || []
                };
            }
            return { classes: [], sections: [] };
        },
        staleTime: 5 * 60 * 1000,
    });

    // Reset page and selection when source class/section changes
    useEffect(() => {
        if (sourceClass) {
            setCurrentPage(1);
            setSelectedStudents([]);
        } else {
            setSelectedStudents([]);
        }
    }, [sourceClass, sourceSection]);

    // Auto-suggest target class when source class or action type changes
    useEffect(() => {
        if (!sourceClass) return;
        const classes = filterOptions.classes || [];
        const classIndex = classes.indexOf(sourceClass);
        if (classIndex === -1) {
            setTargetClass('');
            return;
        }
        if (actionType === 'promoted' && classIndex < classes.length - 1) {
            setTargetClass(classes[classIndex + 1]);
        } else if (actionType === 'demoted' && classIndex > 0) {
            setTargetClass(classes[classIndex - 1]);
        } else {
            setTargetClass('');
        }
    }, [sourceClass, actionType, filterOptions.classes]);

    // Fetch students for the source class
    const { data: studentsResponse, isLoading } = useQuery({
        queryKey: ['bulk-promotion-students', sourceClass, sourceSection, currentPage],
        queryFn: async () => {
            const response = await studentsService.list({
                class: sourceClass,
                section: sourceSection,
                status: 'active',
                limit: 500,
                page: currentPage
            });
            return response;
        },
        enabled: !!sourceClass,
        placeholderData: (prev) => prev,
    });

    // Auto select all students on first page load
    useEffect(() => {
        if (studentsResponse && currentPage === 1) {
            const studentData = studentsResponse?.data || [];
            setSelectedStudents(studentData.map(s => s._id));
        }
    }, [studentsResponse, currentPage]);

    const students = sourceClass ? (studentsResponse?.data || []) : [];
    const totalStudents = studentsResponse?.pagination?.total || students.length;
    const totalPages = studentsResponse?.pagination?.totalPages || studentsResponse?.pagination?.pages || 1;

    // Filter students locally by search query
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const query = searchQuery.toLowerCase().trim();
        return students.filter(s =>
            (s.name || s.fullName || '').toLowerCase().includes(query) ||
            (s.admissionNumber || '').toLowerCase().includes(query)
        );
    }, [students, searchQuery]);

    const handleSelectAll = () => {
        const visibleIds = filteredStudents.map(s => s._id);
        const allVisibleSelected = visibleIds.every(id => selectedStudents.includes(id));
        if (allVisibleSelected) {
            // Deselect all visible
            setSelectedStudents(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            // Select all visible (merge with existing selections)
            setSelectedStudents(prev => [...new Set([...prev, ...visibleIds])]);
        }
    };

    const handleSelectStudent = (id) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
        );
    };

    // Use school's actual classes from API for target dropdown
    const targetClassOptions = useMemo(() => {
        return filterOptions.classes || [];
    }, [filterOptions.classes]);

    const isValidAcademicYear = (year) => {
        if (!ACADEMIC_YEAR_REGEX.test(year)) return false;
        const [start, end] = year.split('-').map(Number);
        return end === start + 1;
    };

    // Bulk action mutation
    const bulkActionMutation = useMutation({
        mutationFn: (payload) => studentsService.bulkClassAction(payload),
        onSuccess: (response) => {
            setExecutionSummary({
                successCount: response.successCount,
                errors: response.errors || [],
                message: response.message
            });

            if (response.successCount > 0) {
                toast.success(response.message);
                setSelectedStudents([]);
                queryClient.invalidateQueries({ queryKey: ['bulk-promotion-students'] });
                queryClient.invalidateQueries({ queryKey: ['students'] });
            } else if (response.errors?.length > 0) {
                toast.error('Bulk operation failed or was partially blocked');
            }
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Failed to execute bulk action');
        },
    });

    const isExecuting = bulkActionMutation.isPending;

    const handleExecute = (e) => {
        if (e) e.preventDefault();
        if (selectedStudents.length === 0) return toast.error('Please select at least one student');
        if (!targetClass) return toast.error('Please select a target class');
        if (!targetYear) return toast.error('Target academic year is required');
        if (!isValidAcademicYear(targetYear)) return toast.error('Academic year must be in format YYYY-YYYY (e.g. 2025-2026)');

        // Show confirmation dialog first
        if (!showConfirmDialog) {
            setShowConfirmDialog(true);
            return;
        }

        setExecutionSummary(null);
        setShowConfirmDialog(false);

        bulkActionMutation.mutate({
            studentIds: selectedStudents,
            actionType,
            toClass: targetClass,
            toSection: targetSection,
            academicYear: targetYear,
            remarks,
            forceOverride
        });
    };

    const allVisibleSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudents.includes(s._id));
    const someVisibleSelected = filteredStudents.some(s => selectedStudents.includes(s._id));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button
                        onClick={() => navigate('/app/students')}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Bulk Promotion & Demotion</h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-[#8E8E93]">
                            Move multiple students between classes & academic years in a single batch.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* SETTINGS PANEL */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Source Selection */}
                    <div className="bg-white dark:bg-[#1C1C1E] p-4 sm:p-6 rounded-lg border border-gray-200 dark:border-[#38383A] shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                            Step 1: Select Source
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Source Class</label>
                                <select
                                    value={sourceClass}
                                    onChange={(e) => setSourceClass(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white py-2 pl-3 pr-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                >
                                    <option value="">Select Class</option>
                                    {filterOptions.classes.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Source Section (Optional)</label>
                                <select
                                    value={sourceSection}
                                    onChange={(e) => setSourceSection(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white py-2 pl-3 pr-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                >
                                    <option value="">All Sections</option>
                                    {filterOptions.sections.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Target Selection */}
                    <div className="bg-white dark:bg-[#1C1C1E] p-4 sm:p-6 rounded-lg border border-gray-200 dark:border-[#38383A] shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                            Step 2: Configure Target
                        </h2>
                        <form onSubmit={handleExecute} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Action</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setActionType('promoted')}
                                        className={`flex-1 flex justify-center items-center py-2 px-4 text-sm font-medium rounded-l-md border ${actionType === 'promoted' ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400 z-10' : 'bg-white dark:bg-[#1C1C1E] border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'}`}
                                    >
                                        <TrendingUp className="w-4 h-4 mr-2" /> Promote
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActionType('demoted')}
                                        className={`flex-1 flex justify-center items-center py-2 px-4 text-sm font-medium rounded-r-md border ${actionType === 'demoted' ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-500 text-orange-700 dark:text-orange-400 z-10' : 'bg-white dark:bg-[#1C1C1E] border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'} -ml-px`}
                                    >
                                        <TrendingDown className="w-4 h-4 mr-2" /> Demote
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Target Class *</label>
                                <select
                                    required
                                    value={targetClass}
                                    onChange={(e) => setTargetClass(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white py-2 pl-3 pr-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                >
                                    <option value="">Select Class...</option>
                                    {targetClassOptions.map(c => (
                                        <option key={c} value={c} disabled={c === sourceClass}>{c}{c === sourceClass ? ' (current)' : ''}</option>
                                    ))}
                                    <option value="GRADUATED">Graduated / Alumni</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Target Section</label>
                                <select
                                    value={targetSection}
                                    onChange={(e) => setTargetSection(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white py-2 pl-3 pr-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                >
                                    <option value="">Keep current section</option>
                                    {filterOptions.sections.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Target Academic Year *</label>
                                <input
                                    type="text"
                                    required
                                    value={targetYear}
                                    onChange={(e) => setTargetYear(e.target.value)}
                                    className={`mt-1 block w-full rounded-md border ${targetYear && !isValidAcademicYear(targetYear) ? 'border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-[#38383A] focus:border-primary-500 focus:ring-primary-500'} bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white py-2 px-3 shadow-sm focus:outline-none sm:text-sm`}
                                    placeholder="e.g. 2025-2026"
                                />
                                {targetYear && !isValidAcademicYear(targetYear) && (
                                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">Format must be YYYY-YYYY (e.g. 2025-2026)</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Remarks (Optional)</label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    rows="2"
                                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                    placeholder={`Reason for bulk ${actionType}...`}
                                />
                            </div>

                            <div className="flex items-center mt-4">
                                <input
                                    id="force"
                                    type="checkbox"
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                    checked={forceOverride}
                                    onChange={(e) => setForceOverride(e.target.checked)}
                                />
                                <label htmlFor="force" className="ml-2 block text-sm text-gray-900 dark:text-white">
                                    Force override (ignore duplicates this year)
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isExecuting || selectedStudents.length === 0 || !sourceClass || !targetClass || !isValidAcademicYear(targetYear)}
                                className={`mt-6 w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${actionType === 'promoted' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isExecuting ? <Loader className="w-5 h-5 animate-spin" /> : `Execute ${actionType.charAt(0).toUpperCase() + actionType.slice(1)} (${selectedStudents.length})`}
                            </button>

                            {!sourceClass && (
                                <p className="text-xs text-gray-400 dark:text-[#636366] text-center">Select a source class first</p>
                            )}
                            {sourceClass && selectedStudents.length === 0 && (
                                <p className="text-xs text-gray-400 dark:text-[#636366] text-center">Select students from Step 3 to proceed</p>
                            )}
                        </form>
                    </div>
                </div>

                {/* STUDENTS TABLE PANEL */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Execution Summary Alert */}
                    {executionSummary && (
                        <div className={`p-4 rounded-md ${executionSummary.errors.length > 0 ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}`}>
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    {executionSummary.errors.length > 0 ? <AlertTriangle className="h-5 w-5 text-orange-400" /> : <ChevronRight className="h-5 w-5 text-green-400" />}
                                </div>
                                <div className="ml-3">
                                    <h3 className={`text-sm font-medium ${executionSummary.errors.length > 0 ? 'text-orange-800 dark:text-orange-300' : 'text-green-800 dark:text-green-300'}`}>
                                        {executionSummary.message}
                                    </h3>
                                    {executionSummary.errors.length > 0 && (
                                        <div className="mt-2 text-sm text-orange-700 dark:text-orange-400">
                                            <ul className="list-disc pl-5 space-y-1">
                                                {executionSummary.errors.map((error, idx) => (
                                                    <li key={idx}>{error}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-[#1C1C1E] rounded-lg border border-gray-200 dark:border-[#38383A] shadow-sm overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E]">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                                    Step 3: Select Students ({selectedStudents.length} of {totalStudents})
                                </h2>
                                {students.length > 0 && (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#636366]" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search by name or adm no..."
                                            className="pl-9 pr-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-primary-500 w-full sm:w-64"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center items-center py-20">
                                <Loader className="w-8 h-8 animate-spin text-primary-600" />
                            </div>
                        ) : !sourceClass ? (
                            <div className="text-center py-20 text-gray-500 dark:text-[#8E8E93]">
                                Please select a source class to load students.
                            </div>
                        ) : students.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 dark:text-[#8E8E93]">
                                No active students found in this class.
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 dark:text-[#8E8E93]">
                                No students match your search "{searchQuery}".
                            </div>
                        ) : (
                            <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                                <table className="min-w-full min-w-[600px] divide-y divide-gray-200 dark:divide-dark-border">
                                    <thead className="bg-gray-50 dark:bg-[#2C2C2E] sticky top-0 z-10">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                                <button onClick={handleSelectAll} className="flex items-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 focus:outline-none">
                                                    {allVisibleSelected ? <CheckSquare className="w-5 h-5 mr-1" /> : someVisibleSelected ? <CheckSquare className="w-5 h-5 mr-1 opacity-50" /> : <Square className="w-5 h-5 mr-1" />}
                                                    All
                                                </button>
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Adm No.</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Name</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Section</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Current A.Y.</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Gender</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-200 dark:divide-dark-border">
                                        {filteredStudents.map((student) => (
                                            <tr
                                                key={student._id}
                                                className={`hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer ${selectedStudents.includes(student._id) ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''}`}
                                                onClick={() => handleSelectStudent(student._id)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        {selectedStudents.includes(student._id) ?
                                                            <CheckSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" /> :
                                                            <Square className="w-5 h-5 text-gray-400 dark:text-[#636366]" />
                                                        }
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                    {student.admissionNumber || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    {student.name || student.fullName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                    {student.section || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                    {student.academicYear || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93] capitalize">
                                                    {student.gender || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                                    Page {currentPage} of {totalPages} ({totalStudents} total students)
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        disabled={currentPage <= 1 || isLoading}
                                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        disabled={currentPage >= totalPages || isLoading}
                                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-50"
                                    >
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center px-4">
                        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-black dark:bg-opacity-60" onClick={() => setShowConfirmDialog(false)} />
                        <div className="relative z-10 bg-white dark:bg-[#1C1C1E] rounded-lg shadow-xl max-w-md w-full p-6">
                            <div className="flex items-start gap-4">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${actionType === 'promoted' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                                    <AlertTriangle className={`w-5 h-5 ${actionType === 'promoted' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Confirm Bulk {actionType === 'promoted' ? 'Promotion' : 'Demotion'}
                                    </h3>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-[#8E8E93]">
                                        You are about to <strong>{actionType === 'promoted' ? 'promote' : 'demote'}</strong>{' '}
                                        <strong>{selectedStudents.length}</strong> student{selectedStudents.length !== 1 ? 's' : ''}{' '}
                                        from <strong>{sourceClass}{sourceSection ? ` (${sourceSection})` : ''}</strong>{' '}
                                        to <strong>{targetClass}{targetSection ? ` (${targetSection})` : ''}</strong>{' '}
                                        for academic year <strong>{targetYear}</strong>.
                                    </p>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-[#8E8E93]">
                                        This action will update all selected students' class and academic year records.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#8E8E93] bg-white dark:bg-[#1C1C1E] border border-gray-300 dark:border-[#38383A] rounded-md hover:bg-gray-50 dark:hover:bg-[#2C2C2E] w-full sm:w-auto"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExecute}
                                    disabled={isExecuting}
                                    className={`px-4 py-2 text-sm font-medium text-white rounded-md w-full sm:w-auto ${actionType === 'promoted' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'} disabled:opacity-50`}
                                >
                                    {isExecuting ? <Loader className="w-4 h-4 animate-spin" /> : `Yes, ${actionType === 'promoted' ? 'Promote' : 'Demote'} ${selectedStudents.length} Students`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulkPromotion;
