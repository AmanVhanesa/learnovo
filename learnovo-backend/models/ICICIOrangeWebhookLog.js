/**
 * ICICIOrangeWebhookLog
 *
 * Forensic store for every inbound POST that hits the ICICI Orange
 * callback endpoint. Built deliberately as a passive logger because:
 *
 *   1. ICICI's "Orange" product is not publicly documented anywhere
 *      we could find — there is no spec, no GitHub sample, no PDF.
 *      The only way to learn the payload schema is to capture the
 *      first real test transactions verbatim and inspect them.
 *
 *   2. Until we know which field uniquely identifies a transaction
 *      (UTR / bank ref / merchant txn id / etc.), we cannot dedupe on
 *      a domain key. We dedupe on a SHA-256 hash of the raw body
 *      instead — safe, conservative, and replay-proof.
 *
 *   3. We MUST not let an unparseable webhook break delivery — ICICI
 *      will retry on non-2xx and a parsing crash here would shadow the
 *      data we are trying to capture. Persist first, parse later.
 *
 * Once ICICI ships their integration spec, the post-receive processor
 * will read from this collection, map fields to PaymentAttempt /
 * FeeInvoice / Receipt records, and flip `processed=true`. The raw
 * payload remains forever (or until manually purged) for audit.
 */

const mongoose = require('mongoose');

const iciciOrangeWebhookLogSchema = new mongoose.Schema({
  // Tenant isolation. Looked up by tenantCode at write time so the
  // log row carries both the human code (`spis`) and the ObjectId
  // for any future indexed queries / joins.
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  tenantCode: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },

  // SHA-256 of the raw request body. Primary dedup key. If ICICI
  // retries the same notification, the second insert hits the unique
  // index and we know to ack-without-reprocessing.
  bodyHash: {
    type: String,
    required: true,
    index: true
  },

  // Wire-level capture. rawBody preserves the exact bytes ICICI sent
  // (critical for any later signature/checksum verification once
  // their spec is known). parsedBody is whatever Express middleware
  // managed to decode at receive time — JSON, form-encoded, or text.
  rawBody: { type: String, default: '' },
  parsedBody: { type: mongoose.Schema.Types.Mixed, default: null },

  // Request metadata. We capture a curated subset of headers — full
  // header dump would risk persisting cookies / auth tokens.
  contentType: { type: String, default: '' },
  method: { type: String, default: 'POST' },
  path: { type: String, default: '' },
  query: { type: mongoose.Schema.Types.Mixed, default: null },
  sourceIp: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  requestId: { type: String, default: '' },

  // Whether HTTP Basic Auth on the request succeeded. We log BOTH
  // successful and failed attempts so reconnaissance / misconfigured
  // ICICI test fires are visible. Auth failures will not contain a
  // body if the request was rejected before parsing — that's expected.
  authPassed: { type: Boolean, default: false },

  // Processing state — flipped to true once a downstream worker has
  // mapped this row into a Payment / FeeInvoice / Receipt update.
  processed: { type: Boolean, default: false, index: true },
  processedAt: { type: Date, default: null },
  processError: { type: String, default: '' },

  receivedAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  // Cap the collection at a reasonable size on disk via per-row
  // body limits, but do NOT add a TTL — we want this audit trail
  // to survive indefinitely until explicitly purged.
  collection: 'iciciorangewebhooklogs'
});

// Compound unique index on (tenantCode, bodyHash) gives us idempotent
// upserts: the same payload retried by ICICI for the same tenant is
// recorded once. Different tenants posting an identical body (almost
// impossible in practice, but theoretically possible) are still kept
// separate.
iciciOrangeWebhookLogSchema.index(
  { tenantCode: 1, bodyHash: 1 },
  { unique: true, name: 'tenantCode_bodyHash_unique' }
);

// Sort key for "show me the latest captures for this tenant" — the
// primary use case while reverse-engineering ICICI's payload format.
iciciOrangeWebhookLogSchema.index({ tenantCode: 1, receivedAt: -1 });

module.exports = mongoose.model('ICICIOrangeWebhookLog', iciciOrangeWebhookLogSchema);
