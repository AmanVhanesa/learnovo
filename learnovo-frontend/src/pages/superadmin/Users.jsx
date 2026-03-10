import React, { useState, useEffect } from 'react'
import { Search, Filter, Shield, Key, Ban, CheckCircle2, AlertTriangle, MoreVertical, X, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'

const SERVER_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/api\/?$/, '')

// Modal to show temp password after reset
const TempPasswordModal = ({ data, onClose }) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(data.tempPassword)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Password Reset</h3>
                        <p className="text-sm text-gray-500 mt-1">Share this temporary password with the user</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-xs text-blue-600 font-medium mb-2 uppercase tracking-wide">User: {data.email}</p>
                    <div className="flex items-center gap-3">
                        <code className="flex-1 text-lg font-mono font-bold text-blue-900 bg-white border border-blue-200 rounded px-3 py-2">
                            {data.tempPassword}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
                            title="Copy password"
                        >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-700 mb-4">
                    ⚠️ The user will be notified by email. They must change this password on first login.
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-primary-600 text-white font-medium py-2.5 rounded-lg hover:bg-primary-700 transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    )
}

const SuperAdminUsers = () => {
    const [users, setUsers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isUpdating, setIsUpdating] = useState(null) // store userId being updated

    // Temp password modal
    const [tempPasswordData, setTempPasswordData] = useState(null)

    // Pagination & Filters
    const [page, setPage] = useState(1)
    const [limit] = useState(10)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [roleFilter, setRoleFilter] = useState('')

    const [activeMenuId, setActiveMenuId] = useState(null)

    useEffect(() => {
        fetchUsers()
    }, [page, search, roleFilter])

    const fetchUsers = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await superAdminService.getUsers({
                page, limit, search, role: roleFilter
            })
            if (res.success) {
                setUsers(res.data)
                const total = res.pagination?.total || res.total || 0
                setTotalCount(total)
                setTotalPages(Math.ceil(total / limit) || 1)
            }
        } catch (err) {
            console.error('Error fetching users:', err)
            setError(err.response?.data?.message || 'Failed to load users')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSearch = (e) => {
        e.preventDefault()
        setSearch(searchInput)
        setPage(1)
    }

    const clearFilters = () => {
        setSearch('')
        setSearchInput('')
        setRoleFilter('')
        setPage(1)
    }

    const toggleUserStatus = async (userId, isCurrentlyActive) => {
        const action = isCurrentlyActive ? 'deactivate' : 'activate'
        if (!window.confirm(`Are you sure you want to ${action} this user?`)) return

        setIsUpdating(userId)
        try {
            if (isCurrentlyActive) {
                await superAdminService.deactivateUser(userId)
                toast.success('User deactivated successfully')
            } else {
                await superAdminService.activateUser(userId)
                toast.success('User activated successfully')
            }
            fetchUsers()
        } catch (error) {
            toast.error(`Failed to ${action} user`)
        } finally {
            setIsUpdating(null)
        }
    }

    const handleResetPassword = async (userId) => {
        if (!window.confirm('Reset password for this user? They will receive a temporary password.')) return

        setIsUpdating(userId)
        try {
            const res = await superAdminService.resetUserPassword(userId)
            if (res.success && res.data?.tempPassword) {
                setTempPasswordData(res.data)
            } else {
                toast.success('Password reset email sent to user')
            }
        } catch (error) {
            toast.error('Failed to reset password')
        } finally {
            setIsUpdating(null)
        }
    }

    // Badges
    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">Admin</span>
            case 'teacher': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Teacher</span>
            case 'student': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Student</span>
            case 'parent': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Parent</span>
            default: return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{role}</span>
        }
    }

    const startItem = (page - 1) * limit + 1
    const endItem = Math.min(page * limit, totalCount)

    return (
        <div className="space-y-6">
            {/* Temp Password Modal */}
            {tempPasswordData && (
                <TempPasswordModal
                    data={tempPasswordData}
                    onClose={() => setTempPasswordData(null)}
                />
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Platform Users</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage all users across all schools on the platform.
                        {totalCount > 0 && <span className="ml-1 text-gray-400">({totalCount.toLocaleString()} total)</span>}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Filters Toolbar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    <form onSubmit={handleSearch} className="flex-1">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                placeholder="Search by name or email..."
                            />
                        </div>
                    </form>

                    <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
                        <select
                            value={roleFilter}
                            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg"
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admins</option>
                            <option value="teacher">Teachers</option>
                            <option value="student">Students</option>
                            <option value="parent">Parents</option>
                        </select>

                        {(search || roleFilter) && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-gray-500 hover:text-gray-700 underline px-2 whitespace-nowrap"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto min-h-[400px] relative">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">School</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        <div className="flex justify-center items-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                            <span className="ml-3">Loading users...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        <div className="flex flex-col justify-center items-center">
                                            <Filter className="h-10 w-10 text-gray-300 mb-2" />
                                            <p>No users found matching your criteria.</p>
                                            {(search || roleFilter) && (
                                                <button onClick={clearFilters} className="mt-2 text-primary-600 hover:text-primary-800 font-medium text-sm">
                                                    Clear all filters
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user._id} className={`hover:bg-gray-50 transition-colors ${isUpdating === user._id ? 'opacity-50' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                                                    {user.avatar ? (
                                                        <img
                                                            src={user.avatar.startsWith('http') ? user.avatar : `${SERVER_URL}${user.avatar}`}
                                                            alt={user.name || 'User'}
                                                            className="h-full w-full object-cover"
                                                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                                                        />
                                                    ) : null}
                                                    <span
                                                        className="text-gray-600 font-bold text-sm"
                                                        style={{ display: user.avatar ? 'none' : 'flex' }}
                                                    >
                                                        {(user.name || user.firstName || 'U').charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User'}</div>
                                                    <div className="text-xs text-gray-500">{user.email || 'No email'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 font-medium">
                                                {user.tenantId?.schoolName || user.tenantId?.name || 'N/A'}
                                            </div>
                                            {user.tenantId?.schoolCode && (
                                                <div className="text-xs text-gray-400">{user.tenantId.schoolCode}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getRoleBadge(user.role)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.isActive ? (
                                                <span className="inline-flex items-center text-xs font-semibold text-green-600">
                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center text-xs font-semibold text-red-600">
                                                    <Ban className="h-3.5 w-3.5 mr-1" /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="relative inline-block text-left">
                                                <button
                                                    onClick={() => setActiveMenuId(activeMenuId === user._id ? null : user._id)}
                                                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors"
                                                    disabled={isUpdating === user._id}
                                                >
                                                    <MoreVertical className="h-5 w-5" />
                                                </button>

                                                {activeMenuId === user._id && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)}></div>
                                                        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 focus:outline-none">
                                                            <div className="py-1" role="menu">
                                                                <button
                                                                    onClick={() => {
                                                                        handleResetPassword(user._id)
                                                                        setActiveMenuId(null)
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex items-center"
                                                                    role="menuitem"
                                                                >
                                                                    <Key className="h-4 w-4 mr-2 text-gray-500" />
                                                                    Reset Password
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        toggleUserStatus(user._id, user.isActive)
                                                                        setActiveMenuId(null)
                                                                    }}
                                                                    className={`w-full text-left px-4 py-2 text-sm flex items-center ${user.isActive
                                                                        ? 'text-red-700 hover:bg-red-50 hover:text-red-900'
                                                                        : 'text-green-700 hover:bg-green-50 hover:text-green-900'
                                                                        }`}
                                                                    role="menuitem"
                                                                >
                                                                    {user.isActive ? (
                                                                        <><Ban className="h-4 w-4 mr-2" /> Deactivate User</>
                                                                    ) : (
                                                                        <><CheckCircle2 className="h-4 w-4 mr-2" /> Activate User</>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!isLoading && totalPages > 1 && (
                    <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
                        <div className="hidden sm:block">
                            <p className="text-sm text-gray-700">
                                Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of <span className="font-medium">{totalCount}</span> users
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                                    const pageNum = i + 1
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum
                                                ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </nav>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SuperAdminUsers
