import React, { useEffect, useMemo, useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, HelpCircle, XCircle, Clock, FileText, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import bankReconciliationService from '../../services/bankReconciliationService';
import { formatDate } from '../../utils/formatDate';

const SOURCE_OPTIONS = [
  { value: 'GENERIC', label: 'Generic bank CSV' },
  { value: 'RAZORPAY', label: 'Razorpay settlement' },
  { value: 'ICICI', label: 'ICICI EazyPay MIS' },
];

const CLASSIFICATION_META = {
  MATCHED_CONFIRMED: { label: 'Matched', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10', Icon: CheckCircle2 },
  BANK_ONLY: { label: 'Bank only — needs confirm', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', Icon: AlertTriangle },
  AMBIGUOUS: { label: 'Ambiguous', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10', Icon: HelpCircle },
  LEARNOVO_ONLY: { label: 'Learnovo only', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10', Icon: XCircle },
  IGNORED: { label: 'Ignored', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/40', Icon: XCircle },
  ACTIONED: { label: 'Confirmed via reconciliation', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', Icon: CheckCircle2 },
};

function SummaryCard({ label, value, tone = 'gray' }) {
  const toneClass = {
    gray: 'bg-gray-50 dark:bg-[#1C1C1E] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800',
    green: 'bg-green-50 dark:bg-green-900/10 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800/40',
    amber: 'bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40',
    purple: 'bg-purple-50 dark:bg-purple-900/10 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
    blue: 'bg-blue-50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value ?? 0}</div>
    </div>
  );
}

function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [source, setSource] = useState('GENERIC');
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Select a CSV or Excel file');
    setUploading(true);
    try {
      const res = await bankReconciliationService.uploadFile(file, source);
      if (res?.success) {
        toast.success('File processed');
        setFile(null);
        onUploaded?.(res.data);
      } else {
        toast.error(res?.message || 'Upload failed');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
        <Upload className="h-5 w-5" /> Upload bank settlement file
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Upload the merchant MIS CSV/Excel you received from the bank. Accepted: .csv, .xlsx, .xls (max 10MB).
        The engine will match rows against existing payment attempts, flag bank credits missing from Learnovo, and let you confirm them in one click.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Source</label>
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2A2A2C] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">File</label>
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 hover:file:bg-indigo-100"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={uploading || !file}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 text-sm font-medium transition"
        >
          {uploading ? 'Processing…' : 'Upload & match'}
        </button>
      </div>
    </form>
  );
}

function BatchesList({ batches, loading, onOpen }) {
  if (loading) {
    return <div className="py-10 text-center text-gray-500 dark:text-gray-400">Loading…</div>;
  }
  if (!batches.length) {
    return (
      <div className="py-10 text-center text-gray-500 dark:text-gray-400">
        No reconciliation batches yet. Upload a bank MIS file above to get started.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-800 rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-[#2A2A2C] text-gray-600 dark:text-gray-400 text-left">
          <tr>
            <th className="px-4 py-3">Uploaded</th>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Rows</th>
            <th className="px-4 py-3">Needs action</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {batches.map(b => (
            <tr key={b._id} className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(b.createdAt)}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FileText className="h-4 w-4 opacity-60" /> {b.originalFilename || '—'}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{b.source}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{b.summary?.total ?? 0}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  {b.summary?.bankOnly ?? 0} bank-only
                </span>
                {b.summary?.ambiguous > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-purple-700 dark:text-purple-400">
                    {b.summary.ambiguous} ambiguous
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.status === 'CLOSED' ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'}`}>
                  {b.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onOpen(b._id)}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  Open →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ row, batchId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(
    row.candidateInvoiceIds?.length === 1 ? (row.candidateInvoiceIds[0]?._id || row.candidateInvoiceIds[0]) : ''
  );

  const isActionable = row.classification === 'BANK_ONLY' || row.classification === 'AMBIGUOUS';
  if (!isActionable) return null;

  const confirm = async () => {
    if (!selectedInvoice && (row.candidateInvoiceIds?.length || 0) !== 1) {
      toast.error('Select an invoice to allocate this payment to');
      return;
    }
    setBusy(true);
    try {
      const payload = {};
      if (selectedInvoice) payload.invoiceId = selectedInvoice;
      if (note) payload.note = note;
      const res = await bankReconciliationService.confirmRow(batchId, row._id, payload);
      if (res?.success) {
        toast.success(`Payment confirmed (receipt ${res.data.receiptNumber})`);
        onChanged?.();
      } else {
        toast.error(res?.message || 'Failed');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to confirm');
    } finally {
      setBusy(false);
    }
  };

  const ignore = async () => {
    setBusy(true);
    try {
      await bankReconciliationService.ignoreRow(batchId, row._id, note);
      toast.success('Row ignored');
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const invoices = (row.candidateInvoiceIds || []).map(ci =>
    typeof ci === 'object' ? ci : { _id: ci, invoiceNumber: String(ci).slice(-6) }
  );

  return (
    <div className="mt-2 space-y-2">
      {invoices.length > 1 && (
        <select
          value={selectedInvoice}
          onChange={e => setSelectedInvoice(e.target.value)}
          className="w-full text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2A2A2C] px-2 py-1"
        >
          <option value="">Choose invoice…</option>
          {invoices.map(inv => (
            <option key={inv._id} value={inv._id}>
              {inv.invoiceNumber} {inv.periodLabel ? `• ${inv.periodLabel}` : ''} {inv.balanceAmount != null ? `• bal ₹${inv.balanceAmount}` : ''}
            </option>
          ))}
        </select>
      )}
      <input
        type="text"
        placeholder="Optional note"
        value={note}
        onChange={e => setNote(e.target.value)}
        className="w-full text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2A2A2C] px-2 py-1"
      />
      <div className="flex gap-2">
        <button
          onClick={confirm}
          disabled={busy}
          className="text-xs rounded bg-green-600 hover:bg-green-700 text-white px-3 py-1 disabled:bg-gray-400"
        >
          Confirm payment
        </button>
        <button
          onClick={ignore}
          disabled={busy}
          className="text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1 hover:bg-gray-300"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}

function BatchDetail({ batchId, onBack }) {
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const res = await bankReconciliationService.getBatch(batchId);
      if (res?.success) setBatch(res.data);
    } catch (err) {
      toast.error('Failed to load batch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [batchId]);

  const filteredRows = useMemo(() => {
    if (!batch) return [];
    if (filter === 'ALL') return batch.rows;
    return batch.rows.filter(r => r.classification === filter);
  }, [batch, filter]);

  if (loading) return <div className="py-10 text-center text-gray-500">Loading…</div>;
  if (!batch) return <div className="py-10 text-center text-gray-500">Batch not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {batch.originalFilename || 'batch'} • uploaded {formatDate(batch.createdAt)}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total rows" value={batch.summary?.total} tone="gray" />
        <SummaryCard label="Matched" value={batch.summary?.matchedConfirmed} tone="green" />
        <SummaryCard label="Needs confirm" value={batch.summary?.bankOnly} tone="amber" />
        <SummaryCard label="Ambiguous" value={batch.summary?.ambiguous} tone="purple" />
        <SummaryCard label="Actioned" value={batch.summary?.actioned} tone="blue" />
      </div>

      <div className="flex flex-wrap gap-2">
        {['ALL', 'BANK_ONLY', 'AMBIGUOUS', 'MATCHED_CONFIRMED', 'ACTIONED', 'IGNORED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-[#1C1C1E] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
          >
            {f === 'ALL' ? 'All' : (CLASSIFICATION_META[f]?.label || f)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-800 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-[#2A2A2C] text-gray-600 dark:text-gray-400 text-left">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">UTR / Ref</th>
              <th className="px-4 py-3">Order / Payment ID</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => {
              const meta = CLASSIFICATION_META[row.classification] || CLASSIFICATION_META.IGNORED;
              const Icon = meta.Icon;
              return (
                <tr key={row._id} className="border-t border-gray-100 dark:border-gray-800 align-top">
                  <td className="px-4 py-3 text-gray-500">{row.rowNumber}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.txnDate ? formatDate(row.txnDate) : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{row.utr || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {row.gatewayOrderId || '—'}
                    {row.gatewayPaymentId && <div className="text-gray-500">{row.gatewayPaymentId}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                    ₹{Number(row.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${meta.bg} ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-[240px]">
                    <RowActions row={row} batchId={batch._id} onChanged={load} />
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-500">No rows in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BankReconciliation() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBatch, setActiveBatch] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await bankReconciliationService.listBatches({ limit: 50 });
      if (res?.success) setBatches(res.data);
    } catch (err) {
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bank Reconciliation</h1>
        <p className="text-gray-500 dark:text-[#8E8E93] mt-2">
          Upload the merchant settlement file from the bank. Any payment that hit the bank but didn't update in Learnovo will be surfaced here — confirm them with one click instead of keying entries by hand.
        </p>
      </div>

      {activeBatch ? (
        <BatchDetail batchId={activeBatch} onBack={() => { setActiveBatch(null); load(); }} />
      ) : (
        <>
          <UploadPanel onUploaded={(data) => { load(); if (data?.batchId) setActiveBatch(data.batchId); }} />
          <BatchesList batches={batches} loading={loading} onOpen={setActiveBatch} />
        </>
      )}
    </div>
  );
}
