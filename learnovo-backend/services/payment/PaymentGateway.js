/**
 * Base interface for all payment gateways (Mock, HDFC, Razorpay, etc.)
 * 
 * Enforces a strict contract so swapping gateways later requires merely
 * instantiating a different class.
 */
class PaymentGateway {
    constructor(config = {}) {
        this.config = config;
    }

    /**
     * Initiates a payment session with the gateway.
     * @param {Object} params
     * @param {string} params.amount - The decimal monetary value
     * @param {string} params.currency - Usually 'INR'
     * @param {string} params.reference - Your idempotencyKey or system ID
     * @param {Object} params.customerInfo - Email, phone, name of student
     * @returns {Promise<Object>} { gatewayRefId: string, paymentUrl: string, raw: Object }
     */
    async initiatePayment(params) {
        throw new Error('Method not implemented.');
    }

    /**
     * Checks the status of a specific payment session.
     * @param {string} gatewayRefId - The gateway's tracking ID
     * @param {string} [systemRefId] - Your system's tracking ID (optional/fallback)
     * @returns {Promise<Object>} { status: 'SUCCESS'|'FAILED'|'PENDING', raw: Object }
     */
    async checkStatus(gatewayRefId, systemRefId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Issues a refund for a previously successful payment.
     * @param {string} gatewayRefId - The gateway's tracking ID
     * @param {string} amount - Refund amount
     * @returns {Promise<Object>} { status: 'SUCCESS'|'FAILED', refundRefId: string, raw: Object }
     */
    async refund(gatewayRefId, amount) {
        throw new Error('Method not implemented.');
    }

    /**
     * Validates a webhook payload authenticity.
     * @param {Object} headers - HTTP request headers
     * @param {string|Buffer} rawBody - Raw unparsed HTTP body
     * @returns {boolean}
     */
    verifyWebhookSignature(headers, rawBody) {
        throw new Error('Method not implemented.');
    }
}

module.exports = PaymentGateway;
