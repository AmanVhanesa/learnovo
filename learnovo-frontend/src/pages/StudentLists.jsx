import React, { useState } from 'react';
import {
    Users, Plus, Trash2, FileSpreadsheet, Search
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { studentListService } from '../services/studentListService';
import CreateStudentListModal from '../components/students/CreateStudentListModal';
import AddMoreStudentsModal from '../components/students/AddMoreStudentsModal';
import ExportColumnPicker from '../components/ExportColumnPicker';
import { formatDate } from '../utils/formatDate';

const StudentLists = () => {
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

    const studentListExportColumns = [
        { key: 'sno', label: 'S.No', group: 'Basic', getValue: (_s, i) => (i ?? 0) + 1 },
        { key: 'admissionNumber', label: 'Admission No', group: 'Basic', getValue: s => s.admissionNumber || '-' },
        { key: 'name', label: 'Student Name', group: 'Basic', getValue: s => s.fullName || s.name || '-' },
        { key: 'class', label: 'Class', group: 'Basic', getValue: s => s.class || '-' },
        { key: 'section', label: 'Section', group: 'Basic', getValue: s => s.section || '-' },
        { key: 'rollNumber', label: 'Roll No', group: 'Basic', getValue: s => s.rollNumber || '-' },
        { key: 'phone', label: 'Phone', group: 'Contact', getValue: s => s.phone || '-' },
        { key: 'email', label: 'Email', group: 'Contact', getValue: s => s.email || '-' },
        { key: 'fatherName', label: 'Father Name', group: 'Contact', getValue: s => s.fatherName || '-' },
        { key: 'motherName', label: 'Mother Name', group: 'Contact', getValue: s => s.motherName || '-' },
        { key: 'address', label: 'Address', group: 'Contact', getValue: s => s.address || '-' },
        { key: 'gender', label: 'Gender', group: 'Personal', getValue: s => s.gender || '-' },
        { key: 'dateOfBirth', label: 'Date of Birth', group: 'Personal', getValue: s => s.dateOfBirth ? formatDate(s.dateOfBirth) : '-' },
        { key: 'bloodGroup', label: 'Blood Group', group: 'Personal', getValue: s => s.bloodGroup || '-' },
    ];

    // Wrap student rows with index for the S.No getter
    const studentsWithIndex = (activeListData?.students || []).map((s, i) => ({ ...s, __index: i }));
    const indexedColumns = studentListExportColumns.map(c =>
        c.key === 'sno' ? { ...c, getValue: s => (s.__index ?? 0) + 1 } : c
    );

    const studentListExportPresets = {
        basic: { label: 'Basic', fields: ['sno', 'admissionNumber', 'name', 'class', 'section', 'rollNumber'] },
        contact: { label: 'Contact', fields: ['admissionNumber', 'name', 'phone', 'fatherName', 'motherName', 'address'] },
        attendance: { label: 'Attendance Sheet', fields: ['sno', 'admissionNumber', 'name', 'class', 'section'] },
    };

    const filteredLists = lists.filter(list =>
        (list.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const [showSidebar, setShowSidebar] = useState(true);

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-theme(spacing.16))] bg-gray-50 dark:bg-[#000000] overflow-hidden rounded-2xl border border-gray-200 dark:border-[#38383A]">
            {/* Sidebar */}
            <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] flex-col shrink-0 rounded-t-2xl md:rounded-t-none md:rounded-l-2xl ${activeListId && activeListData ? 'max-h-48 md:max-h-full' : ''}`}>
                <div className="p-4 border-b border-gray-200 dark:border-[#38383A]">
                    <button
                        onClick={() => setIsCreatingList(true)}
                        className="btn btn-primary w-full"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New List
                    </button>

                    <div className="mt-4 relative">
                        <Search className="w-4 h-4 text-gray-400 dark:text-[#636366] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search lists..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-9"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoadingLists ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="loading-spinner"></div>
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
            <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 bg-gray-50/50 dark:bg-[#000000] relative rounded-b-2xl md:rounded-b-none md:rounded-r-2xl overflow-hidden`}>
                {activeListId && activeListData ? (
                    <>
                        {/* Header */}
                        <div className="bg-white dark:bg-[#1C1C1E] border-b border-gray-200 dark:border-[#38383A] px-4 sm:px-8 py-4 sm:py-6 shrink-0 z-10">
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
                                    <ExportColumnPicker
                                        data={studentsWithIndex}
                                        columns={indexedColumns}
                                        presets={studentListExportPresets}
                                        filename={activeListData.name || 'student_list'}
                                        title={`Export — ${activeListData.name}`}
                                        sheetName="Students"
                                        buttonClassName="btn btn-outline w-full sm:w-auto"
                                    />
                                    <button
                                        onClick={() => setIsAddingStudents(true)}
                                        className="btn btn-primary w-full sm:w-auto"
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Add Students
                                    </button>
                                    <button
                                        onClick={handleDeleteList}
                                        className="btn bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border-red-200 dark:border-red-500/20 w-full sm:w-auto"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete List
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content area: scrollable */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            {isLoadingDetail ? (
                                <div className="flex items-center justify-center p-12">
                                    <div className="loading-spinner"></div>
                                </div>
                            ) : activeListData.students.length > 0 ? (
                                <div className="card overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="table min-w-[500px]">
                                            <thead>
                                                <tr>
                                                    <th className="w-16">S.No</th>
                                                    <th>Admission No</th>
                                                    <th>Student Name</th>
                                                    <th>Class/Section</th>
                                                    <th>Phone</th>
                                                    <th className="w-24">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeListData.students.map((student, index) => (
                                                    <tr key={student._id}>
                                                        <td className="text-sm text-gray-500 dark:text-[#8E8E93]">
                                                            {index + 1}
                                                        </td>
                                                        <td>
                                                            <span className="font-mono text-sm font-semibold text-teal-600">
                                                                {student.admissionNumber || '-'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="flex items-center">
                                                                <div className="h-10 w-10 bg-gradient-to-br from-teal-400 to-teal-700 rounded-full flex items-center justify-center mr-3">
                                                                    <span className="text-sm font-semibold text-white">
                                                                        {(student.fullName || student.name) ? (student.fullName || student.name).charAt(0).toUpperCase() : '?'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {student.fullName || student.name || 'Unknown'}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="text-sm text-gray-900 dark:text-white">
                                                            {student.class || '-'} {student.section && `- ${student.section}`}
                                                        </td>
                                                        <td className="text-sm text-gray-900 dark:text-white">
                                                            {student.phone || '-'}
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={() => handleRemoveStudent(student._id)}
                                                                className="btn-icon hover:text-red-600"
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
                                <div className="card">
                                    <div className="text-center py-12">
                                        <div className="flex flex-col items-center">
                                            <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mb-3">
                                                <Users className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">No students in this list</p>
                                            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Get started by adding students to this custom list.</p>
                                            <button
                                                onClick={() => setIsAddingStudents(true)}
                                                className="btn btn-primary mt-4"
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add Students
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-transparent">
                        <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mb-4">
                            <FileSpreadsheet className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Custom Student Lists</p>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1 max-w-md">
                            Select a list from the sidebar to view details, or create a new one to group students for activities, tours, or events.
                        </p>
                        <button
                            onClick={() => setIsCreatingList(true)}
                            className="btn btn-primary mt-4"
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
