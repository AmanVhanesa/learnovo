import React, { useState, useEffect } from 'react';
import { Plus, Megaphone, Users, Calendar, AlertCircle, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import announcementsService from '../services/announcementsService';
import { useAuth } from '../contexts/AuthContext';

const Announcements = () => {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        targetAudience: ['all'],
        priority: 'medium',
        expiresAt: ''
    });

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const response = await announcementsService.getAnnouncements();
            setAnnouncements(response.data || []);
        } catch (error) {
            console.error('Error fetching announcements:', error);
            toast.error('Failed to load announcements');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (submitting) return; // Prevent double submission

        try {
            setSubmitting(true);
            const response = await announcementsService.createAnnouncement(formData);
            toast.success(response.message || 'Announcement created successfully');
            setShowCreateModal(false);
            setFormData({
                title: '',
                message: '',
                targetAudience: ['all'],
                priority: 'medium',
                expiresAt: ''
            });
            await fetchAnnouncements(); // Refresh the list
        } catch (error) {
            console.error('Error creating announcement:', error);
            toast.error(error.response?.data?.message || 'Failed to create announcement');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this announcement?')) {
            return;
        }

        try {
            // Optimistically update UI
            setAnnouncements(prev => prev.map(a =>
                a._id === id ? { ...a, _deleting: true } : a
            ));

            await announcementsService.deleteAnnouncement(id);
            toast.success('Announcement deleted successfully');

            // Remove from list
            setAnnouncements(prev => prev.filter(a => a._id !== id));
        } catch (error) {
            console.error('Error deleting announcement:', error);
            toast.error(error.response?.data?.message || 'Failed to delete announcement');

            // Revert optimistic update
            setAnnouncements(prev => prev.map(a =>
                a._id === id ? { ...a, _deleting: false } : a
            ));
        }
    };

    const handleAudienceChange = (audience) => {
        if (audience === 'all') {
            setFormData({ ...formData, targetAudience: ['all'] });
        } else {
            const currentAudience = formData.targetAudience.filter(a => a !== 'all');
            if (currentAudience.includes(audience)) {
                const newAudience = currentAudience.filter(a => a !== audience);
                setFormData({
                    ...formData,
                    targetAudience: newAudience.length > 0 ? newAudience : ['all']
                });
            } else {
                setFormData({ ...formData, targetAudience: [...currentAudience, audience] });
            }
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return 'text-red-600 bg-red-50';
            case 'medium': return 'text-yellow-600 bg-yellow-50';
            case 'low': return 'text-blue-600 bg-blue-50';
            default: return 'text-gray-600 bg-gray-50';
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
                    <p className="text-gray-600 mt-1">Broadcast messages to students, teachers, and parents</p>
                </div>
                {user?.role === 'admin' && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} />
                        Create Announcement
                    </button>
                )}
            </div>

            {/* Announcements List */}
            <div className="space-y-4">
                {announcements.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg shadow">
                        <Megaphone size={48} className="mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600">No announcements yet</p>
                        {user?.role === 'admin' && (
                            <p className="text-sm text-gray-500 mt-2">Create your first announcement to get started</p>
                        )}
                    </div>
                ) : (
                    announcements.map((announcement) => (
                        <div key={announcement._id} className="bg-white rounded-lg shadow p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(announcement.priority)}`}>
                                            {announcement.priority}
                                        </span>
                                    </div>
                                    <p className="text-gray-700 whitespace-pre-wrap">{announcement.message}</p>
                                </div>
                                {user?.role === 'admin' && (
                                    <button
                                        onClick={() => handleDelete(announcement._id)}
                                        disabled={announcement._deleting}
                                        className="text-red-600 hover:text-red-700 p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Delete announcement"
                                    >
                                        {announcement._deleting ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                        ) : (
                                            <Trash2 size={18} />
                                        )}
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm text-gray-600 border-t pt-4">
                                <div className="flex items-center gap-2">
                                    <Users size={16} />
                                    <span>
                                        {announcement.targetAudience.includes('all')
                                            ? 'All Users'
                                            : announcement.targetAudience.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')
                                        }
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} />
                                    <span>{formatDate(announcement.createdAt)}</span>
                                </div>
                                {announcement.notificationsSent > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Megaphone size={16} />
                                        <span>{announcement.notificationsSent} notifications sent</span>
                                    </div>
                                )}
                                {announcement.expiresAt && (
                                    <div className="flex items-center gap-2 text-orange-600">
                                        <AlertCircle size={16} />
                                        <span>Expires: {formatDate(announcement.expiresAt)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Announcement Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Announcement</h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                        maxLength={200}
                                    />
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Message *
                                    </label>
                                    <textarea
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows={5}
                                        required
                                        maxLength={2000}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{formData.message.length}/2000 characters</p>
                                </div>

                                {/* Target Audience */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Target Audience *
                                    </label>
                                    <div className="space-y-2">
                                        {['all', 'student', 'teacher', 'parent', 'admin'].map((audience) => (
                                            <label key={audience} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.targetAudience.includes(audience)}
                                                    onChange={() => handleAudienceChange(audience)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700 capitalize">{audience}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Priority */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Priority
                                    </label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>

                                {/* Expiration Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Expiration Date (Optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.expiresAt}
                                        onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                Creating...
                                            </>
                                        ) : (
                                            'Create & Send'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Announcements;
