import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Settings, Search, Download, Trash2, Edit, Award, Eye, X, Printer, FileDown } from 'lucide-react';
import certificateService from '../../services/certificateService';
import { formatDate } from '../../utils/formatDate';
import { reportsService } from '../../services/reportsService';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import CertificatePreviewContent from './CertificatePreviewContent';
import { highQualityPrint } from '../../utils/highQualityPrint';

const CertificateManager = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCert, setEditingCert] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [previewCert, setPreviewCert] = useState(null);
    const [isPrintLoading, setIsPrintLoading] = useState(false);
    const certPrintRef = useRef(null);

    const { data: history = [], isLoading: loading } = useQuery({
        queryKey: ['certificate-history'],
        queryFn: async () => {
            const data = await certificateService.getHistory();
            return data || [];
        },
    });

    const handleDownload = async (cert) => {
        try {
            const studentName = (cert.student?.fullName || cert.student?.name || 'certificate').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
            await certificateService.downloadCertificate(cert._id, `${cert.type}_${studentName}.pdf`);
            const certLabel = cert.type === 'TC' ? 'Leaving Certificate' : 'Bonafide Certificate';
            reportsService.logActivity({
                type: 'certificate', action: 'pdf_export',
                message: `${certLabel} (${cert.certificateNumber}) exported as PDF`,
                studentName: cert.student?.fullName || cert.student?.name
            });
            toast.success('Download started');
        } catch (error) {
            toast.error('Download failed');
        }
    };

    const deleteMutation = useMutation({
        mutationFn: (id) => certificateService.deleteCertificate(id),
        onSuccess: () => {
            toast.success('Certificate deleted');
            queryClient.invalidateQueries({ queryKey: ['certificate-history'] });
        },
        onError: () => {
            toast.error('Deletion failed');
        },
    });

    const handleDelete = (id) => {
        if (!window.confirm('Are you sure you want to delete this certificate? This action cannot be undone.')) return;
        deleteMutation.mutate(id);
    };

    const handleDownloadWord = async (cert) => {
        try {
            const studentName = (cert.student?.fullName || cert.student?.name || 'certificate').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
            const token = localStorage.getItem('token');
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const response = await fetch(`${API_URL}/certificates/${cert._id}/download-word`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Download failed');
            const arrayBuffer = await response.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${cert.type}_${studentName}.docx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Word document downloaded');
        } catch (error) {
            toast.error('Word download failed');
        }
    };

    const openEditModal = (cert) => {
        setEditingCert(cert);
        const s = cert.contentSnapshot || {};
        setEditForm({
            // Student details
            studentName: s.studentName || '',
            fatherName: s.fatherName || '',
            motherName: s.motherName || '',
            dob: s.dob || '',
            dobWords: s.dobWords || '',
            admissionNumber: s.admissionNumber || '',
            class: s.class || '',
            section: s.section || '',
            academicYear: s.academicYear || '',
            nationality: s.nationality || '',
            category: s.category || '',
            penNumber: s.penNumber || '',
            srNumber: s.srNumber || '',
            // Dates & place
            issueDate: s.issueDate || '',
            applicationDate: s.applicationDate || '',
            place: s.place || '',
            // TC-specific
            admissionDate: s.admissionDate || '',
            boardResult: s.boardResult || '',
            promotionStatus: s.promotionStatus || '',
            subjects: s.subjects || '',
            feeStatus: s.feeStatus || '',
            conduct: s.conduct || '',
            leavingReason: s.leavingReason || '',
            remarks: s.remarks || '',
            // Bonafide-specific
            purpose: s.purpose || '',
        });
    };

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => certificateService.updateCertificate(id, data),
        onSuccess: () => {
            toast.success('Certificate updated');
            setEditingCert(null);
            queryClient.invalidateQueries({ queryKey: ['certificate-history'] });
        },
        onError: () => {
            toast.error('Update failed');
        },
    });

    const handleUpdate = (e) => {
        e.preventDefault();
        updateMutation.mutate({ id: editingCert._id, data: editForm });
    };

    const handlePreviewCert = (cert) => {
        setPreviewCert(cert);
        const certLabel = cert.type === 'TC' ? 'Leaving Certificate' : 'Bonafide Certificate';
        reportsService.logActivity({
            type: 'certificate', action: 'preview',
            message: `${certLabel} (${cert.certificateNumber}) previewed for ${cert.student?.fullName || cert.student?.name || 'Unknown'}`,
            studentName: cert.student?.fullName || cert.student?.name
        });
    };

    const handlePrint = async (cert) => {
        // If preview modal is open, use the rendered content directly
        if (certPrintRef.current) {
            setIsPrintLoading(true);
            try {
                const filename = cert.type === 'TC' ? 'Transfer-Certificate' : 'Bonafide-Certificate';
                await highQualityPrint(certPrintRef.current, filename, {
                    scale: 3, format: 'a4', orientation: 'portrait', margin: 10,
                });
            } catch (error) {
                console.error('Print failed:', error);
                toast.error('Failed to prepare print. Please try again.');
            } finally {
                setIsPrintLoading(false);
            }
            return;
        }
        // If no preview open, open the preview first then print
        setPreviewCert(cert);
        // Use a short delay to let the modal render, then print
        setTimeout(async () => {
            if (!certPrintRef.current) return;
            setIsPrintLoading(true);
            try {
                const filename = cert.type === 'TC' ? 'Transfer-Certificate' : 'Bonafide-Certificate';
                await highQualityPrint(certPrintRef.current, filename, {
                    scale: 3, format: 'a4', orientation: 'portrait', margin: 10,
                });
            } catch (error) {
                console.error('Print failed:', error);
                toast.error('Failed to prepare print. Please try again.');
            } finally {
                setIsPrintLoading(false);
            }
        }, 500);
    };

    const filteredHistory = history.filter(cert => {
        const term = searchTerm.toLowerCase();
        return cert.student?.fullName?.toLowerCase().includes(term) ||
            cert.certificateNumber?.toLowerCase().includes(term) ||
            cert.student?.admissionNumber?.toLowerCase().includes(term);
    });

    const tcCerts = filteredHistory.filter(c => c.type === 'TC');
    const bonafideCerts = filteredHistory.filter(c => c.type === 'BONAFIDE');

    const CertTable = ({ certs, emptyMsg }) => (
        certs.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="w-full min-w-[650px]">
                    <thead className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                        <tr>
                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Certificate No</th>
                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Student Name</th>
                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date Issued</th>
                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Issued By</th>
                            <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
                        {certs.map((cert) => (
                            <tr key={cert._id} className="hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E]/50 transition-colors">
                                <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{cert.certificateNumber}</td>
                                <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-[#8E8E93]">{cert.student?.fullName || 'Unknown Student'}</td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8E8E93]">{formatDate(cert.issueDate)}</td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8E8E93]">{cert.issuedBy?.fullName || cert.issuedBy?.name || (cert.issuedBy?.firstName ? `${cert.issuedBy.firstName} ${cert.issuedBy.lastName || ''}`.trim() : '-')}</td>
                                <td className="px-5 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button onClick={() => handlePreviewCert(cert)} className="btn-icon" title="Preview"><Eye className="h-4 w-4" /></button>
                                        <button onClick={() => handlePrint(cert)} className="btn-icon" title="Print"><Printer className="h-4 w-4" /></button>
                                        <button onClick={() => handleDownload(cert)} className="btn-icon" title="Download PDF"><Download className="h-4 w-4" /></button>
                                        <button onClick={() => handleDownloadWord(cert)} className="btn-icon" title="Download Word"><FileDown className="h-4 w-4" /></button>
                                        <button onClick={() => openEditModal(cert)} className="btn-icon" title="Edit"><Edit className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete(cert._id)} className="btn-icon hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20" title="Delete"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <EmptyState icon={Award} title="No certificates found" description={emptyMsg} />
        )
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Certificate Management</h1>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Issue and manage student certificates</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button onClick={() => navigate('/app/certificates/templates')} className="btn btn-outline gap-2 w-full sm:w-auto">
                        <Settings className="h-4 w-4" />
                        Template Settings
                    </button>
                    <button onClick={() => navigate('/app/certificates/generate')} className="btn btn-primary gap-2 w-full sm:w-auto">
                        <Plus className="h-4 w-4" />
                        Generate New
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 ring-1 ring-teal-100 dark:ring-teal-500/20">
                            <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Total Issued</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{history.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-100 dark:ring-amber-500/20">
                            <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Transfer Certificates</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{history.filter(c => c.type === 'TC').length}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-100 dark:ring-emerald-500/20">
                            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Bonafide Certificates</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{history.filter(c => c.type === 'BONAFIDE').length}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search bar */}
            <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                <input
                    type="text"
                    placeholder="Search by student name, admission number, or certificate number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-10"
                />
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : (
                <>
                    {/* Transfer Certificates Section */}
                    <div className="card overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">School Leaving / Transfer Certificates</h2>
                            <span className="ml-auto text-xs font-medium text-gray-400 dark:text-[#636366]">{tcCerts.length} issued</span>
                        </div>
                        <CertTable certs={tcCerts} emptyMsg={searchTerm ? 'No matching transfer certificates' : 'No transfer certificates issued yet'} />
                    </div>

                    {/* Bonafide Certificates Section */}
                    <div className="card overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Bonafide Certificates</h2>
                            <span className="ml-auto text-xs font-medium text-gray-400 dark:text-[#636366]">{bonafideCerts.length} issued</span>
                        </div>
                        <CertTable certs={bonafideCerts} emptyMsg={searchTerm ? 'No matching bonafide certificates' : 'No bonafide certificates issued yet'} />
                    </div>
                </>
            )}

            {/* Edit Modal */}
            {editingCert && createPortal(
                <div className="modal-overlay" onClick={() => setEditingCert(null)}>
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg ring-1 ring-white dark:ring-[#1C1C1E] max-w-2xl w-full mx-4 animate-scale-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Certificate Details</h3>
                            <button onClick={() => setEditingCert(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="h-5 w-5" /></button>
                        </div>
                        <form onSubmit={handleUpdate} className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Student Information */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Student Information</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="label mb-1 block text-xs">Student Name</label>
                                        <input type="text" className="input" value={editForm.studentName} onChange={e => setEditForm({ ...editForm, studentName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Father&apos;s Name</label>
                                        <input type="text" className="input" value={editForm.fatherName} onChange={e => setEditForm({ ...editForm, fatherName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Mother&apos;s Name</label>
                                        <input type="text" className="input" value={editForm.motherName} onChange={e => setEditForm({ ...editForm, motherName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Date of Birth</label>
                                        <input type="text" className="input" value={editForm.dob} onChange={e => setEditForm({ ...editForm, dob: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">DOB in Words</label>
                                        <input type="text" className="input" value={editForm.dobWords} onChange={e => setEditForm({ ...editForm, dobWords: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Admission Number</label>
                                        <input type="text" className="input" value={editForm.admissionNumber} onChange={e => setEditForm({ ...editForm, admissionNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Class</label>
                                        <input type="text" className="input" value={editForm.class} onChange={e => setEditForm({ ...editForm, class: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Section</label>
                                        <input type="text" className="input" value={editForm.section} onChange={e => setEditForm({ ...editForm, section: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Academic Year</label>
                                        <input type="text" className="input" value={editForm.academicYear} onChange={e => setEditForm({ ...editForm, academicYear: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Nationality</label>
                                        <input type="text" className="input" value={editForm.nationality} onChange={e => setEditForm({ ...editForm, nationality: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Category</label>
                                        <input type="text" className="input" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">PEN Number</label>
                                        <input type="text" className="input" value={editForm.penNumber} onChange={e => setEditForm({ ...editForm, penNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">SR / GR Number</label>
                                        <input type="text" className="input" value={editForm.srNumber} onChange={e => setEditForm({ ...editForm, srNumber: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* Dates & Place */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Dates & Place</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="label mb-1 block text-xs">Issue Date</label>
                                        <input type="text" className="input" value={editForm.issueDate} onChange={e => setEditForm({ ...editForm, issueDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block text-xs">Place</label>
                                        <input type="text" className="input" value={editForm.place} onChange={e => setEditForm({ ...editForm, place: e.target.value })} />
                                    </div>
                                    {editingCert.type === 'TC' && (
                                        <>
                                            <div>
                                                <label className="label mb-1 block text-xs">Application Date</label>
                                                <input type="text" className="input" value={editForm.applicationDate} onChange={e => setEditForm({ ...editForm, applicationDate: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="label mb-1 block text-xs">Date of Admission</label>
                                                <input type="text" className="input" value={editForm.admissionDate} onChange={e => setEditForm({ ...editForm, admissionDate: e.target.value })} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* TC-Specific Fields */}
                            {editingCert.type === 'TC' && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Transfer Certificate Details</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="label mb-1 block text-xs">Conduct</label>
                                            <input type="text" className="input" value={editForm.conduct} onChange={e => setEditForm({ ...editForm, conduct: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block text-xs">Board Exam Result</label>
                                            <input type="text" className="input" value={editForm.boardResult} onChange={e => setEditForm({ ...editForm, boardResult: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block text-xs">Promotion Status</label>
                                            <select className="input" value={editForm.promotionStatus} onChange={e => setEditForm({ ...editForm, promotionStatus: e.target.value })}>
                                                <option value="Yes">Yes</option>
                                                <option value="No">No</option>
                                                <option value="N/A">N/A</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label mb-1 block text-xs">Fee Status</label>
                                            <input type="text" className="input" value={editForm.feeStatus} onChange={e => setEditForm({ ...editForm, feeStatus: e.target.value })} />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="label mb-1 block text-xs">Reason for Leaving</label>
                                            <div className="space-y-2">
                                                <select
                                                    className="input"
                                                    value={['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(editForm.leavingReason) ? editForm.leavingReason : 'Other'}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEditForm({ ...editForm, leavingReason: val === 'Other' ? '' : val });
                                                    }}
                                                >
                                                    <option value="Parent Request">Parent Request</option>
                                                    <option value="Completed Studies">Completed Studies</option>
                                                    <option value="Transfer">Transfer</option>
                                                    <option value="Medical Grounds">Medical Grounds</option>
                                                    <option value="Other">Other (Custom)</option>
                                                </select>
                                                {!['Parent Request', 'Completed Studies', 'Transfer', 'Medical Grounds'].includes(editForm.leavingReason) && (
                                                    <input type="text" placeholder="Enter custom reason" className="input bg-gray-50 dark:bg-[#1C1C1E]" value={editForm.leavingReason} onChange={e => setEditForm({ ...editForm, leavingReason: e.target.value })} />
                                                )}
                                            </div>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="label mb-1 block text-xs">Subjects Studied</label>
                                            <textarea className="input min-h-[60px]" rows="2" value={editForm.subjects} onChange={e => setEditForm({ ...editForm, subjects: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Bonafide-Specific Fields */}
                            {editingCert.type === 'BONAFIDE' && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Bonafide Details</h4>
                                    <div>
                                        <label className="label mb-1 block text-xs">Purpose</label>
                                        <input type="text" className="input" value={editForm.purpose} onChange={e => setEditForm({ ...editForm, purpose: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            {/* Remarks (both types) */}
                            <div>
                                <label className="label mb-1 block text-xs">Remarks</label>
                                <textarea className="input min-h-[70px]" rows="2" value={editForm.remarks} onChange={e => setEditForm({ ...editForm, remarks: e.target.value })} />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-[#38383A]">
                                <button type="button" onClick={() => setEditingCert(null)} className="btn btn-outline">Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Certificate Preview Modal */}
            {previewCert && createPortal(
                <div className="modal-overlay" onClick={() => setPreviewCert(null)} style={{ zIndex: 50 }}>
                    <div className="flex flex-col items-center max-h-[95vh] w-full max-w-3xl mx-4" onClick={e => e.stopPropagation()}>
                        {/* Modal header */}
                        <div className="w-full flex items-center justify-between bg-white dark:bg-[#1C1C1E] border-b border-gray-200 dark:border-[#38383A] px-5 py-3 rounded-t-2xl">
                            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">
                                Certificate Preview — {previewCert.certificateNumber}
                            </h3>
                            <button onClick={() => setPreviewCert(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* A4 Paper area */}
                        <div className="w-full flex-1 min-h-0 overflow-y-auto bg-gray-100 dark:bg-[#2C2C2E] p-6 sm:p-10 flex justify-center">
                            <div ref={certPrintRef}>
                                <CertificatePreviewContent
                                    type={previewCert.type}
                                    data={previewCert.contentSnapshot}
                                    certificateNumber={previewCert.certificateNumber}
                                    showPreviewWatermark={false}
                                />
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 bg-white dark:bg-[#1C1C1E] border-t border-gray-200 dark:border-[#38383A] px-5 py-4 rounded-b-2xl">
                            <button
                                onClick={() => { handlePrint(previewCert); }}
                                disabled={isPrintLoading}
                                className="btn btn-primary gap-2 w-full sm:w-auto text-sm"
                            >
                                <Printer className="h-4 w-4" />
                                {isPrintLoading ? 'Preparing High Quality Print...' : 'Print'}
                            </button>
                            <button
                                onClick={() => { setPreviewCert(null); handleDownload(previewCert); }}
                                className="btn btn-outline gap-2 w-full sm:w-auto text-sm"
                            >
                                <Download className="h-4 w-4" />
                                Export as PDF
                            </button>
                            <button
                                onClick={() => { setPreviewCert(null); handleDownloadWord(previewCert); }}
                                className="btn btn-outline gap-2 w-full sm:w-auto text-sm"
                            >
                                <FileDown className="h-4 w-4" />
                                Export as Word
                            </button>
                            <button
                                onClick={() => setPreviewCert(null)}
                                className="btn btn-outline w-full sm:w-auto text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CertificateManager;
