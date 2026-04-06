import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Trash2, Image as ImageIcon, File } from 'lucide-react';
import homeworkService from '../../services/homeworkService';
import { classesService } from '../../services/classesService';
import { subjectsService } from '../../services/subjectsService';
import { attendanceService } from '../../services/attendanceService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { sortClassObjects, getClassOrder } from '../../utils/classOrder';

const HomeworkForm = ({ homework, onClose, onSuccess }) => {
    const { user } = useAuth();
    const isEditing = !!homework;

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        subject: '',
        class: '',       // stores the Class document _id
        section: '',     // stores the Section document _id
        assignedDate: new Date().toISOString().split('T')[0],
        dueDate: ''
    });

    const [files, setFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [classes, setClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [sections, setSections] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Track whether we are in the middle of restoring an existing homework
    const restoringRef = useRef(false);

    // Derive unique grades from loaded classes, sorted in educational hierarchy
    const uniqueGrades = [...new Set(classes.map(cls => cls.grade).filter(Boolean))]
        .sort((a, b) => getClassOrder(a) - getClassOrder(b));

    // Initial load
    useEffect(() => {
        fetchOptions();
    }, []);

    // When editing, restore form once classes are loaded
    useEffect(() => {
        if (isEditing && homework && classes.length > 0 && !restoringRef.current) {
            restoringRef.current = true;
            restoreEditingState();
        }
    }, [isEditing, homework, classes]);

    const restoreEditingState = () => {
        // Find the class document that matches homework.class._id
        const hwClassId = homework.class?._id || homework.class;
        const classDoc = classes.find(c => c._id?.toString() === hwClassId?.toString());

        if (classDoc) {
            // Get all sections for this grade
            const grade = classDoc.grade;
            const gradeClasses = classes.filter(c => c.grade === grade);
            const gradeSections = gradeClasses.flatMap(c =>
                (c.sections || []).map(sec => ({ ...sec, classId: c._id }))
            );
            setSections(gradeSections);
            setSelectedGrade(grade);
        }

        setFormData({
            title: homework.title || '',
            description: homework.description || '',
            subject: homework.subject?._id || homework.subject || '',
            class: homework.class?._id || homework.class || '',
            section: homework.section?._id || homework.section || '',
            assignedDate: homework.assignedDate
                ? new Date(homework.assignedDate).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0],
            dueDate: homework.dueDate
                ? new Date(homework.dueDate).toISOString().split('T')[0]
                : ''
        });

        setExistingAttachments(homework.attachments || []);
    };

    // When grade changes (by user action), update sections list
    useEffect(() => {
        if (!selectedGrade || classes.length === 0) {
            setSections([]);
            return;
        }

        const gradeClasses = classes.filter(c => c.grade === selectedGrade);
        const gradeSections = gradeClasses.flatMap(c =>
            (c.sections || []).map(sec => ({ ...sec, classId: c._id }))
        );
        setSections(gradeSections);

        if (!restoringRef.current) {
            // User manually changed the grade — reset class, section and subject
            setFormData(prev => ({ ...prev, class: '', section: '', subject: '' }));
        }
        // After first restore, allow subsequent user-driven grade changes to reset
        restoringRef.current = false;
    }, [selectedGrade, classes]);

    // Derive subjects for the selected grade's class
    const subjects = (() => {
        if (!selectedGrade || classes.length === 0) return allSubjects;
        const gradeClasses = classes.filter(c => c.grade === selectedGrade);
        // Collect subjects from class data (deduplicated)
        const subjectMap = new Map();
        gradeClasses.forEach(cls => {
            (cls.subjects || []).forEach(s => {
                if (s._id && s.name) subjectMap.set(s._id.toString(), s);
            });
        });
        if (subjectMap.size > 0) return Array.from(subjectMap.values());
        // Fallback to all subjects if class has no subjects configured
        return allSubjects;
    })();

    const fetchOptions = async () => {
        try {
            if (user?.role === 'teacher') {
                const [classesRes, subjectsRes] = await Promise.all([
                    attendanceService.getTeacherClasses(),
                    subjectsService.list()
                ]);
                setClasses(sortClassObjects(classesRes?.data || [], 'name'));
                setAllSubjects(subjectsRes.success ? (subjectsRes.data || []) : []);
            } else {
                const [classesRes, subjectsRes] = await Promise.all([
                    classesService.list(),
                    subjectsService.list()
                ]);
                if (classesRes.success) setClasses(sortClassObjects(classesRes.data || [], 'name'));
                if (subjectsRes.success) setAllSubjects(subjectsRes.data || []);
            }
        } catch (error) {
            toast.error('Failed to load class/subject options');
        }
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);

        const validFiles = selectedFiles.filter(file => {
            const validTypes = [
                'image/jpeg', 'image/png', 'image/gif',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (!validTypes.includes(file.type)) {
                toast.error(`${file.name}: Invalid file type`);
                return false;
            }
            if (file.size > maxSize) {
                toast.error(`${file.name}: File too large (max 5MB)`);
                return false;
            }
            return true;
        });

        setFiles([...files, ...validFiles]);
    };

    const removeFile = (index) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const removeExistingAttachment = (index) => {
        setExistingAttachments(existingAttachments.filter((_, i) => i !== index));
    };

    const handleSectionChange = (sectionId) => {
        const sec = sections.find(s => s._id?.toString() === sectionId);
        setFormData(prev => ({
            ...prev,
            section: sectionId,
            class: sec?.classId?.toString() || prev.class
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title || !formData.description || !formData.subject || !selectedGrade || !formData.section || !formData.dueDate) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (!formData.class) {
            toast.error('Could not determine class. Please re-select the section.');
            return;
        }

        try {
            setIsLoading(true);

            const newAttachments = await homeworkService.processFileUploads(files);
            const allAttachments = [...existingAttachments, ...newAttachments];

            const homeworkData = {
                ...formData,
                attachments: allAttachments
            };

            if (isEditing) {
                await homeworkService.updateHomework(homework._id, homeworkData);
                toast.success('Homework updated successfully');
            } else {
                await homeworkService.createHomework(homeworkData);
                toast.success('Homework created successfully');
            }

            onSuccess();
        } catch (error) {
            toast.error(error.message || 'Failed to save homework');
        } finally {
            setIsLoading(false);
        }
    };

    const isImage = (fileType) => fileType?.startsWith('image/');

    return createPortal(
        <div className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg ring-1 ring-white dark:ring-[#1C1C1E] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-[#38383A] flex-shrink-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        {isEditing ? 'Edit Homework' : 'Create Homework'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                            placeholder="Enter homework title"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                            placeholder="Enter homework description and instructions"
                            required
                        />
                    </div>

                    {/* Grade, Section, Subject */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Grade */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Grade <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedGrade}
                                onChange={(e) => {
                                    restoringRef.current = false; // user changed grade manually
                                    setSelectedGrade(e.target.value);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                                required
                            >
                                <option value="">Select Grade</option>
                                {uniqueGrades.map((grade) => (
                                    <option key={grade} value={grade}>
                                        {grade}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Section */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Section <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.section}
                                onChange={(e) => handleSectionChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                                disabled={!selectedGrade}
                                required
                            >
                                <option value="">Select Section</option>
                                {sections.map((section) => (
                                    <option key={section._id} value={section._id}>
                                        {section.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Subject — shown after grade is selected */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Subject <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                                disabled={!selectedGrade}
                                required
                            >
                                <option value="">Select Subject</option>
                                {subjects.map((subject) => (
                                    <option key={subject._id} value={subject._id}>
                                        {subject.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Assigned Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.assignedDate}
                                onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Due Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                                min={formData.assignedDate || new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">
                            Attachments (Images & Files)
                        </label>

                        <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-[#38383A] rounded-md cursor-pointer hover:border-primary-500 transition-colors">
                            <Upload className="h-5 w-5 text-gray-400 dark:text-[#636366] mr-2" />
                            <span className="text-sm text-gray-600 dark:text-[#8E8E93]">Click to upload images or files</span>
                            <input
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </label>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                            Supported: JPG, PNG, GIF, PDF, DOC, DOCX (Max 5MB each)
                        </p>

                        {/* Existing Attachments */}
                        {existingAttachments.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Existing Attachments:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {existingAttachments.map((attachment, index) => (
                                        <div key={index} className="relative group border border-gray-200 dark:border-[#38383A] rounded-md p-2">
                                            {isImage(attachment.fileType) ? (
                                                <img
                                                    src={attachment.fileUrl}
                                                    alt={attachment.fileName}
                                                    className="w-full h-24 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-24 bg-gray-100 dark:bg-[#2C2C2E] rounded">
                                                    <File className="h-8 w-8 text-gray-400 dark:text-[#636366]" />
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-600 dark:text-[#8E8E93] mt-1 truncate">{attachment.fileName}</p>
                                            <button
                                                type="button"
                                                onClick={() => removeExistingAttachment(index)}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* New Files Preview */}
                        {files.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">New Files:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {files.map((file, index) => (
                                        <div key={index} className="relative group border border-gray-200 dark:border-[#38383A] rounded-md p-2">
                                            {file.type.startsWith('image/') ? (
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt={file.name}
                                                    className="w-full h-24 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-24 bg-gray-100 dark:bg-[#2C2C2E] rounded">
                                                    <File className="h-8 w-8 text-gray-400 dark:text-[#636366]" />
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-600 dark:text-[#8E8E93] mt-1 truncate">{file.name}</p>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-[#38383A]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-outline w-full sm:w-auto"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary w-full sm:w-auto"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : isEditing ? 'Update Homework' : 'Create Homework'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default HomeworkForm;
