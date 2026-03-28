import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, File, Image as ImageIcon, CheckCircle, Camera } from 'lucide-react';
import homeworkService from '../../services/homeworkService';
import { formatDateShort } from '../../utils/formatDate';
import toast from 'react-hot-toast';

const HomeworkSubmissionForm = ({ homework, onClose, onSuccess }) => {
    const [submissionText, setSubmissionText] = useState('');
    const [markedAsDone, setMarkedAsDone] = useState(false);
    const [files, setFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (homework.mySubmission) {
            setSubmissionText(homework.mySubmission.submissionText || '');
            setMarkedAsDone(homework.mySubmission.markedAsDone || false);
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

        if (!markedAsDone && !submissionText.trim() && files.length === 0 && existingAttachments.length === 0) {
            toast.error('Please mark as done, write an answer, or attach photos of your work');
            return;
        }

        try {
            setIsLoading(true);

            const newAttachments = await homeworkService.processFileUploads(files);
            const allAttachments = [...existingAttachments, ...newAttachments];

            await homeworkService.submitHomework(homework._id, {
                submissionText,
                attachments: allAttachments,
                markedAsDone
            });

            toast.success('Homework submitted successfully');
            onSuccess();
        } catch (error) {
            toast.error(error.message || 'Failed to submit homework');
        } finally {
            setIsLoading(false);
        }
    };

    const isImage = (fileType) => fileType?.startsWith('image/');

    const isEditing = homework.mySubmission && homework.mySubmission.status !== 'pending';

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg ring-1 ring-white dark:ring-[#1C1C1E] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-[#38383A] flex-shrink-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        {isEditing ? 'Edit Submission' : 'Submit Homework'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
                    {/* Homework Details (Read-only) */}
                    <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{homework.title}</h3>
                        <p className="text-gray-700 dark:text-[#8E8E93] text-sm mb-3">{homework.description}</p>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600 dark:text-[#8E8E93]">Subject</p>
                                <p className="font-medium text-gray-900 dark:text-white">{homework.subject?.name}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 dark:text-[#8E8E93]">Due Date</p>
                                <p className="font-medium text-gray-900 dark:text-white">{formatDateShort(homework.dueDate)}</p>
                            </div>
                        </div>

                        {/* Teacher's Attachments */}
                        {homework.attachments && homework.attachments.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Teacher's Attachments:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {homework.attachments.map((attachment, index) => (
                                        <div key={index} className="border border-gray-200 dark:border-[#38383A] rounded p-2">
                                            {isImage(attachment.fileType) ? (
                                                <img
                                                    src={attachment.fileUrl}
                                                    alt={attachment.fileName}
                                                    className="w-full h-20 object-cover rounded mb-1"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-20 bg-gray-100 dark:bg-[#2C2C2E] rounded mb-1">
                                                    <File className="h-6 w-6 text-gray-400 dark:text-[#636366]" />
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-600 dark:text-[#8E8E93] truncate">{attachment.fileName}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Submission Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Mark as Done */}
                        <label className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-[#2C2C2E] cursor-pointer">
                            <input
                                type="checkbox"
                                checked={markedAsDone}
                                onChange={(e) => setMarkedAsDone(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">Mark as Done</p>
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                                    I have completed this homework in my notebook
                                </p>
                            </div>
                        </label>

                        {/* Photo Upload - Prominent */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">
                                Upload Photos of Your Work
                            </label>

                            <label className="flex flex-col items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 dark:border-[#38383A] rounded-xl cursor-pointer hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
                                        <Camera className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">
                                            Take a photo or upload images
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-[#636366]">
                                            JPG, PNG, GIF, PDF, DOC (Max 5MB each)
                                        </p>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*,.pdf,.doc,.docx"
                                    capture="environment"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>

                            {/* Existing Attachments */}
                            {existingAttachments.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Uploaded Photos:</p>
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
                                    <p className="text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">New Photos:</p>
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

                        {/* Answer Text - Optional */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Additional Notes <span className="text-gray-400 font-normal">(Optional)</span>
                            </label>
                            <textarea
                                value={submissionText}
                                onChange={(e) => setSubmissionText(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                                placeholder="Add any notes or comments about your homework..."
                            />
                        </div>

                        {/* Previous Feedback */}
                        {homework.mySubmission?.teacherFeedback && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">Teacher Feedback:</p>
                                <p className="text-sm text-blue-800 dark:text-blue-400">{homework.mySubmission.teacherFeedback}</p>
                                {homework.mySubmission.grade != null && (
                                    <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">Grade: {homework.mySubmission.grade}</p>
                                )}
                            </div>
                        )}

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
                                {isLoading ? 'Submitting...' : isEditing ? 'Update Submission' : 'Submit Homework'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default HomeworkSubmissionForm;
