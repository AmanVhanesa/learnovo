import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, File, Image as ImageIcon } from 'lucide-react';
import homeworkService from '../../services/homeworkService';
import toast from 'react-hot-toast';

const HomeworkSubmissionForm = ({ homework, onClose, onSuccess }) => {
    const [submissionText, setSubmissionText] = useState('');
    const [files, setFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (homework.mySubmission) {
            setSubmissionText(homework.mySubmission.submissionText || '');
            setExistingAttachments(homework.mySubmission.attachments || []);
        }
    }, [homework]);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);

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

        if (!submissionText.trim() && files.length === 0 && existingAttachments.length === 0) {
            toast.error('Please provide an answer or attach files');
            return;
        }

        try {
            setIsLoading(true);

            const newAttachments = await homeworkService.processFileUploads(files);
            const allAttachments = [...existingAttachments, ...newAttachments];

            await homeworkService.submitHomework(homework._id, {
                submissionText,
                attachments: allAttachments
            });

            toast.success('Homework submitted successfully');
            onSuccess();
        } catch (error) {
            console.error('Error submitting homework:', error);
            toast.error(error.message || 'Failed to submit homework');
        } finally {
            setIsLoading(false);
        }
    };

    const isImage = (fileType) => fileType?.startsWith('image/');

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-gray-900">Submit Homework</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Homework Details (Read-only) */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">{homework.title}</h3>
                        <p className="text-gray-700 text-sm mb-3">{homework.description}</p>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600">Subject</p>
                                <p className="font-medium">{homework.subject?.name}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Due Date</p>
                                <p className="font-medium">{formatDate(homework.dueDate)}</p>
                            </div>
                        </div>

                        {/* Teacher's Attachments */}
                        {homework.attachments && homework.attachments.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">Teacher's Attachments:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {homework.attachments.map((attachment, index) => (
                                        <div key={index} className="border border-gray-200 rounded p-2">
                                            {isImage(attachment.fileType) ? (
                                                <img
                                                    src={attachment.fileUrl}
                                                    alt={attachment.fileName}
                                                    className="w-full h-20 object-cover rounded mb-1"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-20 bg-gray-100 rounded mb-1">
                                                    <File className="h-6 w-6 text-gray-400" />
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-600 truncate">{attachment.fileName}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Submission Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Answer Text */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Your Answer
                            </label>
                            <textarea
                                value={submissionText}
                                onChange={(e) => setSubmissionText(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Write your answer here..."
                            />
                        </div>

                        {/* File Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Attach Files (Optional)
                            </label>

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

                        {/* Previous Feedback */}
                        {homework.mySubmission?.teacherFeedback && (
                            <div className="p-4 bg-blue-50 rounded-lg">
                                <p className="text-sm font-medium text-blue-900 mb-1">Previous Feedback:</p>
                                <p className="text-sm text-blue-800">{homework.mySubmission.teacherFeedback}</p>
                                {homework.mySubmission.grade && (
                                    <p className="text-sm text-blue-800 mt-1">Grade: {homework.mySubmission.grade}</p>
                                )}
                            </div>
                        )}

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
                                {isLoading ? 'Submitting...' : homework.mySubmission ? 'Update Submission' : 'Submit Homework'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default HomeworkSubmissionForm;
