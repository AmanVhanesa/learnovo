import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { studentsService } from '../services/studentsService';
import { Search, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Loader, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';

const classSequence = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const BulkPromotion = () => {
    const { user } = useAuth();

    // Source Filters
    const [sourceClass, setSourceClass] = useState('');
    const [sourceSection, setSourceSection] = useState('');
    const [filterOptions, setFilterOptions] = useState({ classes: [], sections: [] });

    // Student Data
    const [students, setStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Target Action Form
    const currentYear = new Date().getFullYear();
    const defaultAcademicYear = `${currentYear}-${currentYear + 1}`;

    const [actionType, setActionType] = useState('promoted');
    const [targetClass, setTargetClass] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [targetYear, setTargetYear] = useState(defaultAcademicYear);
    const [remarks, setRemarks] = useState('');
    const [forceOverride, setForceOverride] = useState(false);

    const [isExecuting, setIsExecuting] = useState(false);
    const [executionSummary, setExecutionSummary] = useState(null);

    useEffect(() => {
        fetchFilterOptions();
    }, []);

    useEffect(() => {
        if (sourceClass) {
            fetchStudents();
            // Auto-suggest next class
            const index = classSequence.indexOf(sourceClass);
            if (index !== -1 && actionType === 'promoted' && index < classSequence.length - 1) {
                setTargetClass(classSequence[index + 1]);
            } else if (index !== -1 && actionType === 'demoted' && index > 0) {
                setTargetClass(classSequence[index - 1]);
            }
        } else {
            setStudents([]);
            setSelectedStudents([]);
        }
    }, [sourceClass, sourceSection, actionType]);

    const fetchFilterOptions = async () => {
        try {
            const response = await studentsService.getFilters();
            if (response.success) {
                setFilterOptions({
                    classes: response.data.classes || [],
                    sections: response.data.sections || []
                });
            }
        } catch (error) {
            console.error('Error fetching filters:', error);
        }
    };

    const fetchStudents = async () => {
        try {
            setIsLoading(true);
            const response = await studentsService.list({
                class: sourceClass,
                section: sourceSection,
                status: 'active',
                limit: 1000 // Get all for bulk
            });
            setStudents(response?.data || []);
            // Auto select all initially
            setSelectedStudents((response?.data || []).map(s => s._id));
        } catch (error) {
            toast.error('Failed to load students');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedStudents.length === students.length) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(students.map(s => s._id));
        }
    };

    const handleSelectStudent = (id) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
        );
    };

    const handleExecute = async (e) => {
        e.preventDefault();
        if (selectedStudents.length === 0) return toast.error('Please select at least one student');
        if (!targetClass) return toast.error('Please select a target class');
        if (!targetYear) return toast.error('Target academic year is required');

        try {
            setIsExecuting(true);
            setExecutionSummary(null);

            const payload = {
                studentIds: selectedStudents,
                actionType,
                toClass: targetClass,
                toSection: targetSection,
                academicYear: targetYear,
                remarks,
                forceOverride
            };

            const response = await studentsService.bulkClassAction(payload);
            setExecutionSummary({
                successCount: response.successCount,
                errors: response.errors || [],
                message: response.message
            });

            if (response.successCount > 0) {
                toast.success(response.message);
                // Refresh list
                fetchStudents();
            } else if (response.errors?.length > 0) {
                toast.error('Bulk operation failed or was partially blocked');
            }

        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to execute bulk action');
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bulk Promotion & Demotion</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Move multiple students between classes & academic years in a single batch.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* SETTINGS PANEL */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Source Selection */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            Step 1: Select Source
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Source Class</label>
                                <select
                                    value={sourceClass}
                                    onChange={(e) => setSourceClass(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                >
                                    <option value="">Select Class</option>
                                    {filterOptions.classes.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Source Section (Optional)</label>
                                <select
                                    value={sourceSection}
                                    onChange={(e) => setSourceSection(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
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
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            Step 2: Configure Target
                        </h2>
                        <form onSubmit={handleExecute} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Action</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setActionType('promoted')}
                                        className={`flex-1 flex justify-center items-center py-2 px-4 text-sm font-medium border ${actionType === 'promoted' ? 'bg-green-50 border-green-500 text-green-700 z-10' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'} rounded-l-md`}
                                    >
                                        <TrendingUp className="w-4 h-4 mr-2" /> Promote
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActionType('demoted')}
                                        className={`flex-1 flex justify-center items-center py-2 px-4 text-sm font-medium border-t border-b border-r ${actionType === 'demoted' ? 'bg-orange-50 border-orange-500 text-orange-700 z-10' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'} rounded-r-md`}
                                    >
                                        <TrendingDown className="w-4 h-4 mr-2" /> Demote
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Target Class *</label>
                                <select
                                    required
                                    value={targetClass}
                                    onChange={(e) => setTargetClass(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                >
                                    <option value="">Select Class...</option>
                                    {classSequence.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option value="GRADUATED">Graduated / Alumni</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Target Section</label>
                                <input
                                    type="text"
                                    value={targetSection}
                                    onChange={(e) => setTargetSection(e.target.value.toUpperCase())}
                                    placeholder="Leave blank to drop section"
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Target Academic Year *</label>
                                <input
                                    type="text"
                                    required
                                    value={targetYear}
                                    onChange={(e) => setTargetYear(e.target.value)}
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
                                <label htmlFor="force" className="ml-2 block text-sm text-gray-900">
                                    Force override (ignore duplicates this year)
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isExecuting || selectedStudents.length === 0 || !sourceClass}
                                className={`mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${actionType === 'promoted' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
                                    } disabled:opacity-50`}
                            >
                                {isExecuting ? <Loader className="w-5 h-5 animate-spin" /> : `Execute ${actionType.charAt(0).toUpperCase() + actionType.slice(1)} (${selectedStudents.length})`}
                            </button>
                        </form>
                    </div>
                </div>

                {/* STUDENTS TABLE PANEL */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Execution Summary Alert */}
                    {executionSummary && (
                        <div className={`p-4 rounded-md ${executionSummary.errors.length > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    {executionSummary.errors.length > 0 ? <AlertTriangle className="h-5 w-5 text-orange-400" /> : <ChevronRight className="h-5 w-5 text-green-400" />}
                                </div>
                                <div className="ml-3">
                                    <h3 className={`text-sm font-medium ${executionSummary.errors.length > 0 ? 'text-orange-800' : 'text-green-800'}`}>
                                        {executionSummary.message}
                                    </h3>
                                    {executionSummary.errors.length > 0 && (
                                        <div className="mt-2 text-sm text-orange-700">
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

                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-medium text-gray-900">
                                Step 3: Select Students ({selectedStudents.length} of {students.length})
                            </h2>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center items-center py-20">
                                <Loader className="w-8 h-8 animate-spin text-primary-600" />
                            </div>
                        ) : !sourceClass ? (
                            <div className="text-center py-20 text-gray-500">
                                Please select a source class to load students.
                            </div>
                        ) : students.length === 0 ? (
                            <div className="text-center py-20 text-gray-500">
                                No active students found in this class.
                            </div>
                        ) : (
                            <div className="overflow-y-auto max-h-[600px]">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <button onClick={handleSelectAll} className="flex items-center text-primary-600 hover:text-primary-800 focus:outline-none">
                                                    {selectedStudents.length === students.length ? <CheckSquare className="w-5 h-5 mr-1" /> : <Square className="w-5 h-5 mr-1" />}
                                                    All
                                                </button>
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adm No.</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current A.Y.</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {students.map((student) => (
                                            <tr
                                                key={student._id}
                                                className={`hover:bg-gray-50 cursor-pointer ${selectedStudents.includes(student._id) ? 'bg-primary-50/50' : ''}`}
                                                onClick={() => handleSelectStudent(student._id)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        {selectedStudents.includes(student._id) ?
                                                            <CheckSquare className="w-5 h-5 text-primary-600" /> :
                                                            <Square className="w-5 h-5 text-gray-400" />
                                                        }
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {student.admissionNumber}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {student.name || student.fullName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {student.academicYear || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                                    {student.gender || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BulkPromotion;
