import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, FileText, Users, Calendar, Trash2, X, Search,
    Printer, Download, ArrowLeft, Eye, AlertCircle, Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import circularsService from '../services/circularsService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import DatePicker from '../components/ui/DatePicker';
import { openPrintWindow } from '../utils/printHelper';

const CATEGORIES = [
    { value: 'general', label: 'General' },
    { value: 'academic', label: 'Academic' },
    { value: 'event', label: 'Event' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'exam', label: 'Exam' },
    { value: 'fee', label: 'Fee' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'other', label: 'Other' }
];

const AUDIENCE_OPTIONS = ['all', 'student', 'teacher', 'parent', 'admin'];

const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
};

const escapeHtml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildCircularHTML = (circular, school, mode = 'print') => {
    const audience = (circular.targetAudience || []).includes('all')
        ? 'All Members'
        : (circular.targetAudience || []).map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ');

    const classes = (circular.targetClasses || [])
        .map(c => c.name || c.grade || '')
        .filter(Boolean)
        .join(', ');

    const bodyHtml = escapeHtml(circular.body).replace(/\n/g, '<br/>');
    const logoHtml = school.logo
        ? `<div style="position:absolute;left:20px;top:14px;width:78px;height:78px;display:flex;align-items:center;justify-content:center;border-radius:6px;overflow:hidden"><img src="${school.logo}" style="width:78px;height:78px;object-fit:contain" /></div>`
        : '';

    const phoneEmail = [
        school.phone ? `Phone: ${school.phone}` : '',
        school.email ? `Email: ${school.email}` : ''
    ].filter(Boolean).join(' | ');

    const affiliationRow = (school.affiliationNumber || school.schoolCode || school.udiseCode)
        ? `<div style="display:flex;justify-content:center;gap:15px;margin-top:5px;flex-wrap:wrap">
            ${school.affiliationNumber ? `<span style="font-size:8px;color:#4b5563;font-weight:500;line-height:1.7">Affiliation No: <strong style="font-weight:700;color:#111827">${escapeHtml(school.affiliationNumber)}</strong></span>` : ''}
            ${school.schoolCode ? `<span style="font-size:8px;color:#4b5563;font-weight:500;line-height:1.7">School Code: <strong style="font-weight:700;color:#111827">${escapeHtml(school.schoolCode)}</strong></span>` : ''}
            ${school.udiseCode ? `<span style="font-size:8px;color:#4b5563;font-weight:500;line-height:1.7">UDISE: <strong style="font-weight:700;color:#111827">${escapeHtml(school.udiseCode)}</strong></span>` : ''}
          </div>` : '';

    const action = mode === 'download' ? '' : `
    <div class="toolbar">
      <span class="toolbar-title">Circular ${escapeHtml(circular.circularNumber)} — ${escapeHtml(circular.title)}</span>
      <button class="tbtn tbtn-print" onclick="window.print()">Print</button>
      <button class="tbtn tbtn-close" onclick="window.close()">Close</button>
    </div>`;

    const autoPrint = mode === 'print' ? `<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),350)});</script>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Circular ${escapeHtml(circular.circularNumber)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  @page{size:A4 portrait;margin:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#e5e7eb;color:#111827;font-size:13px;-webkit-font-smoothing:antialiased}
  .page{width:210mm;height:297mm;position:relative;overflow:hidden;background:#f9fafb;margin:0 auto;page-break-after:avoid}
  .card{position:absolute;top:5mm;left:5mm;right:5mm;bottom:5mm;background:#fff;border-radius:14px;box-shadow:0 2px 24px rgba(0,0,0,0.07);overflow:hidden;display:flex;flex-direction:column}
  .deco{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;border-radius:14px}
  .deco .c1{position:absolute;top:-60px;right:-40px;width:240px;height:240px;background:rgba(62,196,177,0.06);border-radius:50%}
  .deco .c2{position:absolute;bottom:-40px;left:-45px;width:195px;height:195px;background:rgba(62,196,177,0.05);border-radius:50%}
  .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-family:Georgia,serif;font-size:64px;font-weight:700;color:rgba(62,196,177,0.05);letter-spacing:14px;white-space:nowrap;z-index:0;pointer-events:none;text-transform:uppercase}
  .content{position:relative;z-index:1;display:flex;flex-direction:column;flex:1;padding:0 0 22px 0}
  .header{position:relative;padding:16px 20px 10px;text-align:center;flex-shrink:0}
  .school-name{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:21px;font-weight:800;color:#1F6F6D;letter-spacing:2px;line-height:1.1;text-transform:uppercase;white-space:nowrap}
  .school-tagline{font-size:8.5px;color:#0a5c56;font-weight:600;font-style:italic;margin-top:2px;letter-spacing:0.4px}
  .school-meta{font-size:9px;color:#4b5563;font-weight:500;margin-top:3px;line-height:1.5}
  .header-divider{height:1px;background:#e5e7eb;margin:0 20px;flex-shrink:0}
  .body-wrap{padding:0 26px;display:flex;flex-direction:column;flex:1}
  .badge-row{display:flex;justify-content:center;margin:18px 0 10px}
  .badge{background:#edf9f7;border-radius:10px;padding:8px 24px;display:inline-flex;flex-direction:column;align-items:center}
  .badge-title{font-size:13px;font-weight:700;color:#0a5c56;letter-spacing:3.5px;text-transform:uppercase;line-height:1}
  .badge-line{width:50px;height:2px;margin-top:6px;background:linear-gradient(90deg,transparent,#3EC4B1,transparent);border-radius:2px}
  .meta-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:10px;color:#374151;flex-wrap:wrap;gap:6px}
  .meta-row strong{color:#111827;font-weight:700}
  .meta-row .num{color:#0a5c56;font-weight:700}
  .info-grid{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin-top:14px;font-size:10.5px}
  .info-grid .lbl{color:#6b7280;font-weight:600;text-transform:uppercase;font-size:8.5px;letter-spacing:0.6px;padding-top:2px}
  .info-grid .val{color:#111827;font-weight:600}
  .subject{margin-top:16px;padding:10px 14px;background:#fff7ed;border-left:4px solid #f59e0b;border-radius:6px}
  .subject-lbl{font-size:8.5px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px}
  .subject-text{font-size:11.5px;font-weight:700;color:#111827;line-height:1.45}
  .body{margin-top:16px;font-size:11px;color:#1f2937;line-height:1.85;text-align:justify;white-space:normal}
  .signature{margin-top:auto;padding-top:24px;display:flex;justify-content:flex-end}
  .sig-block{text-align:center;min-width:240px;display:flex;flex-direction:column;align-items:center}
  .sig-img{max-height:120px;max-width:240px;object-fit:contain;margin-bottom:-8px}
  .sig-line{width:150px;height:1px;background:#9ca3af;margin:4px auto 4px}
  .sig-line-empty{width:150px;height:1px;background:#9ca3af;margin:60px auto 4px}
  .sig-name{font-size:11px;font-weight:700;color:#111827}
  .sig-desig{font-size:9px;color:#4b5563;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin-top:1px}
  .footer{padding:8px 0 0;border-top:1px solid #e5e7eb;text-align:center;margin-top:14px}
  .footer span{font-size:7.5px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:1.4px}
  .footer .brand{font-weight:700;color:#0f766e}
  .toolbar{position:fixed;top:0;left:0;right:0;background:#1C1C1E;color:#fff;padding:10px 24px;display:flex;gap:10px;align-items:center;z-index:999}
  .toolbar-title{flex:1;font-size:13px;font-weight:500}
  .tbtn{padding:7px 18px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:opacity .15s}
  .tbtn:hover{opacity:.85}
  .tbtn-print{background:#3EC4B1;color:#fff}
  .tbtn-close{background:#38383A;color:#8E8E93}
  .page-body{padding-top:${mode === 'download' ? '0' : '54px'};display:flex;justify-content:center;padding-bottom:40px}
  @media print{
    .toolbar{display:none!important}
    .page-body{padding:0!important;display:block!important}
    html,body{margin:0!important;padding:0!important;background:#fff!important;width:210mm;height:297mm}
    .page{box-shadow:none;margin:0!important;width:210mm!important;height:297mm!important}
  }
</style>
</head>
<body>
${action}
<div class="page-body">
  <div class="page">
    <div class="card">
      <div class="deco"><div class="c1"></div><div class="c2"></div></div>
      <div class="watermark">CIRCULAR</div>
      <div class="content">
        <div class="header">
          ${logoHtml}
          <div class="school-name">${escapeHtml(school.name || 'School Name')}</div>
          ${school.tagline ? `<div class="school-tagline">${escapeHtml(school.tagline)}</div>` : ''}
          ${school.address ? `<div class="school-meta">${escapeHtml(school.address)}</div>` : ''}
          ${phoneEmail ? `<div class="school-meta">${escapeHtml(phoneEmail)}</div>` : ''}
          ${affiliationRow}
        </div>
        <div class="header-divider"></div>

        <div class="body-wrap">
          <div class="badge-row">
            <div class="badge">
              <div class="badge-title">Circular</div>
              <div class="badge-line"></div>
            </div>
          </div>

          <div class="meta-row">
            <div><span class="num">#</span> <strong>${escapeHtml(circular.circularNumber)}</strong></div>
            <div>Date: <strong>${formatDate(circular.issueDate || circular.createdAt)}</strong></div>
          </div>

          <div class="info-grid">
            <div class="lbl">Title</div><div class="val">${escapeHtml(circular.title)}</div>
            <div class="lbl">To</div><div class="val">${escapeHtml(audience)}${classes ? ` — ${escapeHtml(classes)}` : ''}</div>
            ${circular.referenceNumber ? `<div class="lbl">Ref. No.</div><div class="val">${escapeHtml(circular.referenceNumber)}</div>` : ''}
            ${circular.category ? `<div class="lbl">Category</div><div class="val" style="text-transform:capitalize">${escapeHtml(circular.category)}</div>` : ''}
          </div>

          <div class="subject">
            <div class="subject-lbl">Subject</div>
            <div class="subject-text">${escapeHtml(circular.subject)}</div>
          </div>

          <div class="body">${bodyHtml}</div>

          <div class="signature">
            <div class="sig-block">
              ${school.principalSignature
                ? `<img src="${school.principalSignature}" class="sig-img" alt="Principal signature" /><div class="sig-line"></div>`
                : `<div class="sig-line-empty"></div>`}
              <div class="sig-name">${escapeHtml(circular.signedByName || school.principalName || '')}</div>
              <div class="sig-desig">${escapeHtml(circular.signedByDesignation || 'Principal')}</div>
            </div>
          </div>

          <div class="footer">
            <span>Powered by <span class="brand">Learnovo</span> — School Management System</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
${autoPrint}
</body>
</html>`;
};

const downloadHTML = (html, filename) => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const Circulars = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { settings } = useSettings();
    const queryClient = useQueryClient();
    const isAdmin = user?.role === 'admin' || user?.role === 'principal';

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCircular, setEditingCircular] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [previewCircular, setPreviewCircular] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        subject: '',
        body: '',
        category: 'general',
        priority: 'medium',
        targetAudience: ['all'],
        issueDate: new Date().toISOString().split('T')[0],
        signedByName: '',
        signedByDesignation: 'Principal',
        referenceNumber: ''
    });

    const school = useMemo(() => {
        const inst = settings?.institution || {};
        const addr = inst.address;
        let addressStr = '';
        if (typeof addr === 'string') {
            addressStr = addr;
        } else if (addr && typeof addr === 'object') {
            addressStr = [addr.street, addr.city, addr.state, addr.pincode, addr.country]
                .filter(Boolean)
                .join(', ');
        }
        const contact = inst.contact || {};
        return {
            name: inst.name || user?.tenantName || 'School',
            logo: (typeof inst.logo === 'object' ? inst.logo?.url : inst.logo) || '',
            address: addressStr,
            phone: contact.phone || inst.phone || '',
            email: contact.email || inst.email || '',
            website: contact.website || '',
            affiliationNumber: inst.affiliationNumber || '',
            schoolCode: inst.schoolCode || '',
            udiseCode: inst.udiseCode || '',
            board: inst.board || '',
            tagline: inst.tagline || '',
            principalName: inst.principalName || '',
            principalSignature: (typeof inst.principalSignature === 'object'
                ? inst.principalSignature?.url
                : inst.principalSignature) || ''
        };
    }, [settings, user]);

    const { data: circulars = [], isLoading } = useQuery({
        queryKey: ['circulars', categoryFilter],
        queryFn: async () => {
            const params = { limit: 100 };
            if (categoryFilter) params.category = categoryFilter;
            const res = await circularsService.getCirculars(params);
            return res.data || [];
        }
    });

    const filteredCirculars = useMemo(() => {
        if (!searchText.trim()) return circulars;
        const q = searchText.toLowerCase().trim();
        return circulars.filter(c =>
            (c.title || '').toLowerCase().includes(q) ||
            (c.subject || '').toLowerCase().includes(q) ||
            (c.circularNumber || '').toLowerCase().includes(q) ||
            (c.body || '').toLowerCase().includes(q)
        );
    }, [circulars, searchText]);

    const createMutation = useMutation({
        mutationFn: (payload) => circularsService.createCircular(payload),
        onSuccess: () => {
            toast.success('Circular created and notifications are being sent');
            setShowCreateModal(false);
            setFormData({
                title: '', subject: '', body: '', category: 'general', priority: 'medium',
                targetAudience: ['all'], issueDate: new Date().toISOString().split('T')[0],
                signedByName: '', signedByDesignation: 'Principal', referenceNumber: ''
            });
            queryClient.invalidateQueries({ queryKey: ['circulars'] });
        },
        onError: (err) => {
            const msg = err?.response?.data?.errors?.[0]?.msg
                || err?.response?.data?.message
                || 'Failed to create circular';
            toast.error(msg);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }) => circularsService.updateCircular(id, payload),
        onSuccess: () => {
            toast.success('Circular updated');
            setShowCreateModal(false);
            setEditingCircular(null);
            setFormData({
                title: '', subject: '', body: '', category: 'general', priority: 'medium',
                targetAudience: ['all'], issueDate: new Date().toISOString().split('T')[0],
                signedByName: '', signedByDesignation: 'Principal', referenceNumber: ''
            });
            queryClient.invalidateQueries({ queryKey: ['circulars'] });
        },
        onError: (err) => {
            const msg = err?.response?.data?.errors?.[0]?.msg
                || err?.response?.data?.message
                || 'Failed to update circular';
            toast.error(msg);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => circularsService.deleteCircular(id),
        onMutate: (id) => setDeletingId(id),
        onSuccess: () => {
            toast.success('Circular deleted');
            queryClient.invalidateQueries({ queryKey: ['circulars'] });
            setDeletingId(null);
        },
        onError: () => {
            toast.error('Failed to delete circular');
            setDeletingId(null);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (createMutation.isPending || updateMutation.isPending) return;
        if (!formData.title.trim() || !formData.subject.trim() || !formData.body.trim()) {
            toast.error('Title, subject, and body are required');
            return;
        }
        if (!formData.targetAudience || formData.targetAudience.length === 0) {
            toast.error('Please select at least one audience');
            return;
        }
        if (editingCircular) {
            updateMutation.mutate({ id: editingCircular._id, payload: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (c) => {
        setEditingCircular(c);
        setFormData({
            title: c.title || '',
            subject: c.subject || '',
            body: c.body || '',
            category: c.category || 'general',
            priority: c.priority || 'medium',
            targetAudience: (c.targetAudience && c.targetAudience.length > 0) ? c.targetAudience : ['all'],
            issueDate: c.issueDate
                ? new Date(c.issueDate).toISOString().split('T')[0]
                : (c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
            signedByName: c.signedByName || '',
            signedByDesignation: c.signedByDesignation || 'Principal',
            referenceNumber: c.referenceNumber || ''
        });
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setEditingCircular(null);
        setFormData({
            title: '', subject: '', body: '', category: 'general', priority: 'medium',
            targetAudience: ['all'], issueDate: new Date().toISOString().split('T')[0],
            signedByName: '', signedByDesignation: 'Principal', referenceNumber: ''
        });
    };

    const handleAudienceChange = (audience) => {
        if (audience === 'all') {
            setFormData({ ...formData, targetAudience: ['all'] });
        } else {
            const current = formData.targetAudience.filter(a => a !== 'all');
            if (current.includes(audience)) {
                const next = current.filter(a => a !== audience);
                setFormData({ ...formData, targetAudience: next.length > 0 ? next : ['all'] });
            } else {
                setFormData({ ...formData, targetAudience: [...current, audience] });
            }
        }
    };

    const handlePrint = (circular) => {
        const html = buildCircularHTML(circular, school, 'print');
        openPrintWindow(html);
    };

    const handleDownload = (circular) => {
        const html = buildCircularHTML(circular, school, 'download');
        const safeNum = (circular.circularNumber || 'circular').replace(/[^a-z0-9]/gi, '_');
        downloadHTML(html, `${safeNum}.html`);
    };

    const handleDelete = (id) => {
        if (!window.confirm('Delete this circular? This cannot be undone.')) return;
        deleteMutation.mutate(id);
    };

    const getCategoryStyle = (category) => {
        const map = {
            urgent: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
            holiday: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
            event: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
            exam: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
            fee: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
            academic: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
            general: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-[#8E8E93]',
            other: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-[#8E8E93]'
        };
        return map[category] || map.general;
    };

    const getPriorityBorder = (priority) => {
        if (priority === 'high') return 'border-l-red-500';
        if (priority === 'medium') return 'border-l-yellow-500';
        return 'border-l-blue-500';
    };

    if (isLoading) {
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
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Circulars</h1>
                        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                            {isAdmin
                                ? 'Issue, share, print, and archive school circulars'
                                : 'View and download school circulars'}
                        </p>
                    </div>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                        <Plus className="h-4 w-4" />
                        New Circular
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                    <input
                        className="input pl-9 w-full"
                        placeholder="Search circulars..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                </div>
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white sm:w-48"
                >
                    <option value="">All categories</option>
                    {CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>
            </div>

            {/* List */}
            {filteredCirculars.length === 0 ? (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-6 sm:p-12 text-center">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-6 w-6 text-gray-400 dark:text-[#636366]" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                        {searchText.trim() || categoryFilter ? 'No matching circulars' : 'No circulars yet'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                        {isAdmin
                            ? 'Create your first circular to share with students, teachers, and parents'
                            : 'No circulars have been issued yet'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredCirculars.map((c) => (
                        <div
                            key={c._id}
                            className={`bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4 sm:p-6 border-l-4 ${getPriorityBorder(c.priority)} ${deletingId === c._id ? 'opacity-40 pointer-events-none' : ''}`}
                        >
                            <div className="flex justify-between items-start gap-4 flex-wrap">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className="text-xs font-mono font-semibold text-primary-600 dark:text-primary-400">
                                            {c.circularNumber}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getCategoryStyle(c.category)}`}>
                                            {c.category}
                                        </span>
                                        {c.priority === 'high' && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                Urgent
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{c.title}</h3>
                                    <p className="text-sm font-medium text-gray-700 dark:text-[#C7C7CC] mt-1">
                                        Subject: {c.subject}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-2 line-clamp-2 whitespace-pre-wrap">
                                        {c.body}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => setPreviewCircular(c)}
                                        title="Preview"
                                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handlePrint(c)}
                                        title="Print"
                                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg"
                                    >
                                        <Printer className="h-4 w-4" />
                                    </button>
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleDownload(c)}
                                            title="Download"
                                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg"
                                        >
                                            <Download className="h-4 w-4" />
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleEdit(c)}
                                            title="Edit"
                                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleDelete(c._id)}
                                            title="Delete"
                                            disabled={deletingId === c._id}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-[#8E8E93] mt-4 pt-3 border-t border-gray-100 dark:border-[#38383A]">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDate(c.issueDate || c.createdAt)}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" />
                                    {(c.targetAudience || []).includes('all')
                                        ? 'Everyone'
                                        : (c.targetAudience || []).map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')
                                    }
                                </div>
                                {c.notificationsSent > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5" />
                                        {c.notificationsSent} notified
                                    </div>
                                )}
                                {c.createdBy?.name && (
                                    <div className="flex items-center gap-1.5">
                                        By: {c.createdBy.name}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-[#38383A] sticky top-0 bg-white dark:bg-[#1C1C1E] z-10">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingCircular ? `Edit Circular ${editingCircular.circularNumber}` : 'New Circular'}
                            </h2>
                            <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-full">
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
                                    placeholder="e.g., Annual Sports Day Schedule"
                                    required
                                    maxLength={200}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                    Subject <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                    placeholder="Brief summary line"
                                    required
                                    maxLength={300}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                    Body <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={formData.body}
                                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                    rows={7}
                                    required
                                    maxLength={10000}
                                    placeholder="Write the full circular content..."
                                />
                                <p className="text-xs text-gray-400 mt-1 text-right">{formData.body.length}/10000</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">
                                    Audience <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {AUDIENCE_OPTIONS.map((a) => {
                                        const selected = formData.targetAudience.includes(a);
                                        return (
                                            <button
                                                key={a}
                                                type="button"
                                                onClick={() => handleAudienceChange(a)}
                                                className={`px-3 py-1.5 text-sm rounded-full border transition-colors capitalize ${selected
                                                    ? 'bg-primary-50 dark:bg-primary-500/20 border-primary-300 dark:border-primary-500/40 text-primary-700 dark:text-primary-400 font-medium'
                                                    : 'border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                                                    }`}
                                            >
                                                {a === 'all' ? 'Everyone' : a}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
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
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Issue Date</label>
                                    <DatePicker
                                        value={formData.issueDate}
                                        onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                                        placeholder="Select date"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Reference No. (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.referenceNumber}
                                        onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                        placeholder="External ref. (if any)"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Signed By (Name)</label>
                                    <input
                                        type="text"
                                        value={formData.signedByName}
                                        onChange={(e) => setFormData({ ...formData, signedByName: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                        placeholder="Principal's name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Designation</label>
                                    <input
                                        type="text"
                                        value={formData.signedByDesignation}
                                        onChange={(e) => setFormData({ ...formData, signedByDesignation: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                        placeholder="e.g., Principal"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100 dark:border-[#38383A]">
                                <button type="button" onClick={handleCloseModal} className="btn btn-outline w-full sm:w-auto">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="btn btn-primary w-full sm:w-auto"
                                >
                                    {editingCircular
                                        ? (updateMutation.isPending ? 'Saving...' : 'Save Changes')
                                        : (createMutation.isPending ? 'Publishing...' : 'Publish & Notify')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Preview Modal */}
            {previewCircular && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-[#38383A]">
                            <div className="flex items-center gap-3 min-w-0">
                                <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-mono text-gray-500 dark:text-[#8E8E93]">{previewCircular.circularNumber}</p>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{previewCircular.title}</h3>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    onClick={() => handlePrint(previewCircular)}
                                    className="btn btn-outline flex items-center gap-2 text-sm"
                                >
                                    <Printer className="h-4 w-4" /> Print
                                </button>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDownload(previewCircular)}
                                        className="btn btn-primary flex items-center gap-2 text-sm"
                                    >
                                        <Download className="h-4 w-4" /> Download
                                    </button>
                                )}
                                <button onClick={() => setPreviewCircular(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-full">
                                    <X className="h-5 w-5 text-gray-400" />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto p-6 bg-gray-50 dark:bg-black/30">
                            <iframe
                                title="Circular preview"
                                srcDoc={buildCircularHTML(previewCircular, school, 'download')}
                                className="w-full bg-white rounded-xl shadow-md"
                                style={{ minHeight: '720px', border: 'none' }}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Circulars;
