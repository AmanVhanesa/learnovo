const FeePaymentOrder = require('../models/FeePaymentOrder');
const PaymentAttempt = require('../models/PaymentAttempt');
const Payment = require('../models/Payment');
const FeeInvoice = require('../models/FeeInvoice');
const BankReconciliationBatch = require('../models/BankReconciliationBatch');
const ImportExportService = require('./importExportService');
const { confirmFeePayment } = require('./paymentConfirmationService');
const { moneyEquals } = require('../utils/money');

// Header aliases — each value goes through normaliseHeader() before matching,
// so spaces, dots, underscores, and hyphens are all flattened. The lists below
// cover ICICI Orange v2 MIS, ICICI EazyPay, Razorpay settlement, HDFC/AXIS
// generic MIS exports. Order matters: the first non-empty match wins.
const HEADER_ALIASES = {
  utr: [
    'utr', 'utr no', 'utr number', 'utrno', 'utrnumber',
    'rrn', 'rrn no', 'rrn number',
    'bank ref no', 'bank reference', 'bank reference no', 'bankrefno'
  ],
  gatewayOrderId: [
    // ICICI Orange MIS calls our merchantTxnNo "Merchant Ref.No."
    'merchant ref no', 'merchant ref', 'merchant reference', 'merchant reference no',
    'merchant txn no', 'merchant txn number', 'merchanttxnno',
    'merchant order id', 'merchantorderid', 'order id', 'orderid',
    'mer ref no', 'mer refno', 'merch ref no', 'merch refno', 'merchrefno'
  ],
  gatewayPaymentId: [
    // ICICI Orange MIS: "PaymentID" and "TransactionID" both carry bank-side IDs.
    // PaymentID is the canonical one, TransactionID is the leg-level id; either
    // is fine for matching since both end up on Payment.transactionDetails.
    'paymentid', 'payment id',
    'transactionid', 'transaction id', 'txn id', 'txnid',
    'original transaction id', 'original txn id', 'originaltransactionid',
    'pg txn id', 'pg ref no', 'pgtxnid', 'pgrefno',
    'icici ref', 'icici reference', 'iciciref',
    'bank txn id', 'banktxnid'
  ],
  amount: [
    // ICICI MIS has GrossAmount, Chargeable Amount, AND Amount Paid.
    // "Amount Paid" is what actually settled to the merchant — that's the
    // figure the bank credit will show on the statement, so we match it
    // first. GrossAmount is what the customer paid (incl. surcharge), used
    // as a fallback when Amount Paid is missing.
    'amount paid', 'amountpaid',
    'chargeable amount', 'chargeableamount',
    'gross amount', 'grossamount',
    'settlement amount', 'settledamount', 'settl amt', 'settlamt',
    'net amount', 'netamount',
    'credit amount', 'creditamount',
    'txn amount', 'transaction amount', 'txn amt', 'tran amt', 'txnamount', 'tranamount',
    'paid amount', 'paidamount',
    'total amount', 'totalamount',
    'amount', 'amt'
  ],
  txnDate: [
    // ICICI uses "transaction completion date and time" — long but exact.
    // settlementDate comes back from settlement reports.
    'transaction completion date and time', 'transaction completion date time',
    'transaction completion date',
    'txn date', 'transaction date', 'tran date', 'txn dt',
    'settlement date', 'settled date', 'settlementdate', 'set date',
    'value date', 'date and time', 'datetime', 'date'
  ],
  bankStatus: [
    'status', 'txn status', 'transaction status', 'payment status', 'paymentstatus', 'txnstatus'
  ],
  // Optional enrichment fields — surfaced in the UI to help an operator
  // identify the row quickly even when nothing matches in Learnovo.
  paymentMode: ['payment mode', 'paymode', 'mode'],
  customerName: ['customer name', 'customername', 'cust name'],
  customerId: ['customer id', 'customerid', 'user id', 'userid', 'cust id'],
  invoiceNumber: ['invoice number', 'invoice no', 'invoiceno', 'invoicenumber', 'invoice'],
  additionalParam1: ['additionalparameter1', 'additional parameter 1', 'addlparam1', 'addlparam 1'],
  additionalParam2: ['additionalparameter2', 'additional parameter 2', 'addlparam2', 'addlparam 2']
};

function normaliseHeader(h) {
  // Flatten "Merchant Ref.No." → "merchant ref no" so both
  // dots and case differences are absorbed before alias matching.
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[\s_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTH_INDEX = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
};

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

// Tries the formats ICICI/Razorpay/HDFC actually emit, in order:
//   1. dd-MMM-yyyy [hh:mm[:ss]]              e.g. 23-May-2026 09:10:02  (ICICI Orange)
//   2. dd/mm/yyyy or dd-mm-yyyy [hh:mm[:ss]] e.g. 23/05/2026
//   3. yyyy-mm-dd hh:mm:ss                    ICICI also uses this form
//   4. Native Date() — covers ISO 8601 + epoch-millis-as-string
function parseDate(val) {
  if (val == null || val === '') return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;

  const monthName = trimmed.match(
    /^(\d{1,2})[\s/-]([A-Za-z]{3,4})[\s/-](\d{2,4})(?:[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (monthName) {
    const [, d, mName, y, hh = '0', mm = '0', ss = '0'] = monthName;
    const mIdx = MONTH_INDEX[mName.toLowerCase()];
    if (mIdx != null) {
      const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
      const dt = new Date(year, mIdx, parseInt(d, 10), parseInt(hh, 10), parseInt(mm, 10), parseInt(ss, 10));
      if (!isNaN(dt.getTime())) return dt;
    }
  }

  const dmy = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmy) {
    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = dmy;
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
    const dt = new Date(year, parseInt(m, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mm, 10), parseInt(ss, 10));
    if (!isNaN(dt.getTime())) return dt;
  }

  const native = new Date(trimmed);
  return isNaN(native.getTime()) ? null : native;
}

async function findCandidates(tenantId, row) {
  const candidates = { orders: [], attempts: [] };

  // ── FeePaymentOrder is Razorpay-only; ICICI flows skip this collection ──
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

  // ── PaymentAttempt covers ICICI Orange + all other gateways ────────────
  // gatewayRefId = the merchantTxnNo we sent ICICI = "Merchant Ref.No." in the MIS.
  // transactionRefId = bank-issued ref (PaymentID / UTR / RRN) stored on callback.
  const attemptRefs = [row.gatewayOrderId, row.gatewayPaymentId, row.utr].filter(Boolean);
  if (attemptRefs.length > 0) {
    const attempts = await PaymentAttempt.find({
      tenantId,
      $or: [
        { gatewayRefId: { $in: attemptRefs } },
        { transactionRefId: { $in: attemptRefs } }
      ]
    }).select('_id invoiceId studentId amount status gatewayRefId transactionRefId').lean();
    candidates.attempts.push(...attempts);
  }

  // ── Fuzzy fallback: same-day + same-amount when we have nothing to grab ──
  if (candidates.orders.length === 0 && candidates.attempts.length === 0 && row.txnDate && row.amount > 0) {
    const windowMs = 3 * 24 * 60 * 60 * 1000;
    const windowStart = new Date(row.txnDate.getTime() - windowMs);
    const windowEnd = new Date(row.txnDate.getTime() + windowMs);

    const [fuzzyOrders, fuzzyAttempts] = await Promise.all([
      FeePaymentOrder.find({
        tenantId,
        status: { $in: ['created', 'paid'] },
        amount: { $gte: row.amount - 0.5, $lte: row.amount + 0.5 },
        createdAt: { $gte: windowStart, $lte: windowEnd }
      }).select('_id invoiceId studentId amount status razorpayOrderId').limit(10).lean(),
      PaymentAttempt.find({
        tenantId,
        status: { $in: ['INITIATED', 'PROCESSING', 'PENDING', 'UNDER_REVIEW'] },
        amount: { $gte: row.amount - 0.5, $lte: row.amount + 0.5 },
        createdAt: { $gte: windowStart, $lte: windowEnd }
      }).select('_id invoiceId studentId amount status gatewayRefId').limit(10).lean()
    ]);
    candidates.orders.push(...fuzzyOrders);
    candidates.attempts.push(...fuzzyAttempts);
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

    // A row only gets auto-ignored when amount is unparseable AND nothing
    // identifies it. With identifiers we keep it visible — the operator can
    // ignore manually if it's noise, but silently burying it is what made
    // every ICICI row vanish before the parser fix.
    const hasIdentifier = Boolean(
      mapped.utr || mapped.gatewayOrderId || mapped.gatewayPaymentId
    );
    const isFailedStatus = mapped.bankStatus &&
      /fail|decline|cancel|reject/i.test(mapped.bankStatus);

    if (!(amount > 0) && !hasIdentifier) {
      rows.push({
        rowNumber,
        raw: mapped.raw,
        utr: null,
        gatewayOrderId: null,
        gatewayPaymentId: null,
        amount: 0,
        txnDate: null,
        bankStatus: mapped.bankStatus || null,
        paymentMode: mapped.paymentMode || null,
        customerName: mapped.customerName || null,
        customerId: mapped.customerId || null,
        invoiceNumber: mapped.invoiceNumber || null,
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
      amount: amount > 0 ? amount : 0,
      txnDate
    };

    const candidates = amount > 0
      ? await findCandidates(tenantId, searchRow)
      : { orders: [], attempts: [] };
    const existingPayment = await isAlreadyPaidInLearnovo(tenantId, searchRow);
    let classification = classifyRow(searchRow, candidates, existingPayment);
    // Bank-reported failures should never invite a confirm action.
    if (isFailedStatus && classification !== 'MATCHED_CONFIRMED') {
      classification = 'IGNORED';
    }

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
      amount: amount > 0 ? amount : 0,
      txnDate,
      bankStatus: mapped.bankStatus || null,
      paymentMode: mapped.paymentMode || null,
      customerName: mapped.customerName || null,
      customerId: mapped.customerId || null,
      invoiceNumber: mapped.invoiceNumber || null,
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
