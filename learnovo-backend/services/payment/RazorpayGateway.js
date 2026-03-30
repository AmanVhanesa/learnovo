const crypto = require('crypto');
const PaymentGateway = require('./PaymentGateway');

/**
 * Razorpay Payment Gateway
 *
 * Popup-based flow (different from ICICI's redirect):
 *   1. Backend creates a Razorpay order
 *   2. Frontend opens Razorpay checkout popup with keyId + orderId
 *   3. Student completes payment in popup
 *   4. Frontend receives payment result → sends to backend for verification
 *   5. Backend verifies HMAC-SHA256 signature
 *
 * Config required:
 *   keyId, keySecret, webhookSecret (optional)
 */

class RazorpayGateway extends PaymentGateway {
  constructor(config = {}) {
    super(config);
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret || '';

    if (!this.keyId || !this.keySecret) {
      throw new Error('Razorpay: keyId and keySecret are required');
    }

    // Lazy-load Razorpay SDK
    try {
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret
      });
    } catch {
      throw new Error('Razorpay SDK (razorpay) is not installed. Run: npm install razorpay');
    }
  }

  /**
   * Create a Razorpay order.
   *
   * Unlike ICICI (which returns a redirect URL), Razorpay returns order details
   * that the frontend uses to open the checkout popup.
   *
   * @returns {{ gatewayRefId, paymentUrl: null, razorpayOrder, raw }}
   */
  async initiatePayment(params) {
    const { amount, reference, customerInfo = {} } = params;

    const order = await this.razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert rupees to paise
      currency: 'INR',
      receipt: reference,
      notes: {
        reference,
        customerName: customerInfo.name || '',
        customerEmail: customerInfo.email || ''
      }
    });

    return {
      gatewayRefId: order.id,
      // No redirect URL — Razorpay uses popup. Frontend handles this.
      paymentUrl: null,
      razorpayOrder: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: this.keyId
      },
      raw: {
        provider: 'razorpay',
        orderId: order.id,
        amount: order.amount,
        status: order.status
      }
    };
  }

  /**
   * Check payment status via Razorpay API.
   */
  async checkStatus(gatewayRefId) {
    try {
      const order = await this.razorpay.orders.fetch(gatewayRefId);
      const statusMap = { paid: 'SUCCESS', attempted: 'PENDING', created: 'PENDING' };
      return {
        status: statusMap[order.status] || 'PENDING',
        raw: order
      };
    } catch (err) {
      return { status: 'PENDING', raw: { error: err.message } };
    }
  }

  /**
   * Issue a refund via Razorpay API.
   */
  async refund(paymentId, amount) {
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: Math.round(amount * 100),
        speed: 'normal'
      });
      return {
        status: refund.status === 'processed' ? 'SUCCESS' : 'PENDING',
        refundRefId: refund.id,
        raw: refund
      };
    } catch (err) {
      return { status: 'FAILED', refundRefId: null, raw: { error: err.message } };
    }
  }

  /**
   * Verify Razorpay payment signature (frontend callback).
   *
   * @param {string} orderId - razorpay_order_id
   * @param {string} paymentId - razorpay_payment_id
   * @param {string} signature - razorpay_signature
   * @returns {boolean}
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');
    return expected === signature;
  }

  /**
   * Verify webhook signature.
   */
  verifyWebhookSignature(headers, rawBody) {
    if (!this.webhookSecret) return true; // No secret configured, skip
    const receivedSignature = headers['x-razorpay-signature'];
    if (!receivedSignature) return false;

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
      .digest('hex');
    return expected === receivedSignature;
  }
}

module.exports = RazorpayGateway;
