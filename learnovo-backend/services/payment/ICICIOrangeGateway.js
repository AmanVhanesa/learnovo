/**
 * ICICI Orange (PG Direct) Payment Gateway.
 *
 * Implements the redirect-based ICICI Bank PG Direct flow:
 *   1. We POST initiateSale with a JSON body + secureHash (HMAC-SHA256 of
 *      values concatenated in alphabetical key order, signed with the
 *      merchant's secureHashKey).
 *   2. ICICI returns redirectURI + tranCtx. We send the customer to
 *      `${redirectURI}?tranCtx=${tranCtx}`.
 *   3. After the customer pays on the bank-hosted page, ICICI POSTs the
 *      response to the returnURL we supplied. The response carries a
 *      secureHash that we MUST verify with the same algorithm.
 *   4. Status reconciliation: POST /pg/api/command with a STATUS
 *      transactionType (same secureHash discipline).
 *
 * Spec sources: bank-supplied "Step Wise Document for PG Direct integration"
 * and "Initiate Pay Request & Response" reference (December 2025 release).
 *
 * The legacy inbound webhook path (routes/iciciOrangeWebhook.js) remains
 * mounted as a defensive fallback in case ICICI ever fires server-to-server
 * notifications in addition to the returnURL post — the parser below is
 * permissive enough to handle either shape.
 */

const crypto = require('crypto');
const PaymentGateway = require('./PaymentGateway');

const ENV_URLS = {
  production: {
    initiateSale: 'https://pgpay.icicibank.com/pg/api/v2/initiateSale',
    command: 'https://pgpay.icicibank.com/pg/api/command'
  },
  uat: {
    initiateSale: 'https://pgpayuat.icicibank.com/tsp/pg/api/v2/initiateSale',
    command: 'https://pgpayuat.icicibank.com/tsp/pg/api/command'
  }
};

class ICICIOrangeGateway extends PaymentGateway {
  constructor(config = {}) {
    super(config);
    this.merchantId = config.merchantId || '';
    this.aggregatorId = config.aggregatorId || '';
    this.secureHashKey = config.secureHashKey || '';
    this.environment = config.environment === 'uat' ? 'uat' : 'production';
    this.tenantCode = config.tenantCode || '';
    this.returnURL = config.returnURL || '';

    if (!this.merchantId) {
      throw new Error('ICICI Orange: merchantId is required');
    }
  }

  isReadyForOutbound() {
    return Boolean(this.merchantId && this.secureHashKey && this.returnURL);
  }

  // ── Crypto helpers ────────────────────────────────────────────────

  /**
   * Build the canonical hashtext: sort all keys alphabetically (excluding
   * secureHash itself), then concatenate the values in that key order.
   * The bank explicitly requires dynamic sorting — never hardcode the
   * field list, since payloads vary by transactionType.
   *
   * Boolean and non-primitive values are excluded. Confirmed empirically
   * against the /command STATUS response, which carries oth_charge as a
   * JSON boolean: ICICI signs the response without that field, and
   * including it broke verification on every reconciliation poll.
   * Form-encoded callbacks deliver the same field as the string "false"
   * (HTTP forms stringify everything), so that path is unaffected — only
   * JSON-bodied responses from /command had the boolean type leak.
   */
  _buildHashText(payload) {
    const keys = Object.keys(payload)
      .filter(k => {
        if (k === 'secureHash') return false;
        const v = payload[k];
        if (v === undefined || v === null) return false;
        const t = typeof v;
        return t === 'string' || t === 'number';
      })
      .sort();
    return keys.map(k => String(payload[k])).join('');
  }

  _sign(hashText) {
    return crypto
      .createHmac('sha256', this.secureHashKey)
      .update(hashText, 'utf8')
      .digest('hex');
  }

  _withSecureHash(payload) {
    const hashText = this._buildHashText(payload);
    const secureHash = this._sign(hashText);
    return { ...payload, secureHash };
  }

  /**
   * Verify a secureHash on an inbound payload (returnURL post-back or
   * STATUS response). Re-computes the hash over all fields except
   * secureHash and compares timing-safely.
   */
  verifySecureHash(payload) {
    if (!payload || typeof payload !== 'object') return false;
    const provided = payload.secureHash;
    if (!provided || typeof provided !== 'string') return false;
    const expected = this._sign(this._buildHashText(payload));
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // ── ID generation ────────────────────────────────────────────────

  /**
   * Bank-side merchantTxnNo: alphanumeric, kept under 25 chars to stay
   * inside the documented field width. Random 20 hex chars from a CSPRNG
   * — collision probability is negligible and keeps the value opaque
   * (no PII or internal IDs leaked into the bank-hosted UI).
   */
  _generateMerchantTxnNo() {
    return crypto.randomBytes(10).toString('hex');
  }

  /**
   * txnDate in the bank's required format: yyyyMMddHHmmss in IST.
   * The bank's UAT reference shows this exact format with no separators.
   * Using a fixed Asia/Kolkata zone avoids relying on the server's TZ
   * config (the VPS runs UTC).
   */
  _formatTxnDate(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
  }

  /**
   * Sanitise a phone number into the bank's expected shape: digits only,
   * with country code (default 91 for India). The bank's spec shows
   * "919999999999" — 12 digits with the 91 prefix.
   */
  _normalisePhone(raw) {
    if (!raw) return '919999999999';
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return '919999999999';
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
  }

  // ── PaymentGateway interface ─────────────────────────────────────

  /**
   * Initiate a sale. Returns the bank's hosted-checkout redirect URL.
   * The caller (studentFees route) stores gatewayRefId on the
   * PaymentAttempt so the returnURL handler can correlate the response
   * back to the originating attempt.
   */
  async initiatePayment(params) {
    if (!this.isReadyForOutbound()) {
      throw new Error('ICICI Orange gateway is not fully configured (missing secureHashKey or returnURL).');
    }

    const merchantTxnNo = this._generateMerchantTxnNo();
    const amount = Number(params.amount).toFixed(2);
    const customer = params.customerInfo || {};

    // Per ICICI PG Direct spec (Chapter 3 §3.1):
    //   customerID  → "User ID" column on the settlement CSV (alphanumeric, max 48)
    //   invoiceNo   → "Invoice Number" column on the settlement CSV (alphanumeric, max 32)
    //   addlParam1/2 → "AdditionalParameter1/2" columns (alphanumeric, max 64)
    // We use the bank-defined columns where available so the report shows
    // human-readable values, and keep the idempotency key in addlParam1 +
    // tenant code in addlParam2 for support correlation.
    const requestPayload = {
      merchantId: this.merchantId,
      merchantTxnNo,
      amount,
      currencyCode: '356', // INR per ISO 4217 numeric
      payType: '0',        // 0 = both debit + credit allowed; matches bank reference samples
      customerEmailID: customer.email || '',
      transactionType: 'SALE',
      returnURL: this.returnURL,
      txnDate: this._formatTxnDate(),
      customerMobileNo: this._normalisePhone(customer.phone),
      customerName: (customer.name || 'Student').toString().slice(0, 45),
      addlParam1: params.reference ? String(params.reference).slice(0, 64) : '',
      addlParam2: (this.tenantCode || '').slice(0, 64)
    };

    if (customer.admissionNumber) {
      requestPayload.customerID = String(customer.admissionNumber).slice(0, 48);
    }
    if (params.invoiceNumber) {
      requestPayload.invoiceNo = String(params.invoiceNumber).slice(0, 32);
    }

    if (this.aggregatorId) {
      requestPayload.aggregatorID = this.aggregatorId;
    }

    const signedPayload = this._withSecureHash(requestPayload);
    const url = ENV_URLS[this.environment].initiateSale;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(signedPayload)
    });

    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (_err) {
      throw new Error(`ICICI initiateSale returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }

    if (!response.ok || body.responseCode !== 'R1000' || !body.redirectURI || !body.tranCtx) {
      const msg = body.respDescription || body.txnRespDescription || body.responseCode || 'unknown';
      throw new Error(`ICICI initiateSale failed: ${msg}`);
    }

    const paymentUrl = `${body.redirectURI}?tranCtx=${encodeURIComponent(body.tranCtx)}`;

    return {
      gatewayRefId: merchantTxnNo,
      paymentUrl,
      raw: {
        responseCode: body.responseCode,
        tranCtx: body.tranCtx,
        merchantTxnNo,
        environment: this.environment
      }
    };
  }

  /**
   * Status check. ICICI's /command endpoint with transactionType=STATUS
   * mirrors the merchantTxnNo we sent on initiateSale (also as
   * originalTxnNo). Used by the reconciliation job for stuck attempts.
   */
  async checkStatus(gatewayRefId, _systemRefId = null) {
    if (!this.isReadyForOutbound()) {
      throw new Error('ICICI Orange gateway is not fully configured.');
    }
    if (!gatewayRefId) {
      throw new Error('checkStatus requires gatewayRefId (merchantTxnNo)');
    }

    const requestPayload = {
      merchantId: this.merchantId,
      merchantTxnNo: gatewayRefId,
      originalTxnNo: gatewayRefId,
      transactionType: 'STATUS'
    };
    if (this.aggregatorId) {
      requestPayload.aggregatorID = this.aggregatorId;
    }

    const signedPayload = this._withSecureHash(requestPayload);
    const url = ENV_URLS[this.environment].command;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(signedPayload)
    });

    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (_err) {
      throw new Error(`ICICI status check returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }

    // Verify the response signature so we never trust a status that
    // someone else could have spoofed onto our callback path. The bank's
    // sample shows a secureHash on the response.
    if (!this.verifySecureHash(body)) {
      throw new Error('ICICI status response failed secureHash verification');
    }

    return {
      status: this._normaliseStatus(body.txnStatus || body.responseCode),
      raw: body
    };
  }

  async refund(_gatewayRefId, _amount) {
    // ICICI PG Direct supports refunds via /command with transactionType=REFUND;
    // not yet exercised — wire when the operations team requests it.
    throw new Error('ICICI Orange refund flow is not yet wired.');
  }

  /**
   * Verify and parse the returnURL post-back from ICICI. Returns:
   *   - { valid: false }                                    on hash mismatch
   *   - { valid: true, merchantRef, bankRef, amount,
   *       normalisedStatus, rawStatus, raw }                otherwise
   *
   * Caller must reject any non-valid result without touching state.
   */
  verifyReturnPayload(payload) {
    if (!payload || typeof payload !== 'object') return { valid: false };
    if (!this.verifySecureHash(payload)) return { valid: false };

    const merchantRef = payload.merchantTxnNo || null;
    const bankRef = payload.txnID || payload.txnAuthID || null;
    const rawStatus = payload.txnStatus || payload.responseCode || payload.txnResponseCode || null;
    const amount = payload.amount !== undefined && payload.amount !== null
      ? Number(payload.amount)
      : null;

    return {
      valid: true,
      merchantRef,
      bankRef,
      rawStatus,
      normalisedStatus: this._normaliseStatus(rawStatus),
      amount,
      raw: payload
    };
  }

  // ── Inbound legacy webhook compatibility ─────────────────────────

  verifyWebhookSignature(_headers, _rawBody) {
    // The legacy webhook path uses HTTP Basic Auth at the transport
    // layer (see routes/iciciOrangeWebhook.js). Body-level signing on
    // that path is best-effort: callers can use verifySecureHash() if
    // the inbound body happens to carry a secureHash field.
    return true;
  }

  /**
   * Permissive parser for inbound payloads, used by the legacy webhook
   * processor as a fallback. The new returnURL flow uses
   * verifyReturnPayload() instead.
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
      'merchantTxnNo', 'merchantTxnId', 'merchant_txn_id', 'merchTxnRefNo',
      'txnRefNo', 'orderId', 'order_id', 'ref_no', 'referenceNo'
    );
    const bankRef = pick(
      'txnID', 'txnAuthID', 'bankRefNo', 'bank_ref_no', 'rrn', 'utr',
      'pgTxnId', 'bankTxnId', 'bank_txn_id'
    );
    const rawStatus = pick(
      'txnStatus', 'status', 'paymentStatus', 'respCode', 'responseCode', 'txnResponseCode'
    );
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

  _normaliseStatus(raw) {
    if (!raw) return 'UNKNOWN';
    const s = String(raw).toUpperCase().trim();

    const successCodes = new Set(['SUCCESS', 'SUCCESSFUL', 'SUC', 'S', 'PAID', 'CAPTURED', 'COMPLETED', '0000', '00', '0', '000']);
    const failureCodes = new Set(['FAILURE', 'FAILED', 'FAIL', 'F', 'DECLINED', 'CANCELLED', 'CANCELED', 'REJECTED']);
    const pendingCodes = new Set(['PENDING', 'INITIATED', 'PROCESSING', 'IN_PROGRESS', 'INI']);

    if (successCodes.has(s)) return 'SUCCESS';
    if (failureCodes.has(s)) return 'FAILED';
    if (pendingCodes.has(s)) return 'PENDING';
    return 'UNKNOWN';
  }
}

module.exports = ICICIOrangeGateway;
