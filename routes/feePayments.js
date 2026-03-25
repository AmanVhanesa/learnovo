const express = require('express');
const { protect } = require('../middleware/auth');
const { getTenantFromRequest, validateTenantAccess } = require('../middleware/tenant');
const {
    createOrder,
    verifyPayment,
    handleWebhook,
    getPaymentStatus
} = require('../controllers/feePayment.controller');

const router = express.Router();

// ─── PROTECTED ROUTES (require logged-in user) ─────────────────
//
// These routes use JWT authentication. The parent/student must be
// logged in to create orders and verify payments.

router.post(
    '/create-order',
    protect,
    getTenantFromRequest,
    validateTenantAccess,
    createOrder
);

router.post(
    '/verify',
    protect,
    getTenantFromRequest,
    validateTenantAccess,
    verifyPayment
);

router.get(
    '/status/:orderId',
    protect,
    getTenantFromRequest,
    validateTenantAccess,
    getPaymentStatus
);

// ─── PUBLIC ROUTE (called by Razorpay, not by a user) ──────────
//
// The webhook has NO auth middleware. Razorpay's servers call this
// URL directly. We verify it using the webhook signature instead.
//
// IMPORTANT: The raw body is needed for signature verification.
// Make sure express.raw() or a rawBody middleware is applied in
// server.js BEFORE express.json() for this route, or use the
// verify option in express.json().

router.post('/webhook', handleWebhook);

module.exports = router;
