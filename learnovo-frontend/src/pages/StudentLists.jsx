import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Trash2, FileText, FileSpreadsheet, Download, Search, AlertCircle, FileAudio
} from 'lucide-react';
import toast from 'react-hot-toast';
import { studentListService } from '../services/studentListService';
import CreateStudentListModal from '../components/students/CreateStudentListModal';
import AddMoreStudentsModal from '../components/students/AddMoreStudentsModal';
import api from '../services/authService';

const StudentLists = () => {
    const [lists, setLists] = useState([]);
    const [activeListId, setActiveListId] = useState(null);
    const [activeListData, setActiveListData] = useState(null);
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [isAddingStudents, setIsAddingStudents] = useState(false);
    const [isLoadingLists, setIsLoadingLists] = useState(true);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchLists = async () => {
        try {
            setIsLoadingLists(true);
            const res = await studentListService.getAll();
            if (res.success) {
                setLists(res.data);
            }
        } catch (error) {
            console.error('Error fetching lists:', error);
            toast.error('Failed to load student lists');
        } finally {
            setIsLoadingLists(false);
        }
    };

    const fetchListDetails = async (id) => {
        try {
            setIsLoadingDetail(true);
            const res = await studentListService.getById(id);
            if (res.success) {
                setActiveListData(res.data);
            }
        } catch (error) {
            console.error('Error fetching list details:', error);
            toast.error('Failed to load list details');
        } finally {
            setIsLoadingDetail(false);
        }
    };

    useEffect(() => {
        fetchLists();
    }, []);

    useEffect(() => {
        if (activeListId) {
            fetchListDetails(activeListId);
        } else {
            setActiveListData(null);
        }
    }, [activeListId]);

    const handleDeleteList = async () => {
        if (!window.confirm('Are you sure you want to delete this list?')) return;
        try {
            const res = await studentListService.delete(activeListId);
            if (res.success) {
                toast.success('List deleted successfully');
                setActiveListId(null);
                fetchLists();
            }
        } catch (error) {
            toast.error('Failed to delete list');
        }
    };

    const handleRemoveStudent = async (studentId) => {
        if (!window.confirm('Remove this student from the list?')) return;
        try {
            const res = await studentListService.removeStudent(activeListId, studentId);
            if (res.success) {
                toast.success('Student removed');
                fetchListDetails(activeListId);
                fetchLists(); // Update counts in sidebar
            }
        } catch (error) {
            toast.error('Failed to remove student');
        }
    };

    const handleExport = (format) => {
        // Generate the full URL for export with token in query for auth
        const token = localStorage.getItem('token');
        const baseUrl = api.defaults.baseURL || '/api';
        const exportUrl = `${baseUrl}/student-lists/${activeListId}/export/${format}?token=${token}`;
        window.open(exportUrl, '_blank');
    };

    const filteredLists = lists.filter(list =>
        list.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-theme(spacing.16))] bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-200">
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
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                                onClick={() => setActiveListId(list._id)}
                                className={`w-full text-left p-3 rounded-xl transition-all ${activeListId === list._id
                                    ? 'bg-primary-50 border-primary-200 shadow-sm ring-1 ring-primary-500'
                                    : 'bg-white border-gray-100 hover:bg-gray-50 border shadow-sm'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`font-medium text-sm truncate pr-2 ${activeListId === list._id ? 'text-primary-900' : 'text-gray-900'}`}>
                                        {list.name}
                                    </h4>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${activeListId === list._id ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {list.studentCount || 0}
                                    </span>
                                </div>
                                {list.description && (
                                    <p className="text-xs text-gray-500 line-clamp-1">{list.description}</p>
                                )}
                                <p className="text-[10px] text-gray-400 mt-2">
                                    Created {new Date(list.createdAt).toLocaleDateString()}
                                </p>
                            </button>
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">No lists found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50 relative">
                {activeListId && activeListData ? (
                    <>
                        {/* Header */}
                        <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0 z-10">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{activeListData.name}</h2>
                                    {activeListData.description && (
                                        <p className="mt-1 text-sm text-gray-500">{activeListData.description}</p>
                                    )}
                                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-md">
                                            <Users className="w-4 h-4 text-gray-400" />
                                            <span className="font-medium text-gray-900">{activeListData.students.length}</span> students
                                        </span>
                                        <span>Created: {new Date(activeListData.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleExport('pdf')}
                                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <FileText className="w-4 h-4 text-red-500" /> PDF
                                        </button>
                                        <button
                                            onClick={() => handleExport('excel')}
                                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
                                        </button>
                                        <button
                                            onClick={() => handleExport('csv')}
                                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <Download className="w-4 h-4 text-blue-500" /> CSV
                                        </button>
                                        <button
                                            onClick={() => handleExport('txt')}
                                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <FileText className="w-4 h-4 text-gray-500" /> TXT
                                        </button>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => setIsAddingStudents(true)}
                                            className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 flex items-center gap-2 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" /> Add Students
                                        </button>
                                        <button
                                            onClick={handleDeleteList}
                                            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 flex items-center gap-2 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" /> Delete List
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content area: scrollable */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {isLoadingDetail ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : activeListData.students.length > 0 ? (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                                                        S.No
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Admission No
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Student Name
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Class/Section
                                                    </th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Phone
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                                        Action
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {activeListData.students.map((student, index) => (
                                                    <tr key={student._id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {index + 1}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-l border-transparent">
                                                            {student.admissionNumber || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs mr-3">
                                                                    {(student.fullName || student.name) ? (student.fullName || student.name).charAt(0).toUpperCase() : '?'}
                                                                </div>
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {student.fullName || student.name || 'Unknown'}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                                                                {student.class || '-'} {student.section && `- ${student.section}`}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {student.phone || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                            <button
                                                                onClick={() => handleRemoveStudent(student._id)}
                                                                className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
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
                                <div className="text-center bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                                    <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                        <Users className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <h3 className="text-sm font-medium text-gray-900">No students in this list</h3>
                                    <p className="mt-1 text-sm text-gray-500">
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
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
                        <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-6">
                            <FileSpreadsheet className="w-8 h-8 text-primary-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Custom Student Lists</h2>
                        <p className="text-gray-500 max-w-md mb-8">
                            Select a list from the sidebar to view details, or create a new one to group students for activities, tours, or events.
                        </p>
                        <button
                            onClick={() => setIsCreatingList(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 shadow-sm"
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
                    fetchLists();
                    setActiveListId(newList._id);
                }}
            />

            {activeListId && (
                <AddMoreStudentsModal
                    isOpen={isAddingStudents}
                    onClose={() => setIsAddingStudents(false)}
                    listId={activeListId}
                    onSuccess={() => {
                        fetchListDetails(activeListId);
                        fetchLists(); // Ensure counts update in the sidebar
                    }}
                />
            )}
        </div>
    );
};

export default StudentLists;
