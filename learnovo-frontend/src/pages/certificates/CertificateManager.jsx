import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Settings, Search, Printer, Download, Trash2, Edit } from 'lucide-react';
import certificateService from '../../services/certificateService';
import { toast } from 'react-hot-toast';

const CertificateManager = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [editingCert, setEditingCert] = useState(null);
    const [editForm, setEditForm] = useState({});

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const data = await certificateService.getHistory();
            setHistory(data);
        } catch (error) {
            console.error('Error fetching history:', error);
            toast.error('Failed to load certificate history');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (cert) => {
        try {
            await certificateService.downloadCertificate(cert._id, `${cert.type}_${cert.certificateNumber}.pdf`);
            toast.success('Download started');
        } catch (error) {
            toast.error('Download failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this certificate? This action cannot be undone.')) return;
        try {
            await certificateService.deleteCertificate(id);
            toast.success('Certificate deleted');
            fetchHistory();
        } catch (error) {
            toast.error('Deletion failed');
        }
    };

    const openEditModal = (cert) => {
        setEditingCert(cert);
        setEditForm({
            remarks: cert.contentSnapshot?.remarks || '',
            leavingReason: cert.contentSnapshot?.leavingReason || '',
            conduct: cert.contentSnapshot?.conduct || '',
            boardResult: cert.contentSnapshot?.boardResult || ''
        });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await certificateService.updateCertificate(editingCert._id, editForm);
            toast.success('Certificate updated');
            setEditingCert(null);
            fetchHistory();
        } catch (error) {
            toast.error('Update failed');
        }
    };

    const filteredHistory = history.filter(cert =>
        cert.student?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.certificateNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Certificate Management</h1>
                    <p className="text-gray-600">Issue and manage student certificates</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/app/certificates/templates')}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 bg-white shadow-sm transition-colors"
                    >
                        <Settings size={20} />
                        Template Settings
                    </button>
                    <button
                        onClick={() => navigate('/app/certificates/generate')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition-colors"
                    >
                        <Plus size={20} />
                        Generate New
                    </button>
                </div>
            </div>

            {/* Search & Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                            <FileText size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Issued</p>
                            <h3 className="text-2xl font-bold">{history.length}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-800">Recent Certificates</h2>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search student or number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading history...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Certificate No</th>
                                    <th className="px-6 py-4">Student Name</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Date Issued</th>
                                    <th className="px-6 py-4">Issued By</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredHistory.length > 0 ? (
                                    filteredHistory.map((cert) => (
                                        <tr key={cert._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{cert.certificateNumber}</td>
                                            <td className="px-6 py-4 text-gray-700">{cert.student?.fullName || 'Unknown Student'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs rounded-full ${cert.type === 'TC'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {cert.type === 'TC' ? 'Transfer Cert' : 'Bonafide'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(cert.issueDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {cert.issuedBy?.fullName || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleDownload(cert)}
                                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Download"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(cert)}
                                                        className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                                        title="Edit Details"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(cert._id)}
                                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                            No certificates found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingCert && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Certificate Details</h3>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Leaving (TC)</label>
                                <div className="space-y-2">
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(editForm.leavingReason) ? editForm.leavingReason : 'Other'}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'Other') {
                                                setEditForm({ ...editForm, leavingReason: '' });
                                            } else {
                                                setEditForm({ ...editForm, leavingReason: val });
                                            }
                                        }}
                                    >
                                        <option value="Parent Request">Parent Request</option>
                                        <option value="Completed Studies">Completed Studies</option>
                                        <option value="Transfer">Transfer</option>
                                        <option value="Medical Grounds">Medical Grounds</option>
                                        <option value="Other">Other (Custom)</option>
                                    </select>
                                    {!['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(editForm.leavingReason) && (
                                        <input
                                            type="text"
                                            placeholder="Enter custom reason"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                                            value={editForm.leavingReason}
                                            onChange={e => setEditForm({ ...editForm, leavingReason: e.target.value })}
                                        />
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Conduct</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={editForm.conduct}
                                    onChange={e => setEditForm({ ...editForm, conduct: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Board Exam Result</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={editForm.boardResult}
                                    onChange={e => setEditForm({ ...editForm, boardResult: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    rows="3"
                                    value={editForm.remarks}
                                    onChange={e => setEditForm({ ...editForm, remarks: e.target.value })}
                                ></textarea>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingCert(null)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CertificateManager;
