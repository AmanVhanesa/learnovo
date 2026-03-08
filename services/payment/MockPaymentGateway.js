const PaymentGateway = require('./PaymentGateway');
const crypto = require('crypto');

/**
 * Mock Gateway implementation for testing the strict state machine
 * without making actual HTTP calls to a bank.
 */
class MockPaymentGateway extends PaymentGateway {
    constructor(config = {}) {
        super(config);
        // Allows forcing a specific response for testing frontend UI states
        // Config options: { forceStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | null }
        this.forceStatus = config.forceStatus || null;
    }

    async initiatePayment(params) {
        // Give it a fake remote ID
        const mockGatewayRefId = `mock_txn_${crypto.randomBytes(8).toString('hex')}`;

        // Mock a frontend URL that a real gateway would return for checkout UI
        const mockPaymentUrl = `http://localhost:3000/mock-gateway-checkout?ref=${mockGatewayRefId}&amount=${params.amount}`;

        return {
            gatewayRefId: mockGatewayRefId,
            paymentUrl: mockPaymentUrl,
            raw: {
                message: "Mock initiates immediately",
                received_params: params
            }
        };
    }

    async checkStatus(gatewayRefId, systemRefId = null) {
        let status = 'SUCCESS';

        if (this.forceStatus) {
            status = this.forceStatus;
        } else {
            // Randomly determine status if not forced, skewed heavily towards SUCCESS
            const roll = Math.random();
            if (roll > 0.95) status = 'FAILED';
            else if (roll > 0.85) status = 'PENDING';
        }

        return {
            status,
            raw: {
                message: "Mock checkStatus evaluated",
                gatewayRefId,
                resolved_mock_status: status,
                timestamp: new Date().toISOString()
            }
        };
    }

    async refund(gatewayRefId, amount) {
        return {
            status: 'SUCCESS',
            refundRefId: `mock_ref_${crypto.randomBytes(4).toString('hex')}`,
            raw: {
                message: "Mock refund processed",
                amount,
                gatewayRefId
            }
        };
    }

    verifyWebhookSignature(headers, rawBody) {
        // Always trust mock webhooks
        return true;
    }
}

module.exports = MockPaymentGateway;
