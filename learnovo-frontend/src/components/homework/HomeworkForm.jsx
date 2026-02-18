import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, Image as ImageIcon, File } from 'lucide-react';
import homeworkService from '../../services/homeworkService';
import { classesService } from '../../services/classesService';
import { subjectsService } from '../../services/subjectsService';
import toast from 'react-hot-toast';

const HomeworkForm = ({ homework, onClose, onSuccess }) => {
    const isEditing = !!homework;

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        subject: '',
        class: '',
        section: '',
        assignedDate: new Date().toISOString().split('T')[0],
        dueDate: ''
    });

    const [files, setFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [sections, setSections] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Derive unique grades from loaded classes
    const uniqueGrades = [...new Set(classes.map(cls => cls.grade).filter(Boolean))].sort();

    useEffect(() => {
        fetchOptions();
        if (homework) {
            setFormData({
                title: homework.title || '',
                description: homework.description || '',
                subject: homework.subject?._id || '',
                class: homework.class?._id || '',
                section: homework.section?._id || '',
                assignedDate: homework.assignedDate ? new Date(homework.assignedDate).toISOString().split('T')[0] : '',
                dueDate: homework.dueDate ? new Date(homework.dueDate).toISOString().split('T')[0] : ''
            });
            setExistingAttachments(homework.attachments || []);
            // Restore grade from existing homework class
            if (homework.class?.grade) setSelectedGrade(homework.class.grade);
        }
    }, [homework]);

    // When grade changes, collect all sections from all classes of that grade
    useEffect(() => {
        if (selectedGrade && classes.length > 0) {
            const classesForGrade = classes.filter(cls => cls.grade === selectedGrade);
            // Flatten all sections from all classes of this grade, attach classId to each
            const allSections = classesForGrade.flatMap(cls =>
                (cls.sections || []).map(sec => ({ ...sec, classId: cls._id }))
            );
            setSections(allSections);
            // Reset class and section when grade changes
            setFormData(prev => ({ ...prev, class: '', section: '' }));
        } else {
            setSections([]);
        }
    }, [selectedGrade, classes]);

    const fetchOptions = async () => {
        try {
            const [classesRes, subjectsRes] = await Promise.all([
                classesService.list(),
                subjectsService.list()
            ]);

            if (classesRes.success) setClasses(classesRes.data || []);
            if (subjectsRes.success) setSubjects(subjectsRes.data || []);
        } catch (error) {
            console.error('Error fetching options:', error);
        }
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);

        // Validate file types and sizes
        const validFiles = selectedFiles.filter(file => {
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title || !formData.description || !formData.subject || !selectedGrade || !formData.section || !formData.dueDate) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            setIsLoading(true);

            // Process new file uploads
            const newAttachments = await homeworkService.processFileUploads(files);

            // Combine existing and new attachments
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
            console.error('Error saving homework:', error);
            toast.error(error.message || 'Failed to save homework');
        } finally {
            setIsLoading(false);
        }
    };

    const isImage = (fileType) => {
        return fileType?.startsWith('image/');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {isEditing ? 'Edit Homework' : 'Create Homework'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Enter homework title"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Enter homework description and instructions"
                            required
                        />
                    </div>

                    {/* Subject, Grade, Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Subject <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Grade <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedGrade}
                                onChange={(e) => setSelectedGrade(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Section <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.section}
                                onChange={(e) => {
                                    const sectionId = e.target.value;
                                    // Find the section and its parent classId
                                    const sec = sections.find(s => s._id?.toString() === sectionId);
                                    setFormData(prev => ({
                                        ...prev,
                                        section: sectionId,
                                        class: sec?.classId?.toString() || prev.class
                                    }));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Assigned Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.assignedDate}
                                onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Due Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                min={formData.assignedDate}
                                required
                            />
                        </div>
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Attachments (Images & Files)
                        </label>

                        {/* Upload Button */}
                        <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-primary-500 transition-colors">
                            <Upload className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-600">Click to upload images or files</span>
                            <input
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                            Supported: JPG, PNG, GIF, PDF, DOC, DOCX (Max 5MB each)
                        </p>

                        {/* Existing Attachments */}
                        {existingAttachments.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">Existing Attachments:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {existingAttachments.map((attachment, index) => (
                                        <div key={index} className="relative group border border-gray-200 rounded-md p-2">
                                            {isImage(attachment.fileType) ? (
                                                <img
                                                    src={attachment.fileUrl}
                                                    alt={attachment.fileName}
                                                    className="w-full h-24 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-24 bg-gray-100 rounded">
                                                    <File className="h-8 w-8 text-gray-400" />
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-600 mt-1 truncate">{attachment.fileName}</p>
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
                                <p className="text-sm font-medium text-gray-700 mb-2">New Files:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {files.map((file, index) => (
                                        <div key={index} className="relative group border border-gray-200 rounded-md p-2">
                                            {file.type.startsWith('image/') ? (
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt={file.name}
                                                    className="w-full h-24 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-24 bg-gray-100 rounded">
                                                    <File className="h-8 w-8 text-gray-400" />
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-600 mt-1 truncate">{file.name}</p>
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
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-outline"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : isEditing ? 'Update Homework' : 'Create Homework'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HomeworkForm;
