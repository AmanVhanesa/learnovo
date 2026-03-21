import React, { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search, Filter, Shield, Key, Ban, CheckCircle2, AlertTriangle,
    MoreVertical, ChevronLeft, ChevronRight, Users, UserPlus, Eye,
    X, Download, Trash2, ShieldCheck, Mail, Calendar, Clock, Building2,
    Pencil, ChevronDown, Loader2
} from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'
import { useSuperAdminAuth } from '../../contexts/SuperAdminContext'
import toast from 'react-hot-toast'

// ─── Constants ────────────────────────────────────────────────────────────────
const USERS_PER_PAGE = 20
const DEBOUNCE_MS = 300

const ROLE_COLORS = {
    admin: { bg: 'bg-indigo-50 dark:bg-[rgba(99,102,241,0.12)]', text: 'text-indigo-700 dark:text-indigo-400', ring: 'ring-indigo-200 dark:ring-indigo-500/20' },
    teacher: { bg: 'bg-blue-50 dark:bg-[rgba(59,130,246,0.12)]', text: 'text-blue-700 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-500/20' },
    student: { bg: 'bg-green-50 dark:bg-[rgba(34,197,94,0.12)]', text: 'text-green-700 dark:text-green-400', ring: 'ring-green-200 dark:ring-green-500/20' },
    parent: { bg: 'bg-amber-50 dark:bg-[rgba(245,158,11,0.12)]', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-500/20' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function getUserName(user) {
    return user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User'
}

function getInitials(user) {
    const name = getUserName(user)
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return (name[0] || 'U').toUpperCase()
}

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
    const colors = ROLE_COLORS[role] || { bg: 'bg-gray-50 dark:bg-[rgba(142,142,147,0.12)]', text: 'text-gray-600 dark:text-[#8E8E93]', ring: 'ring-gray-200 dark:ring-gray-500/20' }
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ${colors.bg} ${colors.text} ${colors.ring}`}>
            {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown'}
        </span>
    )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ active }) {
    if (active) {
        return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158] dark:ring-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />Active
            </span>
        )
    }
    return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-[rgba(142,142,147,0.12)] dark:text-[#8E8E93] dark:ring-gray-500/20">
            <Ban className="h-3 w-3 mr-1" />Inactive
        </span>
    )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = 'md' }) {
    const sizeClasses = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-9 w-9 text-sm'
    return (
        <div className={`${sizeClasses} rounded-full bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center overflow-hidden flex-shrink-0`}>
            {user.avatar ? (
                <img src={user.avatar} alt={getUserName(user)} className="h-full w-full object-cover" />
            ) : (
                <span className="text-gray-600 dark:text-[#8E8E93] font-bold">{getInitials(user)}</span>
            )}
        </div>
    )
}

// ─── Dropdown Menu ────────────────────────────────────────────────────────────
function ActionMenu({ user, onView, onSuspend, onResetPassword, isOpen, onToggle, onClose }) {
    const menuRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return
        function handleClick(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [isOpen, onClose])

    return (
        <div className="relative inline-block text-left" ref={menuRef}>
            <button
                onClick={onToggle}
                className="p-1.5 rounded-lg text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
            >
                <MoreVertical className="h-4 w-4" />
            </button>
            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-1 w-48 rounded-xl shadow-lg bg-white dark:bg-[#1C1C1E] ring-1 ring-gray-200 dark:ring-[#38383A] z-30 py-1 overflow-hidden">
                    <button
                        onClick={() => { onView(user); onClose() }}
                        className="w-full text-left px-3.5 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] flex items-center gap-2 transition-colors"
                    >
                        <Eye className="h-4 w-4 text-gray-400" />View Details
                    </button>
                    <button
                        onClick={() => { onResetPassword(user._id); onClose() }}
                        className="w-full text-left px-3.5 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] flex items-center gap-2 transition-colors"
                    >
                        <Key className="h-4 w-4 text-gray-400" />Reset Password
                    </button>
                    <div className="border-t border-gray-100 dark:border-[#38383A] my-1" />
                    <button
                        onClick={() => { onSuspend(user._id, user.isActive); onClose() }}
                        className={`w-full text-left px-3.5 py-2 text-sm flex items-center gap-2 transition-colors ${user.isActive ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}
                    >
                        {user.isActive ? <><Ban className="h-4 w-4" />Suspend User</> : <><CheckCircle2 className="h-4 w-4" />Activate User</>}
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── User Detail Drawer ───────────────────────────────────────────────────────
function UserDetailDrawer({ userId, onClose }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['superadmin-user-detail', userId],
        queryFn: async () => {
            const res = await superAdminService.getUserById(userId)
            return res.data || res
        },
        enabled: !!userId,
    })

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] shadow-xl overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-[#1C1C1E] border-b border-gray-200 dark:border-[#38383A] px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Details</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500" />
                    </div>
                ) : error ? (
                    <div className="p-6">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-600 dark:text-red-400">
                            Failed to load user details.
                        </div>
                    </div>
                ) : data ? (
                    <div className="p-6 space-y-6">
                        {/* Profile Header */}
                        <div className="flex items-center gap-4">
                            <Avatar user={data} size="lg" />
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{getUserName(data)}</h3>
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">{data.email || 'No email'}</p>
                            </div>
                        </div>

                        {/* Info Cards */}
                        <div className="space-y-3">
                            <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl p-4 space-y-3">
                                <h4 className="text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93] tracking-wider">School</h4>
                                <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                                    <Building2 className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                    {data.tenantId?.schoolName || 'N/A'}
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl p-4 space-y-3">
                                <h4 className="text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93] tracking-wider">Role &amp; Status</h4>
                                <div className="flex items-center gap-3">
                                    <RoleBadge role={data.role} />
                                    <StatusBadge active={data.isActive} />
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl p-4 space-y-3">
                                <h4 className="text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93] tracking-wider">Activity</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                        <Clock className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                        <span className="text-gray-500 dark:text-[#8E8E93]">Last login:</span>
                                        {formatDateTime(data.lastLogin)}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                        <Calendar className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                        <span className="text-gray-500 dark:text-[#8E8E93]">Created:</span>
                                        {formatDate(data.createdAt)}
                                    </div>
                                </div>
                            </div>

                            {data.permissions && data.permissions.length > 0 && (
                                <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl p-4 space-y-3">
                                    <h4 className="text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93] tracking-wider">Permissions</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {data.permissions.map((perm) => (
                                            <span key={perm} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-[#38383A] text-gray-700 dark:text-gray-300">
                                                {perm}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(data.activitySummary || data.loginCount != null) && (
                                <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl p-4 space-y-3">
                                    <h4 className="text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93] tracking-wider">Activity Summary</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {data.loginCount != null && (
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.loginCount}</p>
                                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Total logins</p>
                                            </div>
                                        )}
                                        {data.activitySummary?.coursesEnrolled != null && (
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.activitySummary.coursesEnrolled}</p>
                                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Courses</p>
                                            </div>
                                        )}
                                        {data.activitySummary?.assignmentsCompleted != null && (
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.activitySummary.assignmentsCompleted}</p>
                                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Assignments</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, confirmLabel, confirmVariant = 'danger', onConfirm, onCancel, loading }) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">{message}</p>
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="h-10 px-4 text-sm font-semibold rounded-xl border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-all active:scale-[0.97] disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`h-10 px-4 text-sm font-semibold rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2 ${confirmVariant === 'danger' ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a]'}`}
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Super Admin Modal (Create / Edit) ────────────────────────────────────────
function SuperAdminModal({ open, onClose, initialData, onSubmit, loading }) {
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const isEdit = !!initialData

    useEffect(() => {
        if (initialData) {
            setForm({ name: initialData.name || '', email: initialData.email || '', password: '' })
        } else {
            setForm({ name: '', email: '', password: '' })
        }
    }, [initialData, open])

    if (!open) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!form.name.trim() || !form.email.trim()) {
            toast.error('Name and email are required')
            return
        }
        if (!isEdit && !form.password.trim()) {
            toast.error('Password is required')
            return
        }
        const payload = { name: form.name.trim(), email: form.email.trim() }
        if (form.password.trim()) payload.password = form.password.trim()
        onSubmit(payload)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {isEdit ? 'Edit Super Admin' : 'Add Super Admin'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full h-11 sm:h-10 px-3.5 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] text-sm transition-colors"
                            placeholder="Full name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full h-11 sm:h-10 px-3.5 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] text-sm transition-colors"
                            placeholder="admin@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Password {isEdit && <span className="text-gray-400 dark:text-[#636366] font-normal">(leave blank to keep current)</span>}
                        </label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full h-11 sm:h-10 px-3.5 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] text-sm transition-colors"
                            placeholder={isEdit ? '••••••••' : 'Minimum 8 characters'}
                        />
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="h-10 px-4 text-sm font-semibold rounded-xl border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-all active:scale-[0.97] disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="h-10 px-4 text-sm font-semibold rounded-xl bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEdit ? 'Save Changes' : 'Create Admin'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, total, limit, onPageChange }) {
    const start = (page - 1) * limit + 1
    const end = Math.min(page * limit, total)

    if (totalPages <= 1) return null

    const getPageNumbers = () => {
        const pages = []
        const maxVisible = 5
        let startPage = Math.max(1, page - Math.floor(maxVisible / 2))
        let endPage = Math.min(totalPages, startPage + maxVisible - 1)
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1)
        }
        for (let i = startPage; i <= endPage; i++) pages.push(i)
        return pages
    }

    return (
        <div className="bg-gray-50/80 dark:bg-[#2C2C2E] px-4 py-3 border-t border-gray-200 dark:border-[#38383A] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                Showing <span className="font-semibold text-gray-700 dark:text-white">{start}</span>–<span className="font-semibold text-gray-700 dark:text-white">{end}</span> of <span className="font-semibold text-gray-700 dark:text-white">{total}</span> users
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="p-2 rounded-lg text-gray-500 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#38383A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                {getPageNumbers().map((num) => (
                    <button
                        key={num}
                        onClick={() => onPageChange(num)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${page === num ? 'bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black shadow-sm' : 'text-gray-500 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#38383A]'}`}
                    >
                        {num}
                    </button>
                ))}
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg text-gray-500 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#38383A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

// ═════════════════════════════════════════════════════════════════════════════
// Platform Users Tab
// ═════════════════════════════════════════════════════════════════════════════
function PlatformUsersTab() {
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [activeMenuId, setActiveMenuId] = useState(null)
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [drawerUserId, setDrawerUserId] = useState(null)
    const [confirmAction, setConfirmAction] = useState(null) // { type, userId, isActive }
    const debounceRef = useRef(null)

    // Debounced search
    const handleSearchInput = useCallback((value) => {
        setSearchInput(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            setSearch(value)
            setPage(1)
        }, DEBOUNCE_MS)
    }, [])

    useEffect(() => {
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }, [])

    // Query
    const { data: usersData, isLoading, error } = useQuery({
        queryKey: ['superadmin-users', page, search, roleFilter, statusFilter],
        queryFn: async () => {
            const params = { page, limit: USERS_PER_PAGE, search, role: roleFilter || undefined }
            if (statusFilter === 'active') params.status = 'active'
            else if (statusFilter === 'inactive') params.status = 'inactive'
            const res = await superAdminService.getUsers(params)
            if (res.success) {
                const total = res.pagination?.total || res.total || 0
                const totalPages = Math.ceil(total / USERS_PER_PAGE) || 1
                return { users: res.data || [], total, totalPages }
            }
            return { users: [], total: 0, totalPages: 1 }
        },
        keepPreviousData: true,
    })

    const users = usersData?.users || []
    const total = usersData?.total || 0
    const totalPages = usersData?.totalPages || 1

    // Mutations
    const toggleStatusMutation = useMutation({
        mutationFn: async ({ userId, isActive }) => {
            if (isActive) {
                return superAdminService.deactivateUser(userId)
            }
            return superAdminService.activateUser(userId)
        },
        onSuccess: (_, { isActive }) => {
            toast.success(isActive ? 'User suspended successfully' : 'User activated successfully')
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] })
            setConfirmAction(null)
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to update user status')
            setConfirmAction(null)
        },
    })

    const resetPasswordMutation = useMutation({
        mutationFn: (userId) => superAdminService.resetUserPassword(userId),
        onSuccess: () => {
            toast.success('Password reset email sent successfully')
            setConfirmAction(null)
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to reset password')
            setConfirmAction(null)
        },
    })

    // Bulk mutations
    const bulkSuspendMutation = useMutation({
        mutationFn: async () => {
            const promises = [...selectedIds].map((id) => superAdminService.deactivateUser(id))
            return Promise.allSettled(promises)
        },
        onSuccess: () => {
            toast.success(`${selectedIds.size} user(s) suspended`)
            setSelectedIds(new Set())
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] })
        },
        onError: () => toast.error('Some users could not be suspended'),
    })

    const bulkActivateMutation = useMutation({
        mutationFn: async () => {
            const promises = [...selectedIds].map((id) => superAdminService.activateUser(id))
            return Promise.allSettled(promises)
        },
        onSuccess: () => {
            toast.success(`${selectedIds.size} user(s) activated`)
            setSelectedIds(new Set())
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] })
        },
        onError: () => toast.error('Some users could not be activated'),
    })

    // Handlers
    const handleSuspend = (userId, isActive) => {
        setConfirmAction({ type: 'toggle', userId, isActive })
    }

    const handleResetPassword = (userId) => {
        setConfirmAction({ type: 'reset', userId })
    }

    const handleConfirm = () => {
        if (confirmAction.type === 'toggle') {
            toggleStatusMutation.mutate({ userId: confirmAction.userId, isActive: confirmAction.isActive })
        } else if (confirmAction.type === 'reset') {
            resetPasswordMutation.mutate(confirmAction.userId)
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === users.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(users.map((u) => u._id)))
        }
    }

    const toggleSelect = (id) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const clearFilters = () => {
        setSearch('')
        setSearchInput('')
        setRoleFilter('')
        setStatusFilter('')
        setPage(1)
    }

    const handleExportSelected = () => {
        const selectedUsers = users.filter((u) => selectedIds.has(u._id))
        const csvRows = [
            ['Name', 'Email', 'Role', 'School', 'Status', 'Last Login'].join(','),
            ...selectedUsers.map((u) =>
                [getUserName(u), u.email || '', u.role || '', u.tenantId?.schoolName || '', u.isActive ? 'Active' : 'Inactive', u.lastLogin || ''].join(',')
            ),
        ]
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'users-export.csv'
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${selectedUsers.length} user(s)`)
    }

    const hasFilters = search || roleFilter || statusFilter

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] p-4">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                        </div>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            className="w-full h-11 sm:h-10 pl-10 pr-3.5 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] text-sm transition-colors"
                            placeholder="Search by name or email..."
                        />
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
                        <select
                            value={roleFilter}
                            onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
                            className="h-11 sm:h-10 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] text-sm transition-colors"
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="teacher">Teacher</option>
                            <option value="student">Student</option>
                            <option value="parent">Parent</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                            className="h-11 sm:h-10 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] text-sm transition-colors"
                        >
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white whitespace-nowrap underline underline-offset-2"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedIds.size > 0 && (
                <div className="bg-primary-50 dark:bg-[rgba(62,196,177,0.08)] border border-primary-200 dark:border-[#3EC4B1]/20 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-primary-700 dark:text-[#3EC4B1]">
                        {selectedIds.size} selected
                    </span>
                    <div className="h-4 w-px bg-primary-200 dark:bg-[#3EC4B1]/20" />
                    <button
                        onClick={() => bulkSuspendMutation.mutate()}
                        disabled={bulkSuspendMutation.isPending}
                        className="h-8 px-3 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-1.5"
                    >
                        <Ban className="h-3.5 w-3.5" />Suspend
                    </button>
                    <button
                        onClick={() => bulkActivateMutation.mutate()}
                        disabled={bulkActivateMutation.isPending}
                        className="h-8 px-3 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-1.5"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />Activate
                    </button>
                    <button
                        onClick={handleExportSelected}
                        className="h-8 px-3 text-xs font-semibold rounded-lg border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-all active:scale-[0.97] flex items-center gap-1.5"
                    >
                        <Download className="h-3.5 w-3.5" />Export
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="h-8 px-3 text-xs font-semibold rounded-lg text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white transition-colors"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error.response?.data?.message || error.message || 'Failed to load users'}</p>
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-[#38383A]">
                        <thead className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                            <tr>
                                <th className="w-12 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={users.length > 0 && selectedIds.size === users.length}
                                        onChange={toggleSelectAll}
                                        className="h-4 w-4 rounded border-gray-300 dark:border-[#38383A] text-primary-600 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">User</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Role</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">School</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Status</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Last Login</th>
                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-[#38383A]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500" />
                                            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">Loading users...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Users className="h-10 w-10 text-gray-300 dark:text-[#38383A]" />
                                            <p className="text-sm font-medium text-gray-500 dark:text-[#8E8E93]">No users found</p>
                                            {hasFilters && (
                                                <button onClick={clearFilters} className="text-sm text-primary-600 dark:text-[#3EC4B1] hover:underline font-medium">
                                                    Clear all filters
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                        <td className="w-12 px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(user._id)}
                                                onChange={() => toggleSelect(user._id)}
                                                className="h-4 w-4 rounded border-gray-300 dark:border-[#38383A] text-primary-600 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar user={user} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{getUserName(user)}</p>
                                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] truncate">{user.email || 'No email'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <RoleBadge role={user.role} />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-sm text-gray-900 dark:text-white">{user.tenantId?.schoolName || 'N/A'}</span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <StatusBadge active={user.isActive} />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">{formatDate(user.lastLogin)}</span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <ActionMenu
                                                user={user}
                                                onView={(u) => setDrawerUserId(u._id)}
                                                onSuspend={handleSuspend}
                                                onResetPassword={handleResetPassword}
                                                isOpen={activeMenuId === user._id}
                                                onToggle={() => setActiveMenuId(activeMenuId === user._id ? null : user._id)}
                                                onClose={() => setActiveMenuId(null)}
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!isLoading && users.length > 0 && (
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={total}
                        limit={USERS_PER_PAGE}
                        onPageChange={setPage}
                    />
                )}
            </div>

            {/* User Detail Drawer */}
            {drawerUserId && (
                <UserDetailDrawer userId={drawerUserId} onClose={() => setDrawerUserId(null)} />
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                open={!!confirmAction}
                title={confirmAction?.type === 'reset' ? 'Reset Password' : confirmAction?.isActive ? 'Suspend User' : 'Activate User'}
                message={
                    confirmAction?.type === 'reset'
                        ? 'This will send a password reset email to the user. Are you sure?'
                        : confirmAction?.isActive
                            ? 'This user will be suspended and unable to log in. Are you sure?'
                            : 'This will reactivate the user account. Are you sure?'
                }
                confirmLabel={confirmAction?.type === 'reset' ? 'Reset Password' : confirmAction?.isActive ? 'Suspend' : 'Activate'}
                confirmVariant={confirmAction?.type === 'reset' ? 'primary' : confirmAction?.isActive ? 'danger' : 'primary'}
                onConfirm={handleConfirm}
                onCancel={() => setConfirmAction(null)}
                loading={toggleStatusMutation.isPending || resetPasswordMutation.isPending}
            />
        </div>
    )
}

// ═════════════════════════════════════════════════════════════════════════════
// Super Admins Tab
// ═════════════════════════════════════════════════════════════════════════════
function SuperAdminsTab() {
    const queryClient = useQueryClient()
    const { superAdmin: currentAdmin } = useSuperAdminAuth()
    const [modalOpen, setModalOpen] = useState(false)
    const [editData, setEditData] = useState(null)
    const [deactivateTarget, setDeactivateTarget] = useState(null)

    const { data: adminsData, isLoading, error } = useQuery({
        queryKey: ['superadmin-admins'],
        queryFn: async () => {
            const res = await superAdminService.getSuperAdmins()
            return res.data || res || []
        },
    })

    const admins = Array.isArray(adminsData) ? adminsData : []

    const createMutation = useMutation({
        mutationFn: (data) => superAdminService.createSuperAdmin(data),
        onSuccess: () => {
            toast.success('Super admin created successfully')
            queryClient.invalidateQueries({ queryKey: ['superadmin-admins'] })
            setModalOpen(false)
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to create super admin'),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => superAdminService.updateSuperAdmin(id, data),
        onSuccess: () => {
            toast.success('Super admin updated successfully')
            queryClient.invalidateQueries({ queryKey: ['superadmin-admins'] })
            setModalOpen(false)
            setEditData(null)
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to update super admin'),
    })

    const deactivateMutation = useMutation({
        mutationFn: (id) => superAdminService.deactivateSuperAdmin(id),
        onSuccess: () => {
            toast.success('Super admin deactivated successfully')
            queryClient.invalidateQueries({ queryKey: ['superadmin-admins'] })
            setDeactivateTarget(null)
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to deactivate super admin')
            setDeactivateTarget(null)
        },
    })

    const handleSubmit = (payload) => {
        if (editData) {
            updateMutation.mutate({ id: editData._id, data: payload })
        } else {
            createMutation.mutate(payload)
        }
    }

    const openEdit = (admin) => {
        setEditData(admin)
        setModalOpen(true)
    }

    const openCreate = () => {
        setEditData(null)
        setModalOpen(true)
    }

    const isSelf = (admin) => {
        return currentAdmin && (currentAdmin._id === admin._id || currentAdmin.id === admin._id)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={openCreate}
                    className="h-10 px-4 text-sm font-semibold rounded-xl bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] transition-all active:scale-[0.97] flex items-center gap-2"
                >
                    <UserPlus className="h-4 w-4" />Add Super Admin
                </button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error.response?.data?.message || error.message || 'Failed to load super admins'}</p>
                </div>
            )}

            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-[#38383A]">
                        <thead className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                            <tr>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Admin</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Email</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Status</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Created</th>
                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-[#38383A]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500" />
                                            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">Loading admins...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : admins.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Shield className="h-10 w-10 text-gray-300 dark:text-[#38383A]" />
                                            <p className="text-sm font-medium text-gray-500 dark:text-[#8E8E93]">No super admins found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                admins.map((admin) => (
                                    <tr key={admin._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-primary-100 dark:bg-[rgba(62,196,177,0.12)] flex items-center justify-center flex-shrink-0">
                                                    <Shield className="h-4 w-4 text-primary-600 dark:text-[#3EC4B1]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                        {admin.name || 'Unnamed'}
                                                        {isSelf(admin) && (
                                                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-100 dark:bg-[rgba(62,196,177,0.12)] text-primary-700 dark:text-[#3EC4B1]">
                                                                You
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">{admin.email}</span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <StatusBadge active={admin.isActive !== false} />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">{formatDate(admin.createdAt)}</span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEdit(admin)}
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (isSelf(admin)) {
                                                            toast.error('You cannot deactivate your own account')
                                                            return
                                                        }
                                                        setDeactivateTarget(admin)
                                                    }}
                                                    disabled={isSelf(admin)}
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-[#636366] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title={isSelf(admin) ? 'Cannot deactivate yourself' : 'Deactivate'}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit Modal */}
            <SuperAdminModal
                open={modalOpen}
                onClose={() => { setModalOpen(false); setEditData(null) }}
                initialData={editData}
                onSubmit={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
            />

            {/* Deactivate Confirm */}
            <ConfirmModal
                open={!!deactivateTarget}
                title="Deactivate Super Admin"
                message={`Are you sure you want to deactivate ${deactivateTarget?.name || 'this admin'}? They will no longer be able to log in.`}
                confirmLabel="Deactivate"
                confirmVariant="danger"
                onConfirm={() => deactivateMutation.mutate(deactivateTarget._id)}
                onCancel={() => setDeactivateTarget(null)}
                loading={deactivateMutation.isPending}
            />
        </div>
    )
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════════════════
const TABS = [
    { id: 'users', label: 'Platform Users', icon: Users },
    { id: 'admins', label: 'Super Admins', icon: ShieldCheck },
]

const SuperAdminUsers = () => {
    const [activeTab, setActiveTab] = useState('users')

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-[#8E8E93]">Manage platform users and super admin accounts.</p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-[#38383A]">
                <nav className="flex gap-6" aria-label="Tabs">
                    {TABS.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`group relative flex items-center gap-2 pb-3 text-sm font-semibold transition-colors ${isActive ? 'text-primary-600 dark:text-[#3EC4B1]' : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'}`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                                {isActive && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary-600 dark:bg-[#3EC4B1]" />
                                )}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'users' ? <PlatformUsersTab /> : <SuperAdminsTab />}
        </div>
    )
}

export default SuperAdminUsers
