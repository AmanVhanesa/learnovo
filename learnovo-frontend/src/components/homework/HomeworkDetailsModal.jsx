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
            console.error('Error fetching submissions:', error);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-gray-900">Homework Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Homework Info */}
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{homework.title}</h3>
                        <p className="text-gray-700 mb-4">{homework.description}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600">Subject</p>
                                <p className="font-medium">{homework.subject?.name}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Class</p>
                                <p className="font-medium">{homework.class?.name} {homework.section?.name && `- ${homework.section.name}`}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Assigned</p>
                                <p className="font-medium">{formatDate(homework.assignedDate)}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Due Date</p>
                                <p className="font-medium">{formatDate(homework.dueDate)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Attachments */}
                    {homework.attachments && homework.attachments.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Attachments</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {homework.attachments.map((attachment, index) => (
                                    <div key={index} className="border border-gray-200 rounded-md p-2">
                                        {isImage(attachment.fileType) ? (
                                            <img
                                                src={attachment.fileUrl}
                                                alt={attachment.fileName}
                                                className="w-full h-32 object-cover rounded mb-2"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-32 bg-gray-100 rounded mb-2">
                                                <File className="h-12 w-12 text-gray-400" />
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-600 truncate">{attachment.fileName}</p>
                                        <a
                                            href={attachment.fileUrl}
                                            download={attachment.fileName}
                                            className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1"
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
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 mb-3">My Submission</h4>
                            <p className="text-gray-700 mb-2">{homework.mySubmission.submissionText}</p>
                            {homework.mySubmission.teacherFeedback && (
                                <div className="mt-4 p-3 bg-blue-50 rounded">
                                    <p className="text-sm font-medium text-blue-900">Teacher Feedback:</p>
                                    <p className="text-sm text-blue-800">{homework.mySubmission.teacherFeedback}</p>
                                    {homework.mySubmission.grade && (
                                        <p className="text-sm text-blue-800 mt-1">Grade: {homework.mySubmission.grade}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submissions List (for teachers) */}
                    {isTeacher && (
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-3">
                                Submissions ({submissions.length})
                            </h4>
                            {isLoading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                                </div>
                            ) : submissions.length === 0 ? (
                                <p className="text-gray-600 text-center py-8">No submissions yet</p>
                            ) : (
                                <div className="space-y-4">
                                    {submissions.map((submission) => (
                                        <div key={submission._id} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-medium text-gray-900">{submission.studentId?.name}</p>
                                                    <p className="text-sm text-gray-600">{submission.studentId?.admissionNumber}</p>
                                                </div>
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${submission.status === 'reviewed' ? 'bg-green-100 text-green-800' :
                                                        submission.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {submission.status}
                                                </span>
                                            </div>

                                            {submission.submissionText && (
                                                <p className="text-gray-700 text-sm mb-2">{submission.submissionText}</p>
                                            )}

                                            {submission.submittedAt && (
                                                <p className="text-xs text-gray-500">Submitted: {formatDate(submission.submittedAt)}</p>
                                            )}

                                            {/* Feedback Form */}
                                            {feedbackForm.submissionId === submission._id ? (
                                                <div className="mt-3 p-3 bg-gray-50 rounded">
                                                    <textarea
                                                        value={feedbackForm.feedback}
                                                        onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                                                        placeholder="Enter feedback..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                                                        rows={3}
                                                    />
                                                    <input
                                                        type="number"
                                                        value={feedbackForm.grade}
                                                        onChange={(e) => setFeedbackForm({ ...feedbackForm, grade: e.target.value })}
                                                        placeholder="Grade (optional)"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
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
                                                        <div className="mt-3 p-3 bg-blue-50 rounded">
                                                            <p className="text-sm font-medium text-blue-900">Feedback:</p>
                                                            <p className="text-sm text-blue-800">{submission.teacherFeedback}</p>
                                                            {submission.grade && <p className="text-sm text-blue-800 mt-1">Grade: {submission.grade}</p>}
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
                <div className="flex justify-end p-6 border-t border-gray-200">
                    <button onClick={onClose} className="btn btn-outline">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HomeworkDetailsModal;
