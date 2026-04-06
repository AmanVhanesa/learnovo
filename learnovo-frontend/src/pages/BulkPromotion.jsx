import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsService } from '../services/studentsService';
import { Search, TrendingUp, TrendingDown, AlertTriangle, Loader2, CheckSquare, Square, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { sortClasses } from '../utils/classOrder';

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

    // Pagination
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

    const { data: filterOptions = { classes: [], sections: [] } } = useQuery({
        queryKey: ['bulk-promotion-filters'],
        queryFn: async () => {
            const response = await studentsService.getFilters();
            if (response.success) {
                return {
                    classes: sortClasses(response.data.classes || []),
                    sections: response.data.sections || []
                };
            }
            return { classes: [], sections: [] };
        },
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (sourceClass) {
            setCurrentPage(1);
            setSelectedStudents([]);
        } else {
            setSelectedStudents([]);
        }
    }, [sourceClass, sourceSection]);

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

    useEffect(() => {
        if (studentsResponse && currentPage === 1) {
            const studentData = studentsResponse?.data || [];
            setSelectedStudents(studentData.map(s => s._id));
        }
    }, [studentsResponse, currentPage]);

    const students = sourceClass ? (studentsResponse?.data || []) : [];
    const totalStudents = studentsResponse?.pagination?.total || students.length;
    const totalPages = studentsResponse?.pagination?.totalPages || studentsResponse?.pagination?.pages || 1;

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
            setSelectedStudents(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedStudents(prev => [...new Set([...prev, ...visibleIds])]);
        }
    };

    const handleSelectStudent = (id) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
        );
    };

    const targetClassOptions = useMemo(() => {
        return filterOptions.classes || [];
    }, [filterOptions.classes]);

    const isValidAcademicYear = (year) => {
        if (!ACADEMIC_YEAR_REGEX.test(year)) return false;
        const [start, end] = year.split('-').map(Number);
        return end === start + 1;
    };

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
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-5">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                            Step 1: Select Source
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Source Class</label>
                                <select
                                    value={sourceClass}
                                    onChange={(e) => setSourceClass(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                    <option value="">Select Class</option>
                                    {filterOptions.classes.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Source Section (Optional)</label>
                                <select
                                    value={sourceSection}
                                    onChange={(e) => setSourceSection(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-5">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                            Step 2: Configure Target
                        </h2>
                        <form onSubmit={handleExecute} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Action</label>
                                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setActionType('promoted')}
                                        className={`flex-1 flex justify-center items-center py-2 px-3 text-sm font-medium rounded-md transition-colors ${actionType === 'promoted' ? 'bg-white dark:bg-[#3A3A3C] text-teal-600 dark:text-teal-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                                    >
                                        <TrendingUp className="w-4 h-4 mr-1.5" /> Promote
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActionType('demoted')}
                                        className={`flex-1 flex justify-center items-center py-2 px-3 text-sm font-medium rounded-md transition-colors ${actionType === 'demoted' ? 'bg-white dark:bg-[#3A3A3C] text-amber-600 dark:text-amber-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                                    >
                                        <TrendingDown className="w-4 h-4 mr-1.5" /> Demote
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Class *</label>
                                <select
                                    required
                                    value={targetClass}
                                    onChange={(e) => setTargetClass(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                    <option value="">Select Class...</option>
                                    {targetClassOptions.map(c => (
                                        <option key={c} value={c} disabled={c === sourceClass}>{c}{c === sourceClass ? ' (current)' : ''}</option>
                                    ))}
                                    <option value="GRADUATED">Graduated / Alumni</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Section</label>
                                <select
                                    value={targetSection}
                                    onChange={(e) => setTargetSection(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                    <option value="">Keep current section</option>
                                    {filterOptions.sections.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Academic Year *</label>
                                <input
                                    type="text"
                                    required
                                    value={targetYear}
                                    onChange={(e) => setTargetYear(e.target.value)}
                                    className={`w-full rounded-lg border ${targetYear && !isValidAcademicYear(targetYear) ? 'border-red-300 dark:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-[#38383A] focus:ring-teal-500'} bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:border-transparent`}
                                    placeholder="e.g. 2025-2026"
                                />
                                {targetYear && !isValidAcademicYear(targetYear) && (
                                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">Format must be YYYY-YYYY (e.g. 2025-2026)</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Remarks (Optional)</label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    rows="2"
                                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    placeholder={`Reason for bulk ${actionType}...`}
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-[#8E8E93]">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    checked={forceOverride}
                                    onChange={(e) => setForceOverride(e.target.checked)}
                                />
                                Force override (ignore duplicates this year)
                            </label>

                            <button
                                type="submit"
                                disabled={isExecuting || selectedStudents.length === 0 || !sourceClass || !targetClass || !isValidAcademicYear(targetYear)}
                                className={`mt-4 w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${actionType === 'promoted' ? 'bg-teal-600 hover:bg-teal-700 focus:ring-teal-500' : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Execute ${actionType.charAt(0).toUpperCase() + actionType.slice(1)} (${selectedStudents.length})`}
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
                        <div className={`p-4 rounded-xl ${executionSummary.errors.length > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800'}`}>
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    {executionSummary.errors.length > 0 ? <AlertTriangle className="h-5 w-5 text-amber-400" /> : <CheckSquare className="h-5 w-5 text-teal-400" />}
                                </div>
                                <div className="ml-3">
                                    <h3 className={`text-sm font-medium ${executionSummary.errors.length > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-teal-800 dark:text-teal-300'}`}>
                                        {executionSummary.message}
                                    </h3>
                                    {executionSummary.errors.length > 0 && (
                                        <div className="mt-2 text-sm text-amber-700 dark:text-amber-400">
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

                    <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] overflow-hidden">
                        <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E]">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Step 3: Select Students ({selectedStudents.length} of {totalStudents})
                                </h2>
                                {students.length > 0 && (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search by name or adm no..."
                                            className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent w-full sm:w-64"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center items-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
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
                                No students match your search &ldquo;{searchQuery}&rdquo;.
                            </div>
                        ) : (
                            <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-[#38383A]">
                                    <thead className="bg-gray-50 dark:bg-[#2C2C2E] sticky top-0 z-10">
                                        <tr>
                                            <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                                <button onClick={handleSelectAll} className="flex items-center text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300 focus:outline-none">
                                                    {allVisibleSelected ? <CheckSquare className="w-5 h-5 mr-1" /> : someVisibleSelected ? <CheckSquare className="w-5 h-5 mr-1 opacity-50" /> : <Square className="w-5 h-5 mr-1" />}
                                                    All
                                                </button>
                                            </th>
                                            <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Adm No.</th>
                                            <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Name</th>
                                            <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Section</th>
                                            <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Current A.Y.</th>
                                            <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Gender</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-200 dark:divide-[#38383A]">
                                        {filteredStudents.map((student) => (
                                            <tr
                                                key={student._id}
                                                className={`hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors ${selectedStudents.includes(student._id) ? 'bg-teal-50/50 dark:bg-teal-900/20' : ''}`}
                                                onClick={() => handleSelectStudent(student._id)}
                                            >
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    {selectedStudents.includes(student._id) ?
                                                        <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" /> :
                                                        <Square className="w-5 h-5 text-gray-400 dark:text-[#636366]" />
                                                    }
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap font-mono text-xs text-gray-500 dark:text-[#8E8E93]">
                                                    {student.admissionNumber || '-'}
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    {student.name || student.fullName}
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                    {student.section || '-'}
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                    {student.academicYear || '-'}
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93] capitalize">
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
                            <div className="px-4 sm:px-5 py-3 border-t border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                                    Page {currentPage} of {totalPages} ({totalStudents} total students)
                                </p>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        disabled={currentPage <= 1 || isLoading}
                                        className="p-1.5 rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-50 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        disabled={currentPage >= totalPages || isLoading}
                                        className="p-1.5 rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-50 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
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
                        <div className="fixed inset-0 transition-opacity bg-black/50" onClick={() => setShowConfirmDialog(false)} />
                        <div className="relative z-10 bg-white dark:bg-[#1C1C1E] rounded-xl shadow-2xl max-w-md w-full p-6">
                            <div className="flex items-start gap-4">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${actionType === 'promoted' ? 'bg-teal-100 dark:bg-teal-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                                    <AlertTriangle className={`w-5 h-5 ${actionType === 'promoted' ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`} />
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
                                </div>
                            </div>
                            <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#8E8E93] border border-gray-300 dark:border-[#38383A] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2C2C2E] w-full sm:w-auto transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExecute}
                                    disabled={isExecuting}
                                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg w-full sm:w-auto transition-colors ${actionType === 'promoted' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-amber-600 hover:bg-amber-700'} disabled:opacity-50`}
                                >
                                    {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Yes, ${actionType === 'promoted' ? 'Promote' : 'Demote'} ${selectedStudents.length} Students`}
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
