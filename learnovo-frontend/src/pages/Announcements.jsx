import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Megaphone, Users, Calendar, AlertCircle, Trash2, X, Clock, Search, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import announcementsService from '../services/announcementsService';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import DatePicker from '../components/ui/DatePicker';
import TimePicker from '../components/ui/TimePicker';

const Announcements = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { refresh: refreshNotifications } = useNotifications();
    const queryClient = useQueryClient();
    const isAdmin = user?.role === 'admin';
    const [deletingId, setDeletingId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        targetAudience: ['all'],
        priority: 'medium',
        expiresDate: '',
        expiresTime: ''
    });

    const { data: announcements = [], isLoading: loading } = useQuery({
        queryKey: ['announcements'],
        queryFn: async () => {
            const response = await announcementsService.getAnnouncements();
            return response.data || [];
        },
    });

    const filteredAnnouncements = useMemo(() => {
        if (!searchText.trim()) return announcements;
        const q = searchText.toLowerCase().trim();
        return announcements.filter(
            (a) => a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q)
        );
    }, [announcements, searchText]);

    const toggleExpanded = (id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const createMutation = useMutation({
        mutationFn: (payload) => announcementsService.createAnnouncement(payload),
        onSuccess: (response) => {
            toast.success(response.message || 'Announcement created & notifications sending');
            setShowCreateModal(false);
            setFormData({ title: '', message: '', targetAudience: ['all'], priority: 'medium', expiresDate: '', expiresTime: '' });
            queryClient.invalidateQueries({ queryKey: ['announcements'] });
            // Trigger immediate notification refresh so bell updates for all users on next poll
            setTimeout(() => refreshNotifications(), 1500);
        },
        onError: (error) => {
            // The backend may have saved the announcement but failed during notification broadcast.
            // Always refresh to show the actual state.
            queryClient.invalidateQueries({ queryKey: ['announcements'] });

            // Determine the error message
            let msg = 'Failed to create announcement';
            if (error.response?.data?.message) {
                msg = error.response.data.message;
            } else if (error.response?.data?.errors?.length) {
                msg = error.response.data.errors.map(e => e.msg || e.message).join(', ');
            } else if (error.message) {
                msg = error.message;
            }

            // If it was a server error (500) but the announcement was actually saved,
            // show a warning instead of an error
            if (error.response?.status === 500) {
                setShowCreateModal(false);
                setFormData({ title: '', message: '', targetAudience: ['all'], priority: 'medium', expiresDate: '', expiresTime: '' });
                toast.success('Announcement created (notifications may be delayed)');
            } else {
                toast.error(msg);
            }
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (createMutation.isPending) return;

        // Combine date + time into expiresAt, or omit if no date selected
        const { expiresDate, expiresTime, ...rest } = formData;
        const payload = { ...rest };
        if (expiresDate) {
            payload.expiresAt = expiresTime ? `${expiresDate}T${expiresTime}` : `${expiresDate}T23:59`;
        }
        createMutation.mutate(payload);
    };

    const submitting = createMutation.isPending;

    const deleteMutation = useMutation({
        mutationFn: (id) => announcementsService.deleteAnnouncement(id),
        onMutate: (id) => {
            setDeletingId(id);
        },
        onSuccess: () => {
            toast.success('Announcement deleted');
            queryClient.invalidateQueries({ queryKey: ['announcements'] });
            setDeletingId(null);
        },
        onError: () => {
            toast.error('Failed to delete announcement');
            setDeletingId(null);
        },
    });

    const handleDelete = (id) => {
        if (!window.confirm('Are you sure you want to delete this announcement?')) return;
        deleteMutation.mutate(id);
    };

    const handleAudienceChange = (audience) => {
        if (audience === 'all') {
            setFormData({ ...formData, targetAudience: ['all'] });
        } else {
            const currentAudience = formData.targetAudience.filter(a => a !== 'all');
            if (currentAudience.includes(audience)) {
                const newAudience = currentAudience.filter(a => a !== audience);
                setFormData({ ...formData, targetAudience: newAudience.length > 0 ? newAudience : ['all'] });
            } else {
                setFormData({ ...formData, targetAudience: [...currentAudience, audience] });
            }
        }
    };

    const getPriorityStyle = (priority) => {
        switch (priority) {
            case 'high': return { badge: 'text-red-700 bg-red-100 dark:bg-red-500/20 dark:text-red-400', border: 'border-l-red-500' };
            case 'medium': return { badge: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-500/20 dark:text-yellow-400', border: 'border-l-yellow-500' };
            case 'low': return { badge: 'text-blue-700 bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400', border: 'border-l-blue-500' };
            default: return { badge: 'text-gray-700 bg-gray-100 dark:bg-gray-500/20 dark:text-[#8E8E93]', border: 'border-l-gray-400' };
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const isExpired = (expiresAt) => expiresAt && new Date(expiresAt) < new Date();

    const timeAgo = (date) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return formatDate(date);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/app/communication')}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg flex-shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                    </button>
                    <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                        {isAdmin ? 'Create and manage school-wide announcements' : 'Stay updated with school announcements'}
                    </p>
                    </div>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                        <Plus className="h-4 w-4" />
                        New Announcement
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                <input
                    className="input pl-9 w-full"
                    placeholder="Search announcements\u2026"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />
            </div>

            {/* Announcements List */}
            {filteredAnnouncements.length === 0 ? (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-6 sm:p-12 text-center">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-4">
                        <Megaphone className="h-6 w-6 text-gray-400 dark:text-[#636366]" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                        {searchText.trim() ? 'No matching announcements' : 'No announcements'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                        {searchText.trim()
                            ? 'Try a different search term'
                            : isAdmin ? 'Create your first announcement to get started' : 'No announcements have been posted yet'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAnnouncements.map((announcement) => {
                        const style = getPriorityStyle(announcement.priority);
                        const expired = isExpired(announcement.expiresAt);
                        const isExpanded = expandedIds.has(announcement._id);

                        return (
                            <div
                                key={announcement._id}
                                className={`bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4 sm:p-6 border-l-4 ${style.border} ${expired ? 'opacity-60' : ''} ${deletingId === announcement._id ? 'opacity-40 pointer-events-none' : ''}`}
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{announcement.title}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${style.badge}`}>
                                                {announcement.priority}
                                            </span>
                                            {expired && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-[#2C2C2E] dark:text-[#8E8E93]">
                                                    Expired
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-gray-700 dark:text-[#8E8E93] text-sm leading-relaxed whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`}>
                                            {announcement.message}
                                        </p>
                                        {announcement.message.length > 200 && (
                                            <button
                                                onClick={() => toggleExpanded(announcement._id)}
                                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                                            >
                                                {isExpanded ? (
                                                    <>Read less <ChevronUp className="h-3 w-3" /></>
                                                ) : (
                                                    <>Read more <ChevronDown className="h-3 w-3" /></>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleDelete(announcement._id)}
                                            disabled={deletingId === announcement._id}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex-shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-[#8E8E93] mt-4 pt-3 border-t border-gray-100 dark:border-[#38383A]">
                                    <div className="flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5" />
                                        {announcement.targetAudience.includes('all')
                                            ? 'Everyone'
                                            : announcement.targetAudience.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')
                                        }
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        {timeAgo(announcement.createdAt)}
                                    </div>
                                    {announcement.notificationsSent > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <Megaphone className="h-3.5 w-3.5" />
                                            {announcement.notificationsSent} notified
                                        </div>
                                    )}
                                    {announcement.expiresAt && (
                                        <div className={`flex items-center gap-1.5 ${expired ? 'text-gray-400' : 'text-orange-500'}`}>
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            Expires: {formatDate(announcement.expiresAt)}
                                        </div>
                                    )}
                                    {announcement.createdBy?.name && (
                                        <div className="flex items-center gap-1.5">
                                            By: {announcement.createdBy.name}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Announcement Modal */}
            {showCreateModal && createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-[#38383A] sticky top-0 bg-white dark:bg-[#1C1C1E] z-10">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Announcement</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-full">
                                <X className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                    placeholder="Announcement title"
                                    required
                                    maxLength={200}
                                />
                                <p className="text-xs text-gray-400 mt-1 text-right">{formData.title.length}/200</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                    Message <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                    rows={5}
                                    required
                                    maxLength={2000}
                                    placeholder="Write your announcement..."
                                />
                                <p className="text-xs text-gray-400 mt-1 text-right">{formData.message.length}/2000</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">
                                    Target Audience <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {['all', 'student', 'teacher', 'parent', 'admin'].map((audience) => {
                                        const selected = formData.targetAudience.includes(audience);
                                        return (
                                            <button
                                                key={audience}
                                                type="button"
                                                onClick={() => handleAudienceChange(audience)}
                                                className={`px-3 py-1.5 text-sm rounded-full border transition-colors capitalize ${
                                                    selected
                                                        ? 'bg-primary-50 dark:bg-primary-500/20 border-primary-300 dark:border-primary-500/40 text-primary-700 dark:text-primary-400 font-medium'
                                                        : 'border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                                                }`}
                                            >
                                                {audience === 'all' ? 'Everyone' : audience}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Priority</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Expires Date (Optional)</label>
                                    <DatePicker
                                        value={formData.expiresDate}
                                        onChange={(e) => setFormData({ ...formData, expiresDate: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        placeholder="Select expiry date"
                                    />
                                </div>
                            </div>

                            {formData.expiresDate && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Expires Time (Optional)</label>
                                <TimePicker
                                    value={formData.expiresTime}
                                    onChange={(e) => setFormData({ ...formData, expiresTime: e.target.value })}
                                    placeholder="Select expiry time"
                                />
                            </div>
                            )}

                            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100 dark:border-[#38383A]">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-outline w-full sm:w-auto">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="btn btn-primary w-full sm:w-auto">
                                    {submitting ? 'Sending...' : 'Create & Broadcast'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Announcements;
