/**
 * ICICI Orange Payment Gateway.
 *
 * ICICI's "Orange" product is a bank-issued merchant gateway for
 * current-account holders. As of this writing the bank has NOT shared
 * the outbound integration spec (endpoint URL, request/response field
 * names, signing algorithm) — only the inbound callback contract has
 * been implicitly defined through onboarding (HTTP Basic Auth on a
 * per-tenant URL).
 *
 * Until the MID kit arrives, the outbound methods (initiatePayment,
 * checkStatus, refund) deliberately throw a typed `SpecPendingError`
 * so callers can distinguish "bank integration not ready" from a true
 * gateway failure. The inbound payload parser is real and best-effort:
 * it tries common Indian bank field naming conventions to extract the
 * merchant transaction id, status, and amount — on the assumption that
 * ICICI will follow one of the well-known patterns. When the spec
 * lands, the parser either stays as-is (if the fields matched) or gets
 * tightened to the exact schema.
 *
 * Credentials arrive via the constructor, pulled from the tenant's
 * encrypted `paymentGateway.iciciOrange` config (merchantId, terminalId,
 * apiKey, apiSecret). The inbound Basic Auth username/password for the
 * callback endpoint live in env vars, not here — those are consumed
 * directly by `routes/iciciOrangeWebhook.js`.
 */

const PaymentGateway = require('./PaymentGateway');

class SpecPendingError extends Error {
  constructor(message = 'ICICI Orange integration spec pending from bank') {
    super(message);
    this.name = 'SpecPendingError';
    this.code = 'ICICI_ORANGE_SPEC_PENDING';
  }
}

class ICICIOrangeGateway extends PaymentGateway {
  constructor(config = {}) {
    super(config);
    this.merchantId = config.merchantId || '';
    this.terminalId = config.terminalId || '';
    this.apiKey = config.apiKey || '';
    this.apiSecret = config.apiSecret || '';
    this.tenantCode = config.tenantCode || '';

    if (!this.merchantId) {
      throw new Error('ICICI Orange: merchantId is required');
    }
  }

  /**
   * True only when the full MID kit has been loaded. Callers can check
   * this before invoking outbound methods to fail fast with a clear
   * admin-facing message instead of a bank-returned 401.
   */
  isReadyForOutbound() {
    return Boolean(this.merchantId && this.terminalId && this.apiKey && this.apiSecret);
  }

  async initiatePayment(_params) {
    throw new SpecPendingError(
      'initiatePayment is not yet wired: awaiting ICICI Orange MID kit (endpoint URL + request schema + signing algorithm). The webhook callback path is live and will reconcile any payments once outbound is implemented.'
    );
  }

  async checkStatus(_gatewayRefId, _systemRefId = null) {
    throw new SpecPendingError(
      'checkStatus is not yet wired: awaiting ICICI Orange status-query endpoint spec.'
    );
  }

  async refund(_gatewayRefId, _amount) {
    throw new SpecPendingError(
      'refund is not yet wired: awaiting ICICI Orange refund endpoint spec.'
    );
  }

  /**
   * Inbound callback signature verification. ICICI has not shared the
   * signing scheme (if any) — the live authentication is HTTP Basic Auth
   * on the URL itself, verified in the webhook route. When the bank
   * shares a body-level signature scheme (HMAC, checksum, etc.), the
   * raw body is already preserved on `req.rawBody` and in
   * `ICICIOrangeWebhookLog.rawBody` for retroactive verification.
   */
  verifyWebhookSignature(_headers, _rawBody) {
    // Basic Auth at the transport layer is the only verification the
    // bank has asked for. Return true so processors can proceed; the
    // route itself already gates on authPassed before persisting.
    return true;
  }

  /**
   * Parse an inbound ICICI Orange callback payload (JSON or form-encoded,
   * already parsed by Express) into a normalised shape the processor can
   * consume. Returns `null` when we cannot confidently extract either
   * the merchant reference or the status — the processor treats that as
   * "log-only, no state transition".
   *
   * Indian bank gateways historically use one of these field names:
   *   - merchant txn id: merchantTxnId, merchant_txn_id, merchTxnRefNo,
   *     txnRefNo, orderId, order_id, ref_no
   *   - bank txn id: bankRefNo, bank_ref_no, rrn, utr, pgTxnId, bankTxnId
   *   - amount: amount, txnAmount, txn_amount, totalAmount
   *   - status: status, txnStatus, paymentStatus, respCode (numeric)
   *
   * The parser is intentionally permissive: it probes each field in
   * turn and picks the first non-empty value. Once the ICICI spec is
   * shared, the permissive lookup can be replaced with the exact keys
   * (or kept as a fallback — there's no harm in leaving it).
   */
  parseCallbackPayload(parsedBody) {
    if (!parsedBody || typeof parsedBody !== 'object') return null;

    const pick = (...keys) => {
      for (const k of keys) {
        const v = parsedBody[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          return String(v).trim();
        }
      }
      return null;
    };

    const merchantRef = pick(
      'merchantTxnId', 'merchant_txn_id', 'merchTxnRefNo',
      'txnRefNo', 'orderId', 'order_id', 'ref_no', 'referenceNo'
    );
    const bankRef = pick(
      'bankRefNo', 'bank_ref_no', 'rrn', 'utr',
      'pgTxnId', 'bankTxnId', 'bank_txn_id'
    );
    const rawStatus = pick('status', 'txnStatus', 'paymentStatus', 'respCode', 'responseCode');
    const rawAmount = pick('amount', 'txnAmount', 'txn_amount', 'totalAmount');

    if (!merchantRef && !bankRef) return null;

    return {
      merchantRef,
      bankRef,
      normalisedStatus: this._normaliseStatus(rawStatus),
      rawStatus,
      amount: rawAmount !== null ? Number(rawAmount) : null
    };
  }

  /**
   * Map ICICI's status codes to our internal state machine.
   * Recognises both string codes (SUCCESS/FAILURE) and numeric
   * response codes (0000 = success on many Indian bank gateways).
   * Unknown values return 'UNKNOWN' — the processor treats UNKNOWN
   * the same as PENDING (no state change, keep polling).
   */
  _normaliseStatus(raw) {
    if (!raw) return 'UNKNOWN';
    const s = String(raw).toUpperCase().trim();

    const successCodes = new Set(['SUCCESS', 'SUCCESSFUL', 'S', 'PAID', 'CAPTURED', 'COMPLETED', '0000', '00', '0']);
    const failureCodes = new Set(['FAILURE', 'FAILED', 'F', 'DECLINED', 'CANCELLED', 'CANCELED', 'REJECTED']);
    const pendingCodes = new Set(['PENDING', 'INITIATED', 'PROCESSING', 'IN_PROGRESS']);

    if (successCodes.has(s)) return 'SUCCESS';
    if (failureCodes.has(s)) return 'FAILED';
    if (pendingCodes.has(s)) return 'PENDING';
    return 'UNKNOWN';
  }
}

ICICIOrangeGateway.SpecPendingError = SpecPendingError;

module.exports = ICICIOrangeGateway;
