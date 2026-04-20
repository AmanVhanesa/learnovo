const FeePaymentOrder = require('../models/FeePaymentOrder');
const PaymentAttempt = require('../models/PaymentAttempt');
const Payment = require('../models/Payment');
const FeeInvoice = require('../models/FeeInvoice');
const BankReconciliationBatch = require('../models/BankReconciliationBatch');
const ImportExportService = require('./importExportService');
const { confirmFeePayment } = require('./paymentConfirmationService');
const { moneyEquals } = require('../utils/money');

const HEADER_ALIASES = {
  utr: ['utr', 'utr no', 'utr_no', 'utrnumber', 'utr number', 'rrn', 'bankreference', 'bank reference'],
  gatewayOrderId: ['order id', 'order_id', 'orderid', 'merchant order id', 'merchant_order_id', 'merchantorderid'],
  gatewayPaymentId: ['payment id', 'payment_id', 'paymentid', 'transaction id', 'transaction_id', 'txn id', 'txn_id', 'txnid'],
  amount: ['amount', 'amt', 'txn amount', 'transaction amount', 'credit amount', 'settlement amount'],
  txnDate: ['date', 'txn date', 'transaction date', 'settlement date', 'value date'],
  bankStatus: ['status', 'txn status', 'transaction status']
};

function normaliseHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ').replace(/\s+/g, ' ');
}

function mapRow(rawRow) {
  const mapped = { raw: { ...rawRow } };
  delete mapped.raw._rowNumber;

  const byNormalised = {};
  for (const [key, val] of Object.entries(rawRow)) {
    if (key === '_rowNumber') continue;
    byNormalised[normaliseHeader(key)] = val;
  }

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const val = byNormalised[normaliseHeader(alias)];
      if (val != null && String(val).trim() !== '') {
        mapped[field] = String(val).trim();
        break;
      }
    }
  }

  return mapped;
}

function parseAmount(val) {
  if (val == null) return NaN;
  const cleaned = String(val).replace(/[,\s₹$]/g, '');
  return parseFloat(cleaned);
}

function parseDate(val) {
  if (!val) return null;
  const trimmed = String(val).trim();
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
    const dt = new Date(year, parseInt(m, 10) - 1, parseInt(d, 10));
    if (!isNaN(dt.getTime())) return dt;
  }
  const native = new Date(trimmed);
  return isNaN(native.getTime()) ? null : native;
}

async function findCandidates(tenantId, row) {
  const candidates = { orders: [], attempts: [] };

  if (row.gatewayOrderId) {
    const orders = await FeePaymentOrder.find({
      tenantId,
      razorpayOrderId: row.gatewayOrderId
    }).select('_id invoiceId studentId amount status razorpayPaymentId').lean();
    candidates.orders.push(...orders);
  }

  if (row.gatewayPaymentId && candidates.orders.length === 0) {
    const orders = await FeePaymentOrder.find({
      tenantId,
      razorpayPaymentId: row.gatewayPaymentId
    }).select('_id invoiceId studentId amount status razorpayPaymentId').lean();
    candidates.orders.push(...orders);
  }

  if (row.gatewayOrderId || row.gatewayPaymentId) {
    const ref = row.gatewayPaymentId || row.gatewayOrderId;
    const attempts = await PaymentAttempt.find({
      tenantId,
      gatewayRefId: ref
    }).select('_id invoiceId studentId amount status').lean();
    candidates.attempts.push(...attempts);
  }

  if (candidates.orders.length === 0 && candidates.attempts.length === 0 && row.txnDate && row.amount > 0) {
    const windowMs = 3 * 24 * 60 * 60 * 1000;
    const windowStart = new Date(row.txnDate.getTime() - windowMs);
    const windowEnd = new Date(row.txnDate.getTime() + windowMs);

    const fuzzyOrders = await FeePaymentOrder.find({
      tenantId,
      status: { $in: ['created', 'paid'] },
      amount: { $gte: row.amount - 0.5, $lte: row.amount + 0.5 },
      createdAt: { $gte: windowStart, $lte: windowEnd }
    }).select('_id invoiceId studentId amount status razorpayOrderId').limit(10).lean();
    candidates.orders.push(...fuzzyOrders);
  }

  return candidates;
}

async function isAlreadyPaidInLearnovo(tenantId, row) {
  const refs = [row.gatewayPaymentId, row.gatewayOrderId, row.utr].filter(Boolean);
  if (refs.length === 0) return null;

  const payment = await Payment.findOne({
    tenantId,
    isReversed: false,
    $or: [
      { 'transactionDetails.transactionId': { $in: refs } },
      { 'transactionDetails.referenceNumber': { $in: refs } }
    ]
  }).select('_id receiptNumber invoiceId studentId').lean();

  return payment || null;
}

function classifyRow(row, candidates, existingPayment) {
  if (existingPayment) return 'MATCHED_CONFIRMED';

  const confirmedOrder = candidates.orders.find(o => o.status === 'paid');
  if (confirmedOrder) return 'MATCHED_CONFIRMED';

  const matchingCandidates = [
    ...candidates.orders.filter(o => moneyEquals(o.amount, row.amount)),
    ...candidates.attempts.filter(a => moneyEquals(a.amount, row.amount))
  ];

  if (matchingCandidates.length === 1) return 'BANK_ONLY';
  if (matchingCandidates.length > 1) return 'AMBIGUOUS';
  if (candidates.orders.length + candidates.attempts.length > 0) return 'AMBIGUOUS';

  return 'BANK_ONLY';
}

async function processUploadedFile({ tenantId, userId, fileBuffer, filename, source = 'GENERIC' }) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  let rawRows;
  if (ext === 'xlsx' || ext === 'xls') {
    rawRows = await ImportExportService.parseExcelBuffer(fileBuffer);
  } else {
    rawRows = await ImportExportService.parseCSVBuffer(fileBuffer);
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error('Uploaded file has no rows');
  }

  const rows = [];
  let minDate = null;
  let maxDate = null;

  for (const rawRow of rawRows) {
    const rowNumber = rawRow._rowNumber || rows.length + 1;
    const mapped = mapRow(rawRow);
    const amount = parseAmount(mapped.amount);
    const txnDate = parseDate(mapped.txnDate);

    if (!(amount > 0)) {
      rows.push({
        rowNumber,
        raw: mapped.raw,
        utr: mapped.utr || null,
        gatewayOrderId: mapped.gatewayOrderId || null,
        gatewayPaymentId: mapped.gatewayPaymentId || null,
        amount: 0,
        txnDate: null,
        bankStatus: mapped.bankStatus || null,
        classification: 'IGNORED',
        candidateOrderIds: [],
        candidateAttemptIds: [],
        candidateInvoiceIds: []
      });
      continue;
    }

    if (txnDate) {
      if (!minDate || txnDate < minDate) minDate = txnDate;
      if (!maxDate || txnDate > maxDate) maxDate = txnDate;
    }

    const searchRow = {
      utr: mapped.utr,
      gatewayOrderId: mapped.gatewayOrderId,
      gatewayPaymentId: mapped.gatewayPaymentId,
      amount,
      txnDate
    };

    const candidates = await findCandidates(tenantId, searchRow);
    const existingPayment = await isAlreadyPaidInLearnovo(tenantId, searchRow);
    const classification = classifyRow(searchRow, candidates, existingPayment);

    const candidateInvoiceIds = [
      ...candidates.orders.map(o => o.invoiceId),
      ...candidates.attempts.map(a => a.invoiceId)
    ].filter(Boolean);

    rows.push({
      rowNumber,
      raw: mapped.raw,
      utr: mapped.utr || null,
      gatewayOrderId: mapped.gatewayOrderId || null,
      gatewayPaymentId: mapped.gatewayPaymentId || null,
      amount,
      txnDate,
      bankStatus: mapped.bankStatus || null,
      classification,
      candidateOrderIds: candidates.orders.map(o => o._id),
      candidateAttemptIds: candidates.attempts.map(a => a._id),
      candidateInvoiceIds,
      matchedPaymentId: existingPayment?._id,
      matchedInvoiceId: existingPayment?.invoiceId,
      matchedStudentId: existingPayment?.studentId
    });
  }

  const summary = {
    total: rows.length,
    matchedConfirmed: rows.filter(r => r.classification === 'MATCHED_CONFIRMED').length,
    bankOnly: rows.filter(r => r.classification === 'BANK_ONLY').length,
    ambiguous: rows.filter(r => r.classification === 'AMBIGUOUS').length,
    learnovoOnly: 0,
    ignored: rows.filter(r => r.classification === 'IGNORED').length,
    actioned: 0
  };

  const batch = await BankReconciliationBatch.create({
    tenantId,
    source,
    originalFilename: filename,
    uploadedBy: userId,
    periodStart: minDate,
    periodEnd: maxDate,
    rows,
    summary,
    status: 'READY'
  });

  return batch;
}

async function confirmRow({ tenantId, batchId, rowId, invoiceId, userId, note }) {
  const batch = await BankReconciliationBatch.findOne({ _id: batchId, tenantId });
  if (!batch) throw new Error('Reconciliation batch not found');

  const row = batch.rows.id(rowId);
  if (!row) throw new Error('Row not found in batch');

  if (row.classification === 'MATCHED_CONFIRMED' || row.classification === 'ACTIONED') {
    throw new Error('Row is already reconciled');
  }

  let resolvedInvoiceId = invoiceId;
  if (!resolvedInvoiceId) {
    if (row.candidateInvoiceIds?.length === 1) {
      resolvedInvoiceId = row.candidateInvoiceIds[0];
    } else {
      throw new Error('invoiceId is required (multiple or zero candidates)');
    }
  }

  const invoice = await FeeInvoice.findOne({ _id: resolvedInvoiceId, tenantId }).select('_id studentId').lean();
  if (!invoice) throw new Error('Invoice not found for this tenant');

  let orderDocId = null;
  if (row.candidateOrderIds?.length === 1) orderDocId = row.candidateOrderIds[0];

  const result = await confirmFeePayment({
    tenantId,
    invoiceId: resolvedInvoiceId,
    amount: row.amount,
    paymentMethod: 'Online',
    gatewayOrderId: row.gatewayOrderId || undefined,
    gatewayPaymentId: row.gatewayPaymentId || undefined,
    orderDocId,
    actorUserId: userId,
    source: 'BANK_RECONCILIATION',
    remarks: note
      ? `Bank MIS reconciliation — ${note}`
      : `Bank MIS reconciliation (${row.utr ? `UTR ${row.utr}` : row.gatewayOrderId || 'manual'})`
  });

  row.classification = 'ACTIONED';
  row.matchedPaymentId = result.paymentId;
  row.matchedInvoiceId = resolvedInvoiceId;
  row.matchedStudentId = invoice.studentId;
  row.actionedAt = new Date();
  row.actionedBy = userId;
  row.actionNote = note;

  batch.summary.actioned = (batch.summary.actioned || 0) + 1;
  batch.summary.bankOnly = Math.max(0, (batch.summary.bankOnly || 0) - 1);

  await batch.save();

  return { batch, result };
}

async function ignoreRow({ tenantId, batchId, rowId, userId, note }) {
  const batch = await BankReconciliationBatch.findOne({ _id: batchId, tenantId });
  if (!batch) throw new Error('Reconciliation batch not found');
  const row = batch.rows.id(rowId);
  if (!row) throw new Error('Row not found in batch');

  const prev = row.classification;
  row.classification = 'IGNORED';
  row.actionedAt = new Date();
  row.actionedBy = userId;
  row.actionNote = note;

  batch.summary.ignored = (batch.summary.ignored || 0) + 1;
  if (prev === 'BANK_ONLY') batch.summary.bankOnly = Math.max(0, batch.summary.bankOnly - 1);
  if (prev === 'AMBIGUOUS') batch.summary.ambiguous = Math.max(0, batch.summary.ambiguous - 1);

  await batch.save();
  return batch;
}

module.exports = {
  processUploadedFile,
  confirmRow,
  ignoreRow
};
