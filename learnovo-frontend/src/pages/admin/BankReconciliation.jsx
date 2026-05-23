import React, { useEffect, useMemo, useState } from 'react'
import {
  Upload, CheckCircle2, AlertTriangle, HelpCircle, XCircle, FileText, ArrowLeft,
  ListChecks, Banknote, Filter, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import bankReconciliationService from '../../services/bankReconciliationService'
import { formatDate } from '../../utils/formatDate'
import { formatCurrency } from '../../utils/formatCurrency'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import KpiCard from '../../components/KpiCard'

const SOURCE_OPTIONS = [
  { value: 'ICICI', label: 'ICICI EazyPay / Orange MIS' },
  { value: 'RAZORPAY', label: 'Razorpay settlement' },
  { value: 'GENERIC', label: 'Generic bank CSV' },
]

const CLASSIFICATION_META = {
  MATCHED_CONFIRMED: {
    label: 'Matched',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
    Icon: CheckCircle2,
  },
  BANK_ONLY: {
    label: 'Needs confirm',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
    Icon: AlertTriangle,
  },
  AMBIGUOUS: {
    label: 'Ambiguous',
    badge: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-800',
    Icon: HelpCircle,
  },
  LEARNOVO_ONLY: {
    label: 'Learnovo only',
    badge: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
    Icon: XCircle,
  },
  ACTIONED: {
    label: 'Confirmed',
    badge: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
    Icon: CheckCircle2,
  },
  IGNORED: {
    label: 'Ignored',
    badge: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-800/40 dark:text-[#8E8E93] dark:ring-gray-700',
    Icon: XCircle,
  },
}

const FILTER_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'BANK_ONLY', label: 'Needs confirm' },
  { id: 'AMBIGUOUS', label: 'Ambiguous' },
  { id: 'MATCHED_CONFIRMED', label: 'Matched' },
  { id: 'ACTIONED', label: 'Confirmed' },
  { id: 'IGNORED', label: 'Ignored' },
]

// ── Upload panel ─────────────────────────────────────────────────────────

function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null)
  const [source, setSource] = useState('ICICI')
  const [uploading, setUploading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Select a CSV or Excel file')
    setUploading(true)
    try {
      const res = await bankReconciliationService.uploadFile(file, source)
      if (res?.success) {
        toast.success('File processed')
        setFile(null)
        onUploaded?.(res.data)
      } else {
        toast.error(res?.message || 'Upload failed')
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] ring-1 ring-primary-100 dark:ring-[rgba(62,196,177,0.2)]">
          <Upload className="h-5 w-5 text-primary-600 dark:text-[#3EC4B1]" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Upload settlement file</h2>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">
            CSV or Excel (.xlsx, .xls), up to 10MB. We match each row against existing payment attempts and surface anything that hit the bank but didn&apos;t land in Learnovo.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Source</label>
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="input mt-1.5"
          >
            {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">File</label>
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="mt-1.5 block w-full text-sm text-gray-700 dark:text-[#8E8E93]
              file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-primary-50 file:text-primary-700
              dark:file:bg-[rgba(62,196,177,0.12)] dark:file:text-[#3EC4B1]
              hover:file:bg-primary-100 dark:hover:file:bg-[rgba(62,196,177,0.18)]"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={uploading || !file}
          className="btn btn-primary"
        >
          {uploading ? (
            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" /> Upload &amp; match</>
          )}
        </button>
      </div>
    </form>
  )
}

// ── Batches list ─────────────────────────────────────────────────────────

function BatchesList({ batches, loading, onOpen, onRefresh }) {
  if (loading) {
    return (
      <div className="card p-10 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }
  if (!batches.length) {
    return (
      <div className="card">
        <EmptyState
          icon={ListChecks}
          title="No reconciliation batches yet"
          description="Upload a bank MIS file above to surface payments that hit the bank but didn't update in Learnovo."
        />
      </div>
    )
  }
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-[#2C2C2E]">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent batches</h3>
        <button onClick={onRefresh} className="btn-icon" aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Uploaded</th>
              <th>File</th>
              <th>Source</th>
              <th className="text-right">Rows</th>
              <th>Needs action</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batches.map(b => (
              <tr key={b._id}>
                <td className="text-gray-700 dark:text-white">{formatDate(b.createdAt)}</td>
                <td className="text-gray-700 dark:text-white">
                  <span className="inline-flex items-center gap-2 max-w-[260px] truncate">
                    <FileText className="h-4 w-4 text-gray-400 dark:text-[#8E8E93] flex-shrink-0" />
                    <span className="truncate">{b.originalFilename || '—'}</span>
                  </span>
                </td>
                <td className="text-gray-600 dark:text-[#8E8E93]">{b.source}</td>
                <td className="text-right text-gray-700 dark:text-white font-medium">{b.summary?.total ?? 0}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(b.summary?.bankOnly ?? 0) > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                        {b.summary.bankOnly} to confirm
                      </span>
                    )}
                    {(b.summary?.ambiguous ?? 0) > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                        {b.summary.ambiguous} ambiguous
                      </span>
                    )}
                    {!(b.summary?.bankOnly) && !(b.summary?.ambiguous) && (
                      <span className="text-xs text-gray-400 dark:text-[#636366]">All clear</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    b.status === 'CLOSED'
                      ? 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-800/40 dark:text-[#8E8E93] dark:ring-gray-700'
                      : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800'
                  }`}>
                    {b.status}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => onOpen(b._id)}
                    className="btn btn-sm btn-ghost"
                  >
                    Open →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Per-row action panel ─────────────────────────────────────────────────

function RowActions({ row, batchId, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(
    row.candidateInvoiceIds?.length === 1
      ? (row.candidateInvoiceIds[0]?._id || row.candidateInvoiceIds[0])
      : ''
  )

  const isActionable = row.classification === 'BANK_ONLY' || row.classification === 'AMBIGUOUS'
  if (!isActionable) return null

  const invoices = (row.candidateInvoiceIds || []).map(ci =>
    typeof ci === 'object' ? ci : { _id: ci, invoiceNumber: String(ci).slice(-6) }
  )
  const hasInvoiceChoice = invoices.length > 0
  const needsManualChoice = invoices.length === 0

  const confirm = async () => {
    if (!selectedInvoice && hasInvoiceChoice && invoices.length !== 1) {
      toast.error('Select an invoice to allocate this payment to')
      return
    }
    setBusy(true)
    try {
      const payload = {}
      if (selectedInvoice) payload.invoiceId = selectedInvoice
      if (note) payload.note = note
      const res = await bankReconciliationService.confirmRow(batchId, row._id, payload)
      if (res?.success) {
        toast.success(`Payment confirmed (receipt ${res.data.receiptNumber})`)
        onChanged?.()
      } else {
        toast.error(res?.message || 'Failed')
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to confirm')
    } finally {
      setBusy(false)
    }
  }

  const ignore = async () => {
    setBusy(true)
    try {
      await bankReconciliationService.ignoreRow(batchId, row._id, note)
      toast.success('Row ignored')
      onChanged?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 min-w-[260px]">
      {needsManualChoice ? (
        <div className="text-xs text-gray-500 dark:text-[#8E8E93] italic">
          No matching invoice found. Look up the student manually before confirming.
        </div>
      ) : invoices.length > 1 ? (
        <select
          value={selectedInvoice}
          onChange={e => setSelectedInvoice(e.target.value)}
          className="input h-9 text-xs"
        >
          <option value="">Choose invoice…</option>
          {invoices.map(inv => (
            <option key={inv._id} value={inv._id}>
              {inv.invoiceNumber}
              {inv.periodLabel ? ` • ${inv.periodLabel}` : ''}
              {inv.balanceAmount != null ? ` • bal ₹${inv.balanceAmount}` : ''}
            </option>
          ))}
        </select>
      ) : null}
      <input
        type="text"
        placeholder="Optional note"
        value={note}
        onChange={e => setNote(e.target.value)}
        className="input h-9 text-xs"
      />
      <div className="flex gap-2">
        <button
          onClick={confirm}
          disabled={busy || needsManualChoice}
          className="btn btn-sm btn-primary flex-1"
        >
          {busy ? 'Working…' : 'Confirm payment'}
        </button>
        <button
          onClick={ignore}
          disabled={busy}
          className="btn btn-sm btn-outline"
        >
          Ignore
        </button>
      </div>
    </div>
  )
}

// ── Row raw-data expander (helps debug header mismatches) ────────────────

function RawRowDetail({ raw }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(raw || {}).filter(([, v]) => v !== '' && v != null)
  if (entries.length === 0) return null
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? 'Hide' : 'Show'} source row
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-gray-50 dark:bg-[#2A2A2C] p-2.5 text-[11px] font-mono text-gray-700 dark:text-[#A0A0A5] grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="truncate">
              <span className="text-gray-400 dark:text-[#636366]">{k}:</span> {String(v)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Batch detail ─────────────────────────────────────────────────────────

function BatchDetail({ batchId, onBack }) {
  const [batch, setBatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  const load = async () => {
    setLoading(true)
    try {
      const res = await bankReconciliationService.getBatch(batchId)
      if (res?.success) setBatch(res.data)
    } catch (err) {
      toast.error('Failed to load batch')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [batchId])

  const filteredRows = useMemo(() => {
    if (!batch) return []
    if (filter === 'ALL') return batch.rows
    return batch.rows.filter(r => r.classification === filter)
  }, [batch, filter])

  if (loading) {
    return (
      <div className="card p-10 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }
  if (!batch) {
    return (
      <div className="card p-10 text-center text-gray-500 dark:text-[#8E8E93]">
        Batch not found.
      </div>
    )
  }

  const summary = batch.summary || {}

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="btn btn-sm btn-ghost">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to batches
        </button>
        <div className="text-xs text-gray-500 dark:text-[#8E8E93] inline-flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          <span className="font-medium text-gray-700 dark:text-white">{batch.originalFilename || 'batch'}</span>
          <span>•</span>
          <span>{batch.source}</span>
          <span>•</span>
          <span>uploaded {formatDate(batch.createdAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard title="Total rows" value={summary.total ?? 0} Icon={ListChecks} />
        <KpiCard title="Matched" value={summary.matchedConfirmed ?? 0} Icon={CheckCircle2} />
        <KpiCard title="Needs confirm" value={summary.bankOnly ?? 0} Icon={AlertTriangle} />
        <KpiCard title="Ambiguous" value={summary.ambiguous ?? 0} Icon={HelpCircle} />
        <KpiCard title="Confirmed here" value={summary.actioned ?? 0} Icon={Banknote} />
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-gray-400 dark:text-[#8E8E93]" />
          {FILTER_TABS.map(f => {
            const count = f.id === 'ALL'
              ? (batch.rows?.length ?? 0)
              : (batch.rows || []).filter(r => r.classification === f.id).length
            const active = filter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  active
                    ? 'bg-primary-600 text-white dark:bg-[#3EC4B1] dark:text-black'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#2C2C2E] dark:text-[#8E8E93] dark:hover:bg-[#3A3A3C]'
                }`}
              >
                {f.label} <span className="opacity-70">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Customer / Invoice</th>
                <th>UTR / RRN</th>
                <th>Order &amp; Payment ID</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => {
                const meta = CLASSIFICATION_META[row.classification] || CLASSIFICATION_META.IGNORED
                const Icon = meta.Icon
                return (
                  <tr key={row._id} className="align-top">
                    <td className="text-gray-400 dark:text-[#636366] font-mono text-xs">{row.rowNumber}</td>
                    <td className="text-gray-700 dark:text-white">
                      {row.txnDate ? formatDate(row.txnDate) : <span className="text-gray-400 dark:text-[#636366]">—</span>}
                      {row.paymentMode && (
                        <div className="text-[11px] text-gray-400 dark:text-[#636366] mt-0.5">{row.paymentMode}</div>
                      )}
                    </td>
                    <td className="text-gray-700 dark:text-white">
                      {row.matchedStudentId ? (
                        <div className="text-xs">
                          <div className="font-medium">
                            {row.matchedStudentId.name || row.matchedStudentId.fullName || '—'}
                          </div>
                          {row.matchedStudentId.admissionNumber && (
                            <div className="text-gray-400 dark:text-[#636366]">{row.matchedStudentId.admissionNumber}</div>
                          )}
                        </div>
                      ) : row.customerName ? (
                        <div className="text-xs">
                          <div className="font-medium">{row.customerName}</div>
                          {row.customerId && (
                            <div className="text-gray-400 dark:text-[#636366]">{row.customerId}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-[#636366] text-xs">—</span>
                      )}
                      {row.invoiceNumber && (
                        <div className="text-[11px] text-gray-400 dark:text-[#636366] mt-0.5">
                          Inv {row.invoiceNumber}
                        </div>
                      )}
                    </td>
                    <td className="font-mono text-[11px] text-gray-700 dark:text-white">
                      {row.utr || <span className="text-gray-400 dark:text-[#636366]">—</span>}
                    </td>
                    <td className="font-mono text-[11px] text-gray-700 dark:text-white">
                      {row.gatewayOrderId || <span className="text-gray-400 dark:text-[#636366]">—</span>}
                      {row.gatewayPaymentId && (
                        <div className="text-gray-400 dark:text-[#636366] mt-0.5">{row.gatewayPaymentId}</div>
                      )}
                    </td>
                    <td className="text-right font-semibold text-gray-900 dark:text-white">
                      {row.amount > 0 ? formatCurrency(row.amount) : <span className="text-gray-400 dark:text-[#636366]">—</span>}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${meta.badge}`}>
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                      <RawRowDetail raw={row.raw} />
                    </td>
                    <td>
                      <RowActions row={row} batchId={batch._id} onChanged={load} />
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center text-gray-500 dark:text-[#8E8E93] py-10">
                    No rows in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Page shell ───────────────────────────────────────────────────────────

export default function BankReconciliation() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeBatch, setActiveBatch] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await bankReconciliationService.listBatches({ limit: 50 })
      if (res?.success) setBatches(res.data)
    } catch (err) {
      toast.error('Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Bank Reconciliation
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1.5 max-w-3xl">
          Upload the merchant settlement file from your bank. We&apos;ll match each row to existing
          payment attempts and surface anything that hit the bank but didn&apos;t land in
          Learnovo — confirm them with one click instead of keying entries by hand.
        </p>
      </div>

      {activeBatch ? (
        <BatchDetail batchId={activeBatch} onBack={() => { setActiveBatch(null); load() }} />
      ) : (
        <>
          <UploadPanel onUploaded={(data) => { load(); if (data?.batchId) setActiveBatch(data.batchId) }} />
          <BatchesList batches={batches} loading={loading} onOpen={setActiveBatch} onRefresh={load} />
        </>
      )}
    </div>
  )
}
