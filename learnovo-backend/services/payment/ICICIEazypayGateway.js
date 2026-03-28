const crypto = require('crypto');
const PaymentGateway = require('./PaymentGateway');

/**
 * ICICI EazyPay Payment Gateway
 *
 * Redirect-based flow:
 *   1. Encrypt parameters with AES-128-ECB
 *   2. Build redirect URL → eazypay.icicibank.com/EazyPG
 *   3. User completes payment on ICICI page
 *   4. ICICI POSTs response to our return URL
 *   5. We verify SHA-512 signature (RS field)
 *
 * Config required:
 *   merchantId, encryptionKey, subMerchantId, paymode, returnUrl
 */

const EAZYPAY_BASE_URL = 'https://eazypay.icicibank.com/EazyPG';
class ICICIEazypayGateway extends PaymentGateway {
  constructor(config = {}) {
    super(config);
    this.merchantId = config.merchantId;
    this.encryptionKey = config.encryptionKey;
    this.subMerchantId = config.subMerchantId;
    this.paymode = config.paymode || '9'; // 9 = all modes
    this.returnUrl = config.returnUrl;

    if (!this.merchantId || !this.encryptionKey || !this.subMerchantId) {
      throw new Error('ICICI EazyPay: merchantId, encryptionKey, and subMerchantId are required');
    }
    if (!this.returnUrl) {
      throw new Error('ICICI EazyPay: returnUrl is required');
    }
  }

  // ─── AES-128-ECB Encryption (PKCS7 padding) ──────────────────
  encrypt(plainText) {
    const cipher = crypto.createCipheriv('aes-128-ecb', this.encryptionKey, null);
    cipher.setAutoPadding(true); // PKCS7 by default
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  // ─── AES-128-ECB Decryption ───────────────────────────────────
  decrypt(encryptedText) {
    const decipher = crypto.createDecipheriv('aes-128-ecb', this.encryptionKey, null);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
     * Build the redirect URL for ICICI EazyPay checkout.
     *
     * @param {Object} params
     * @param {number} params.amount       - Amount in rupees
     * @param {string} params.currency     - 'INR'
     * @param {string} params.reference    - Unique reference number (our idempotency key)
     * @param {Object} params.customerInfo - { name, email, phone }
     * @returns {{ gatewayRefId, paymentUrl, raw }}
     */
  async initiatePayment(params) {
    const { amount, reference, customerInfo = {} } = params;
    const { name = '', email = '', phone = '' } = customerInfo;

    // Mandatory fields: RefNo|SubMerchantID|Amount|CustomerName|PhoneNo
    const mandatoryFields = [
      reference,
      this.subMerchantId,
      String(amount),
      name,
      phone
    ].join('|');

    // Optional fields: Email|Address|TransactionDate
    const transactionDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const optionalFields = [email, '', transactionDate].join('|');

    // Encrypt all fields
    const encMandatory = this.encrypt(mandatoryFields);
    const encOptional = this.encrypt(optionalFields);
    const encReturnUrl = this.encrypt(this.returnUrl);
    const encRefNo = this.encrypt(reference);
    const encSubMerchant = this.encrypt(this.subMerchantId);
    const encAmount = this.encrypt(String(amount));
    const encPaymode = this.encrypt(this.paymode);

    // Build redirect URL
    const paymentUrl = `${EAZYPAY_BASE_URL
    }?merchantid=${  encodeURIComponent(this.merchantId)
    }&mandatory fields=${  encodeURIComponent(encMandatory)
    }&optional fields=${  encodeURIComponent(encOptional)
    }&returnurl=${  encodeURIComponent(encReturnUrl)
    }&Reference No=${  encodeURIComponent(encRefNo)
    }&submerchantid=${  encodeURIComponent(encSubMerchant)
    }&transaction amount=${  encodeURIComponent(encAmount)
    }&paymode=${  encodeURIComponent(encPaymode)}`;

    return {
      gatewayRefId: reference, // We use our reference as the gateway tracking ID
      paymentUrl,
      raw: {
        provider: 'icici_eazypay',
        mandatoryFields,
        optionalFields,
        merchantId: this.merchantId
      }
    };
  }

  /**
     * ICICI EazyPay doesn't have a status-check API in the standard integration.
     * Status is determined by the return URL callback.
     * This method returns PENDING for any non-terminal payment.
     */
  async checkStatus(gatewayRefId) {
    return {
      status: 'PENDING',
      raw: {
        message: 'ICICI EazyPay does not support real-time status polling. Status is delivered via return URL callback.',
        gatewayRefId
      }
    };
  }

  /**
     * ICICI EazyPay refunds are handled offline via the bank.
     * This logs the request for manual processing.
     */
  async refund(gatewayRefId, amount) {
    return {
      status: 'PENDING',
      refundRefId: null,
      raw: {
        message: 'ICICI EazyPay refunds must be processed through the bank portal or by contacting the ICICI relationship manager.',
        gatewayRefId,
        amount
      }
    };
  }

  /**
     * Verify the SHA-512 signature from ICICI's return URL POST.
     *
     * ICICI sends these fields in the response:
     *   Response_Code, Unique_Ref_Number, Service_Tax_Amount,
     *   Processing_Fee_Amount, Total_Amount, Transaction_Amount,
     *   Transaction_Date, Interchange_Value, TDR, Payment_Mode,
     *   SubMerchantId, ReferenceNo, TPS, ID
     *
     * The RS field is: SHA-512 of pipe-separated fields + encryption key
     */
  verifyWebhookSignature(headers, rawBody) {
    // For return URL, the data comes as POST form params, not raw body.
    // This method is called with the parsed body object.
    return this.verifyResponseSignature(typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody);
  }

  /**
     * Verify the SHA-512 response signature from ICICI callback.
     *
     * @param {Object} data - The POST body from ICICI's redirect
     * @returns {boolean}
     */
  verifyResponseSignature(data) {
    if (!data || !data.RS) return false;

    // Build the verification string in the exact field order ICICI expects
    const fields = [
      data.ID || '',
      data.Response_Code || '',
      data.Unique_Ref_Number || '',
      data.Service_Tax_Amount || '',
      data.Processing_Fee_Amount || '',
      data.Total_Amount || '',
      data.Transaction_Amount || '',
      data.Transaction_Date || '',
      data.Interchange_Value || '',
      data.TDR || '',
      data.Payment_Mode || '',
      data.SubMerchantId || '',
      data.ReferenceNo || '',
      data.TPS || '',
      this.encryptionKey
    ];

    const verificationString = fields.join('|');
    const expectedHash = crypto
      .createHash('sha512')
      .update(verificationString)
      .digest('hex');

    // Case-insensitive comparison
    return expectedHash.toLowerCase() === data.RS.toLowerCase();
  }

  /**
     * Parse ICICI EazyPay response into a standardized format.
     *
     * @param {Object} data - The POST body from ICICI's redirect
     * @returns {{ isSuccess, referenceNo, uniqueRefNumber, amount, responseCode, paymentMode, raw }}
     */
  static parseResponse(data) {
    const isSuccess = data.Response_Code === 'E000';

    return {
      isSuccess,
      referenceNo: data.ReferenceNo || '',
      uniqueRefNumber: data.Unique_Ref_Number || '',
      amount: parseFloat(data.Transaction_Amount) || 0,
      totalAmount: parseFloat(data.Total_Amount) || 0,
      responseCode: data.Response_Code || '',
      responseMessage: ICICIEazypayGateway.getResponseMessage(data.Response_Code),
      paymentMode: data.Payment_Mode || '',
      transactionDate: data.Transaction_Date || '',
      raw: data
    };
  }

  /**
     * Map ICICI response codes to human-readable messages.
     */
  static getResponseMessage(code) {
    const messages = {
      'E000': 'Payment successful',
      'E001': 'Payment failed',
      'E002': 'Payment pending',
      'E003': 'Transaction cancelled by user',
      'E004': 'Transaction timed out',
      'E005': 'Invalid credentials',
      'E006': 'Invalid merchant',
      'E007': 'Bank server error',
      'E008': 'Session expired',
      'E0031': 'Mandatory fields from merchant are empty',
      'E0032': 'Mandatory fields from merchant are invalid',
      'E0033': 'Encryption key mismatch',
      'E0034': 'Amount mismatch'
    };
    return messages[code] || `Unknown response code: ${code}`;
  }
}

module.exports = ICICIEazypayGateway;
