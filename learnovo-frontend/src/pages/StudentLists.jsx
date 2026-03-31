import React, { useState } from 'react';
import {
    Users, Plus, Trash2, FileText, FileSpreadsheet, Search
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { studentListService } from '../services/studentListService';
import CreateStudentListModal from '../components/students/CreateStudentListModal';
import AddMoreStudentsModal from '../components/students/AddMoreStudentsModal';
import { exportPDF, exportExcel } from '../utils/exportHelpers';
import { useSettings } from '../contexts/SettingsContext';
import { formatDate } from '../utils/formatDate';

const StudentLists = () => {
    const { settings } = useSettings();
    const queryClient = useQueryClient();
    const [activeListId, setActiveListId] = useState(null);
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [isAddingStudents, setIsAddingStudents] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch all lists
    const { data: lists = [], isLoading: isLoadingLists } = useQuery({
        queryKey: ['student-lists'],
        queryFn: async () => {
            const res = await studentListService.getAll();
            return res.success ? res.data : [];
        },
    });

    // Fetch active list details
    const { data: activeListData, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['student-list', activeListId],
        queryFn: async () => {
            const res = await studentListService.getById(activeListId);
            return res.success ? res.data : null;
        },
        enabled: !!activeListId,
    });

    // Delete list mutation
    const deleteListMutation = useMutation({
        mutationFn: (listId) => studentListService.delete(listId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['student-lists'] });
            toast.success('List deleted successfully');
            setActiveListId(null);
        },
        onError: () => {
            toast.error('Failed to delete list');
        },
    });

    const handleDeleteList = () => {
        if (!window.confirm('Are you sure you want to delete this list?')) return;
        deleteListMutation.mutate(activeListId);
    };

    // Remove student mutation
    const removeStudentMutation = useMutation({
        mutationFn: (studentId) => studentListService.removeStudent(activeListId, studentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['student-list', activeListId] });
            queryClient.invalidateQueries({ queryKey: ['student-lists'] });
            toast.success('Student removed');
        },
        onError: () => {
            toast.error('Failed to remove student');
        },
    });

    const handleRemoveStudent = (studentId) => {
        if (!window.confirm('Remove this student from the list?')) return;
        removeStudentMutation.mutate(studentId);
    };

    const handleExport = async (format) => {
        if (!activeListData) return;
        const exportId = `${format}-export`;
        try {
            toast.loading(`Generating ${format.toUpperCase()}…`, { id: exportId });
            const students = activeListData.students;
            const headers = ['S.No', 'Admission No', 'Student Name', 'Class/Section', 'Phone'];
            const rows = students.map((s, i) => [
                i + 1,
                s.admissionNumber || '-',
                s.fullName || s.name || '-',
                `${s.class || '-'} ${s.section ? '- ' + s.section : ''}`.trim(),
                s.phone || '-'
            ]);
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = activeListData.name.replace(/\s+/g, '_');

            if (format === 'pdf') {
                await exportPDF(`${safeName}_${dateStr}.pdf`, headers, rows, settings?.institution);
            } else {
                exportExcel(`${safeName}_${dateStr}.xlsx`, [headers, ...rows], 'Students');
            }
            toast.success(`${format.toUpperCase()} downloaded!`, { id: exportId });
        } catch (err) {
            toast.error(`Failed to generate ${format.toUpperCase()}`, { id: exportId });
        }
    };

    const filteredLists = lists.filter(list =>
        (list.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const [showSidebar, setShowSidebar] = useState(true);

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-theme(spacing.16))] bg-gray-50 dark:bg-[#000000] overflow-hidden">
            {/* Sidebar */}
            <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] flex-col shrink-0 ${activeListId && activeListData ? 'max-h-48 md:max-h-full' : ''}`}>
                <div className="p-4 border-b border-gray-200 dark:border-[#38383A]">
                    <button
                        onClick={() => setIsCreatingList(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="font-medium text-sm">Create New List</span>
                    </button>

                    <div className="mt-4 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search lists..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:border-[#38383A] dark:text-white dark:placeholder-[#636366]"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoadingLists ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                    ) : filteredLists.length > 0 ? (
                        filteredLists.map((list) => (
                            <button
                                key={list._id}
                                onClick={() => { setActiveListId(list._id); setShowSidebar(false); }}
                                className={`w-full text-left p-3 rounded-xl transition-all ${activeListId === list._id
                                    ? 'bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] border-primary-200 dark:border-[rgba(62,196,177,0.2)] shadow-sm ring-1 ring-primary-500'
                                    : 'bg-white dark:bg-[#1C1C1E] border-gray-100 dark:border-[#38383A] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] border shadow-sm'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`font-medium text-sm truncate pr-2 ${activeListId === list._id ? 'text-primary-900 dark:text-[#3EC4B1]' : 'text-gray-900 dark:text-white'}`}>
                                        {list.name}
                                    </h4>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${activeListId === list._id ? 'bg-primary-100 dark:bg-[rgba(62,196,177,0.12)] text-primary-700 dark:text-[#3EC4B1]' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93]'
                                        }`}>
                                        {list.studentCount || 0}
                                    </span>
                                </div>
                                {list.description && (
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] line-clamp-1">{list.description}</p>
                                )}
                                <p className="text-[10px] text-gray-400 dark:text-[#636366] mt-2">
                                    Created {formatDate(list.createdAt)}
                                </p>
                            </button>
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No lists found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 bg-gray-50/50 dark:bg-[#000000] relative`}>
                {activeListId && activeListData ? (
                    <>
                        {/* Header */}
                        <div className="bg-white dark:bg-[#1C1C1E] border-b border-gray-200 px-4 sm:px-8 py-4 sm:py-6 shrink-0 z-10">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 md:hidden mb-2">
                                        <button
                                            onClick={() => { setActiveListId(null); setShowSidebar(true); }}
                                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93]"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Back to lists</span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{activeListData.name}</h2>
                                    {activeListData.description && (
                                        <p className="mt-1 text-sm text-gray-500 dark:text-[#8E8E93]">{activeListData.description}</p>
                                    )}
                                    <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-500 dark:text-[#8E8E93]">
                                        <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#2C2C2E] px-2.5 py-1 rounded-md">
                                            <Users className="w-4 h-4 text-gray-400 dark:text-[#636366]" />
                                            <span className="font-medium text-gray-900 dark:text-white">{activeListData.students.length}</span> students
                                        </span>
                                        <span>Created: {formatDate(activeListData.createdAt)}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleExport('pdf')}
                                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-[#8E8E93] bg-white dark:bg-[#1C1C1E] border border-gray-300 dark:border-[#38383A] rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-[#2C2C2E] flex items-center gap-2 w-full sm:w-auto"
                                    >
                                        <FileText className="w-4 h-4 text-red-500" /> PDF
                                    </button>
                                    <button
                                        onClick={() => handleExport('excel')}
                                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-[#8E8E93] bg-white dark:bg-[#1C1C1E] border border-gray-300 dark:border-[#38383A] rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-[#2C2C2E] flex items-center gap-2 w-full sm:w-auto"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
                                    </button>
                                    <button
                                        onClick={() => setIsAddingStudents(true)}
                                        className="px-4 py-2 text-sm font-medium text-primary-700 dark:text-[#3EC4B1] bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] rounded-lg hover:bg-primary-100 dark:hover:bg-[rgba(62,196,177,0.2)] flex items-center gap-2 transition-colors w-full sm:w-auto"
                                    >
                                        <Plus className="w-4 h-4" /> Add Students
                                    </button>
                                    <button
                                        onClick={handleDeleteList}
                                        className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 flex items-center gap-2 transition-colors w-full sm:w-auto"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete List
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content area: scrollable */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            {isLoadingDetail ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : activeListData.students.length > 0 ? (
                                <div className="card overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full min-w-[500px] divide-y divide-gray-200 dark:divide-[#38383A]">
                                            <thead className="bg-gray-50 dark:bg-[#2C2C2E]">
                                                <tr>
                                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider w-16">
                                                        S.No
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                                        Admission No
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                                        Student Name
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                                        Class/Section
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                                                        Phone
                                                    </th>
                                                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider w-24">
                                                        Action
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-200 dark:divide-[#38383A]">
                                                {activeListData.students.map((student, index) => (
                                                    <tr key={student._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                            {index + 1}
                                                        </td>
                                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white border-l border-transparent">
                                                            {student.admissionNumber || '-'}
                                                        </td>
                                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-[rgba(62,196,177,0.12)] flex items-center justify-center text-primary-700 dark:text-[#3EC4B1] font-bold text-xs mr-3">
                                                                    {(student.fullName || student.name) ? (student.fullName || student.name).charAt(0).toUpperCase() : '?'}
                                                                </div>
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {student.fullName || student.name || 'Unknown'}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                                                {student.class || '-'} {student.section && `- ${student.section}`}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                            {student.phone || '-'}
                                                        </td>
                                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">
                                                            <button
                                                                onClick={() => handleRemoveStudent(student._id)}
                                                                className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                                                                title="Remove from list"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center card p-12">
                                    <div className="mx-auto w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mb-4">
                                        <Users className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
                                    </div>
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">No students in this list</h3>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-[#8E8E93]">
                                        Get started by adding students to this custom list.
                                    </p>
                                    <div className="mt-6">
                                        <button
                                            onClick={() => setIsAddingStudents(true)}
                                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Students
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-transparent">
                        <div className="w-16 h-16 bg-white dark:bg-[#1C1C1E] shadow-sm rounded-2xl flex items-center justify-center mb-6">
                            <FileSpreadsheet className="w-8 h-8 text-primary-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Custom Student Lists</h2>
                        <p className="text-gray-500 dark:text-[#8E8E93] max-w-md mb-8">
                            Select a list from the sidebar to view details, or create a new one to group students for activities, tours, or events.
                        </p>
                        <button
                            onClick={() => setIsCreatingList(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 dark:text-[#3EC4B1] bg-primary-100 dark:bg-[rgba(62,196,177,0.12)] hover:bg-primary-200 dark:hover:bg-[rgba(62,196,177,0.2)] shadow-sm"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create New List
                        </button>
                    </div>
                )}
            </div>

            <CreateStudentListModal
                isOpen={isCreatingList}
                onClose={() => setIsCreatingList(false)}
                onSuccess={(newList) => {
                    queryClient.invalidateQueries({ queryKey: ['student-lists'] });
                    setActiveListId(newList._id);
                }}
            />

            {activeListId && (
                <AddMoreStudentsModal
                    isOpen={isAddingStudents}
                    onClose={() => setIsAddingStudents(false)}
                    listId={activeListId}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['student-list', activeListId] });
                        queryClient.invalidateQueries({ queryKey: ['student-lists'] });
                    }}
                />
            )}
        </div>
    );
};

export default StudentLists;
