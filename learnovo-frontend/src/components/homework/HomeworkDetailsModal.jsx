import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, BookOpen, User, Download, File, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import homeworkService from '../../services/homeworkService';
import toast from 'react-hot-toast';

const HomeworkDetailsModal = ({ homework, onClose, onRefresh }) => {
    const { user } = useAuth();
    const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
    const [submissions, setSubmissions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState({ submissionId: null, feedback: '', grade: '' });

    useEffect(() => {
        if (isTeacher) {
            fetchSubmissions();
        }
    }, [homework._id]);

    const fetchSubmissions = async () => {
        try {
            setIsLoading(true);
            const response = await homeworkService.getSubmissions(homework._id);
            if (response.success) {
                setSubmissions(response.data || []);
            }
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitFeedback = async (submissionId) => {
        try {
            await homeworkService.updateSubmissionFeedback(submissionId, {
                feedback: feedbackForm.feedback,
                grade: feedbackForm.grade ? parseFloat(feedbackForm.grade) : undefined
            });
            toast.success('Feedback submitted successfully');
            setFeedbackForm({ submissionId: null, feedback: '', grade: '' });
            fetchSubmissions();
            onRefresh();
        } catch (error) {
            toast.error('Failed to submit feedback');
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isImage = (fileType) => fileType?.startsWith('image/');

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-[#38383A] sticky top-0 bg-white dark:bg-[#1C1C1E] z-10">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Homework Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 space-y-6">
                    {/* Homework Info */}
                    <div>
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">{homework.title}</h3>
                        <p className="text-gray-700 dark:text-[#8E8E93] mb-4">{homework.description}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600 dark:text-[#8E8E93]">Subject</p>
                                <p className="font-medium text-gray-900 dark:text-white">{homework.subject?.name}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 dark:text-[#8E8E93]">Class</p>
                                <p className="font-medium text-gray-900 dark:text-white">{homework.class?.name} {homework.section?.name && `- ${homework.section.name}`}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 dark:text-[#8E8E93]">Assigned</p>
                                <p className="font-medium text-gray-900 dark:text-white">{formatDate(homework.assignedDate)}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 dark:text-[#8E8E93]">Due Date</p>
                                <p className="font-medium text-gray-900 dark:text-white">{formatDate(homework.dueDate)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Attachments */}
                    {homework.attachments && homework.attachments.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Attachments</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {homework.attachments.map((attachment, index) => (
                                    <div key={index} className="border border-gray-200 dark:border-[#38383A] rounded-md p-2">
                                        {isImage(attachment.fileType) ? (
                                            <img
                                                src={attachment.fileUrl}
                                                alt={attachment.fileName}
                                                className="w-full h-32 object-cover rounded mb-2"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-[#2C2C2E] rounded mb-2">
                                                <File className="h-12 w-12 text-gray-400 dark:text-[#636366]" />
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-600 dark:text-[#8E8E93] truncate">{attachment.fileName}</p>
                                        <a
                                            href={attachment.fileUrl}
                                            download={attachment.fileName}
                                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 mt-1"
                                        >
                                            <Download className="h-3 w-3" />
                                            Download
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Student Submission (for students) */}
                    {!isTeacher && homework.mySubmission && (
                        <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">My Submission</h4>
                            <p className="text-gray-700 dark:text-[#8E8E93] mb-2">{homework.mySubmission.submissionText}</p>
                            {homework.mySubmission.teacherFeedback && (
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded">
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Teacher Feedback:</p>
                                    <p className="text-sm text-blue-800 dark:text-blue-400">{homework.mySubmission.teacherFeedback}</p>
                                    {homework.mySubmission.grade != null && (
                                        <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">Grade: {homework.mySubmission.grade}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submissions List (for teachers) */}
                    {isTeacher && (
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                                Submissions ({submissions.length})
                            </h4>
                            {isLoading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                                </div>
                            ) : submissions.length === 0 ? (
                                <p className="text-gray-600 dark:text-[#8E8E93] text-center py-8">No submissions yet</p>
                            ) : (
                                <div className="space-y-4">
                                    {submissions.map((submission) => (
                                        <div key={submission._id} className="border border-gray-200 dark:border-[#38383A] rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{submission.studentId?.name}</p>
                                                    <p className="text-sm text-gray-600 dark:text-[#8E8E93]">{submission.studentId?.admissionNumber}</p>
                                                </div>
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${submission.status === 'reviewed' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400' :
                                                        submission.status === 'submitted' ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400' :
                                                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400'
                                                    }`}>
                                                    {submission.status}
                                                </span>
                                            </div>

                                            {submission.submissionText && (
                                                <p className="text-gray-700 dark:text-[#8E8E93] text-sm mb-2">{submission.submissionText}</p>
                                            )}

                                            {/* Submission attachments */}
                                            {submission.attachments && submission.attachments.length > 0 && (
                                                <div className="mb-2">
                                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-1">Attachments:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {submission.attachments.map((att, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={att.fileUrl}
                                                                download={att.fileName}
                                                                className="text-xs px-2 py-1 bg-gray-100 dark:bg-[#1C1C1E] text-primary-600 dark:text-primary-400 rounded hover:underline flex items-center gap-1"
                                                            >
                                                                <File className="h-3 w-3" />
                                                                {att.fileName}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {submission.submittedAt && (
                                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Submitted: {formatDate(submission.submittedAt)}</p>
                                            )}

                                            {/* Feedback Form */}
                                            {feedbackForm.submissionId === submission._id ? (
                                                <div className="mt-3 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded">
                                                    <textarea
                                                        value={feedbackForm.feedback}
                                                        onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                                                        placeholder="Enter feedback..."
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md mb-2 dark:bg-[#1C1C1E] dark:text-white"
                                                        rows={3}
                                                    />
                                                    <input
                                                        type="number"
                                                        value={feedbackForm.grade}
                                                        onChange={(e) => setFeedbackForm({ ...feedbackForm, grade: e.target.value })}
                                                        placeholder="Grade (optional, 0-100)"
                                                        min="0"
                                                        max="100"
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md mb-2 dark:bg-[#1C1C1E] dark:text-white"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleSubmitFeedback(submission._id)}
                                                            className="btn btn-sm btn-primary"
                                                        >
                                                            Submit Feedback
                                                        </button>
                                                        <button
                                                            onClick={() => setFeedbackForm({ submissionId: null, feedback: '', grade: '' })}
                                                            className="btn btn-sm btn-outline"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {submission.teacherFeedback ? (
                                                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-500/10 rounded">
                                                            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Feedback:</p>
                                                            <p className="text-sm text-blue-800 dark:text-blue-400">{submission.teacherFeedback}</p>
                                                            {submission.grade != null && <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">Grade: {submission.grade}</p>}
                                                            <button
                                                                onClick={() => setFeedbackForm({ submissionId: submission._id, feedback: submission.teacherFeedback || '', grade: submission.grade != null ? String(submission.grade) : '' })}
                                                                className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                                            >
                                                                Edit Feedback
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setFeedbackForm({ submissionId: submission._id, feedback: '', grade: '' })}
                                                            className="mt-3 btn btn-sm btn-outline"
                                                        >
                                                            Add Feedback
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end p-4 sm:p-6 border-t border-gray-200 dark:border-[#38383A]">
                    <button onClick={onClose} className="btn btn-outline">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HomeworkDetailsModal;
