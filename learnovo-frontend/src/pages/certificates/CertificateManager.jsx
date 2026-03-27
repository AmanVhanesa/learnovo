import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Settings, Search, Download, Trash2, Edit, Award, Eye, X } from 'lucide-react';
import certificateService from '../../services/certificateService';
import { generateCertificateDocx } from '../../utils/certificateDocxExport';
import { reportsService } from '../../services/reportsService';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

const CertificateManager = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCert, setEditingCert] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [previewCert, setPreviewCert] = useState(null);

    const { data: history = [], isLoading: loading } = useQuery({
        queryKey: ['certificate-history'],
        queryFn: async () => {
            const data = await certificateService.getHistory();
            return data || [];
        },
    });

    const handleDownload = async (cert) => {
        try {
            await certificateService.downloadCertificate(cert._id, `${cert.type}_${cert.certificateNumber}.pdf`);
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

    const openEditModal = (cert) => {
        setEditingCert(cert);
        setEditForm({
            remarks: cert.contentSnapshot?.remarks || '',
            leavingReason: cert.contentSnapshot?.leavingReason || '',
            conduct: cert.contentSnapshot?.conduct || '',
            boardResult: cert.contentSnapshot?.boardResult || ''
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

    const handleExportWord = async (cert) => {
        try {
            const snap = cert.contentSnapshot || {};
            await generateCertificateDocx(cert.type, {
                ...snap,
                certificateNumber: cert.certificateNumber,
                issueDate: snap.issueDate || new Date(cert.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            });
            const certLabel = cert.type === 'TC' ? 'Leaving Certificate' : 'Bonafide Certificate';
            reportsService.logActivity({
                type: 'certificate', action: 'word_export',
                message: `${certLabel} (${cert.certificateNumber}) exported as Word document`,
                studentName: cert.student?.fullName || cert.student?.name
            });
            toast.success('Word document exported!');
        } catch {
            toast.error('Failed to export Word document');
        }
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

    const getPreviewRows = (cert) => {
        const d = cert.contentSnapshot || {};
        if (cert.type === 'TC') {
            return [
                ['Student Name', d.studentName], ["Father's / Guardian's Name", d.fatherName],
                ["Mother's Name", d.motherName], ['Nationality', d.nationality], ['Category', d.category],
                ['Date of Birth', d.dob], ['Date of Birth (in words)', d.dobWords],
                ['Admission Number', d.admissionNumber], ['Date of First Admission', d.admissionDate],
                ['Class in which Last Studied', d.class], ['Section', d.section],
                ['Academic Year', d.academicYear], ['Board Examination Result', d.boardResult],
                ['Promotion Status', d.promotionStatus], ['Subjects Studied', d.subjects],
                ['Fee Status', d.feeStatus], ['General Conduct', d.conduct],
                ['Date of Application', d.applicationDate], ['Date of Issue', d.issueDate],
                ['Reason for Leaving', d.leavingReason], ['Remarks', d.remarks],
            ];
        }
        return [
            ['Student Name', d.studentName], ["Father's Name", d.fatherName],
            ["Mother's Name", d.motherName], ['Admission Number', d.admissionNumber],
            ['Date of Birth', d.dob], ['Class', d.class], ['Section', d.section],
            ['Academic Year', d.academicYear], ['Category', d.category], ['Purpose', d.purpose],
        ];
    };

    const filteredHistory = history.filter(cert =>
        cert.student?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.certificateNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                                <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8E8E93]">{new Date(cert.issueDate).toLocaleDateString()}</td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8E8E93]">{cert.issuedBy?.fullName || '-'}</td>
                                <td className="px-5 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button onClick={() => handlePreviewCert(cert)} className="btn-icon" title="Preview"><Eye className="h-4 w-4" /></button>
                                        <button onClick={() => handleDownload(cert)} className="btn-icon" title="Download"><Download className="h-4 w-4" /></button>
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
                        <div className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-100 dark:ring-primary-500/20">
                            <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
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
                    placeholder="Search student or certificate number..."
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
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg ring-1 ring-white dark:ring-[#1C1C1E] max-w-md w-full mx-4 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#38383A]">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Certificate Details</h3>
                        </div>
                        <form onSubmit={handleUpdate} className="p-6 space-y-4">
                            <div>
                                <label className="label mb-1.5 block">Reason for Leaving (TC)</label>
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
                            <div>
                                <label className="label mb-1.5 block">Conduct</label>
                                <input type="text" className="input" value={editForm.conduct} onChange={e => setEditForm({ ...editForm, conduct: e.target.value })} />
                            </div>
                            <div>
                                <label className="label mb-1.5 block">Board Exam Result</label>
                                <input type="text" className="input" value={editForm.boardResult} onChange={e => setEditForm({ ...editForm, boardResult: e.target.value })} />
                            </div>
                            <div>
                                <label className="label mb-1.5 block">Remarks</label>
                                <textarea className="input min-h-[80px]" rows="3" value={editForm.remarks} onChange={e => setEditForm({ ...editForm, remarks: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-[#38383A]">
                                <button type="button" onClick={() => setEditingCert(null)} className="btn btn-outline">Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Changes</button>
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
                        <div className="w-full flex items-center justify-between bg-[#1C1C1E] px-5 py-3 rounded-t-2xl">
                            <h3 className="text-white font-semibold text-sm">
                                Certificate Preview — {previewCert.certificateNumber}
                            </h3>
                            <button onClick={() => setPreviewCert(null)} className="text-gray-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* A4 Paper area */}
                        <div className="w-full flex-1 overflow-y-auto bg-[#2C2C2E] p-6 sm:p-10 flex justify-center">
                            <div className="bg-white w-full max-w-[595px] min-h-[842px] shadow-2xl relative overflow-hidden" style={{ fontFamily: 'serif' }}>
                                {/* PREVIEW Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 1 }}>
                                    <span className="text-gray-200 font-bold tracking-widest" style={{ fontSize: '72px', transform: 'rotate(-35deg)', opacity: 0.35 }}>PREVIEW</span>
                                </div>

                                {/* Certificate content */}
                                <div className="relative p-8 sm:p-12" style={{ zIndex: 2 }}>
                                    <div className="border-2 p-6 sm:p-8" style={{ borderColor: '#b08d57' }}>
                                        <h1 className="text-center font-bold text-lg sm:text-xl text-gray-900 mb-1">
                                            {previewCert.contentSnapshot?.schoolName || 'School Name'}
                                        </h1>
                                        <p className="text-center text-xs text-gray-500 mb-4">
                                            {previewCert.contentSnapshot?.schoolAddress}
                                        </p>

                                        <h2 className="text-center font-bold text-base sm:text-lg underline mb-4 text-gray-800">
                                            {previewCert.type === 'TC' ? 'SCHOOL LEAVING CERTIFICATE' : 'BONAFIDE CERTIFICATE'}
                                        </h2>

                                        <div className="text-right text-xs text-gray-600 mb-4 space-y-0.5">
                                            <p>Certificate No: <span className="font-medium">{previewCert.certificateNumber}</span></p>
                                            <p>Date: <span className="font-medium">{previewCert.contentSnapshot?.issueDate || new Date(previewCert.issueDate).toLocaleDateString()}</span></p>
                                        </div>

                                        {previewCert.type === 'BONAFIDE' && (
                                            <p className="text-sm text-gray-700 mb-4">
                                                This is to certify that <strong>{previewCert.contentSnapshot?.studentName}</strong> is a bonafide student of this school. The details are as follows:
                                            </p>
                                        )}

                                        <table className="w-full text-xs border-collapse mb-6">
                                            <tbody>
                                                {getPreviewRows(previewCert).map(([label, value], i) => (
                                                    <tr key={i} className="border-b border-gray-200">
                                                        <td className="py-1.5 pr-3 font-semibold text-gray-700 w-2/5 align-top">{label}</td>
                                                        <td className="py-1.5 text-gray-900">{value || 'N/A'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <div className="flex justify-between mt-10 pt-4">
                                            <div className="text-center">
                                                <div className="w-32 border-t border-gray-400 mb-1"></div>
                                                <p className="text-xs font-semibold text-gray-700">Class Teacher</p>
                                            </div>
                                            <div className="text-center">
                                                <div className="w-32 border-t border-gray-400 mb-1"></div>
                                                <p className="text-xs font-semibold text-gray-700">Principal</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 bg-[#1C1C1E] px-5 py-4 rounded-b-2xl">
                            <button
                                onClick={() => { setPreviewCert(null); handleDownload(previewCert); }}
                                className="btn btn-primary gap-2 w-full sm:w-auto text-sm"
                            >
                                <Download className="h-4 w-4" />
                                Export as PDF
                            </button>
                            <button
                                onClick={() => handleExportWord(previewCert)}
                                className="btn gap-2 w-full sm:w-auto text-sm bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <FileText className="h-4 w-4" />
                                Export as Word
                            </button>
                            <button
                                onClick={() => setPreviewCert(null)}
                                className="btn btn-outline w-full sm:w-auto text-sm border-gray-500 text-gray-300 hover:text-white hover:border-gray-300"
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
