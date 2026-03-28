const express = require('express');
const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const { protect } = require('../middleware/auth');
const { getTenantFromRequest, validateTenantAccess } = require('../middleware/tenant');

const { PLANS } = require('../utils/planConfig');

const router = express.Router();

// Initialize Razorpay (lazy load - only if package is installed and env vars are set)
let razorpayInstance = null;
let razorpayModule = null;

try {
  razorpayModule = require('razorpay');
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new razorpayModule({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
} catch (error) {
  console.warn('Razorpay package not installed. Payment gateway features will be limited to mock mode.');
}

// Derive SUBSCRIPTION_PLANS from the single source of truth (planConfig)
const SUBSCRIPTION_PLANS = {
  basic: {
    name: PLANS.basic.name,
    maxStudents: PLANS.basic.limits.students,
    maxTeachers: PLANS.basic.limits.teachers,
    price: PLANS.basic.price,
    features: [`${PLANS.basic.limits.students} Students`, `${PLANS.basic.limits.teachers} Teachers`, 'Email Support', 'Grades & Exams', 'Fees & Finance', 'CSV Import']
  },
  pro: {
    name: PLANS.pro.name,
    maxStudents: PLANS.pro.limits.students,
    maxTeachers: PLANS.pro.limits.teachers,
    price: PLANS.pro.price,
    features: [`${PLANS.pro.limits.students} Students`, `${PLANS.pro.limits.teachers} Teachers`, 'Priority Support', 'Advanced Analytics', 'Payment Gateway', 'SMS & WhatsApp']
  },
  enterprise: {
    name: PLANS.enterprise.name,
    maxStudents: 999999,
    maxTeachers: 999999,
    price: 0, // Custom pricing
    features: ['Unlimited Students', 'Unlimited Teachers', 'Dedicated Support', 'All Features', 'Custom Integrations', 'White-label']
  }
};

// @desc    Get available subscription plans
// @route   GET /api/payments/plans
// @access  Public
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    data: SUBSCRIPTION_PLANS
  });
});

// @desc    Create payment order
// @route   POST /api/payments/create-order
// @access  Private (Admin)
router.post('/create-order', protect, getTenantFromRequest, validateTenantAccess, async(req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create payment orders'
      });
    }

    const { plan, billingCycle } = req.body;

    if (!plan || !SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    const selectedPlan = SUBSCRIPTION_PLANS[plan];

    // If Razorpay is not configured, return mock response
    if (!razorpayInstance) {
      return res.json({
        success: true,
        message: 'Payment gateway not configured. Using mock order.',
        data: {
          orderId: `mock_order_${  Date.now()}`,
          amount: selectedPlan.price * 100, // in paise
          currency: 'INR',
          plan: plan,
          mock: true
        }
      });
    }

    // Create Razorpay order
    const options = {
      amount: selectedPlan.price * 100, // in paise
      currency: 'INR',
      receipt: `recp_${req.tenant._id}_${Date.now()}`,
      notes: {
        tenantId: req.tenant._id.toString(),
        schoolName: req.tenant.schoolName,
        plan: plan,
        billingCycle: billingCycle || 'monthly'
      }
    };

    const order = await razorpayInstance.orders.create(options);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        plan: plan,
        billingCycle: billingCycle
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Verify payment and update subscription
// @route   POST /api/payments/verify
// @access  Private (Admin)
router.post('/verify', protect, getTenantFromRequest, validateTenantAccess, async(req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can verify payments'
      });
    }

    const { orderId, paymentId, signature, plan, billingCycle } = req.body;

    if (!orderId || !paymentId || !signature || !plan) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // If mock order, skip verification
    if (orderId.startsWith('mock_order_')) {
      const selectedPlan = SUBSCRIPTION_PLANS[plan];
      if (!selectedPlan) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan'
        });
      }

      // Update tenant subscription
      const billingCycleInDays = billingCycle === 'yearly' ? 365 : 30;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + billingCycleInDays);

      const tenant = await Tenant.findByIdAndUpdate(
        req.tenant._id,
        {
          'subscription.plan': plan,
          'subscription.status': 'active',
          'subscription.maxStudents': selectedPlan.maxStudents,
          'subscription.maxTeachers': selectedPlan.maxTeachers,
          'subscription.startDate': new Date(),
          'subscription.endDate': endDate,
          'subscription.price': selectedPlan.price,
          'subscription.billingCycle': billingCycle || 'monthly',
          'subscription.paymentId': paymentId || orderId
        },
        { new: true }
      );

      return res.json({
        success: true,
        message: 'Subscription activated successfully',
        data: {
          subscription: tenant.subscription
        }
      });
    }

    // Verify Razorpay payment signature
    if (!razorpayInstance || !razorpayModule) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway not configured. Razorpay package is not installed or credentials are missing.'
      });
    }

    const text = `${orderId  }|${  paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Invalid signature'
      });
    }

    // Payment verified, update tenant subscription
    const selectedPlan = SUBSCRIPTION_PLANS[plan];
    if (!selectedPlan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan'
      });
    }

    const billingCycleInDays = billingCycle === 'yearly' ? 365 : 30;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + billingCycleInDays);

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      {
        'subscription.plan': plan,
        'subscription.status': 'active',
        'subscription.maxStudents': selectedPlan.maxStudents,
        'subscription.maxTeachers': selectedPlan.maxTeachers,
        'subscription.startDate': new Date(),
        'subscription.endDate': endDate,
        'subscription.price': selectedPlan.price,
        'subscription.billingCycle': billingCycle || 'monthly',
        'subscription.paymentId': paymentId
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Payment verified and subscription activated',
      data: {
        subscription: tenant.subscription
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get current subscription details
// @route   GET /api/payments/subscription
// @access  Private (Admin)
router.get('/subscription', protect, getTenantFromRequest, validateTenantAccess, async(req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenant._id)
      .select('subscription schoolName schoolCode');

    res.json({
      success: true,
      data: {
        subscription: tenant.subscription,
        schoolName: tenant.schoolName,
        schoolCode: tenant.schoolCode
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription details'
    });
  }
});

// ============================================================================
// FEE PAYMENT WEBHOOK ENDPOINTS (HDFC/CCAvenue)
// These do NOT require JWT authentication - they receive POST from payment gateway
// ============================================================================

const Fee = require('../models/Fee');
const Payment = require('../models/Payment');
const { logger } = require('../middleware/errorHandler');

// @desc    Payment notification webhook from HDFC/CCAvenue gateway
// @route   POST /api/payments/notify
// @access  Public (from payment gateway)
router.post('/notify', async(req, res) => {
  try {
    const {
      order_id, tracking_id, bank_ref_no, order_status,
      payment_mode, amount, currency, enc_val
    } = req.body;

    // Log all payment notifications
    logger.info('Payment notification received', null, {
      orderId: order_id,
      trackingId: tracking_id,
      status: order_status,
      amount,
      paymentMode: payment_mode
    });

    // Verify payment signature using CCAvenue Working Key
    const workingKey = process.env.CCAVENUE_WORKING_KEY;
    if (workingKey && enc_val) {
      const ccavenueCrypto = require('crypto');
      const md5 = ccavenueCrypto.createHash('md5').update(workingKey).digest();
      const keyBase64 = Buffer.from(md5).toString('base64').substring(0, 16);

      // Verify the encrypted value
      try {
        const decipher = ccavenueCrypto.createDecipheriv('aes-128-cbc', keyBase64, Buffer.alloc(16, 0));
        let decrypted = decipher.update(enc_val, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        // Parse decrypted response
        const params = new URLSearchParams(decrypted);
        const verifiedStatus = params.get('order_status');

        if (verifiedStatus === 'Success') {
          // Find fee record by Order ID and mark as paid
          const fee = await Fee.findOne({ orderId: order_id });
          if (fee) {
            fee.status = 'paid';
            fee.paymentDate = new Date();
            fee.transactionId = tracking_id;
            fee.bankReference = bank_ref_no;
            fee.paymentMode = payment_mode;
            await fee.save();

            // Create payment record
            await Payment.create({
              tenantId: fee.tenantId,
              feeId: fee._id,
              studentId: fee.student,
              amount: Number(amount),
              currency: currency || 'INR',
              orderId: order_id,
              transactionId: tracking_id,
              bankReference: bank_ref_no,
              paymentMode: payment_mode,
              status: 'success',
              gatewayResponse: req.body
            });
          }
        }
      } catch (decryptErr) {
        logger.error('Payment decryption failed', decryptErr, { orderId: order_id });
      }
    } else if (order_status === 'Success' || order_status === 'Shipped') {
      // Fallback for Razorpay or gateways without encryption
      const fee = await Fee.findOne({ orderId: order_id });
      if (fee) {
        fee.status = 'paid';
        fee.paymentDate = new Date();
        fee.transactionId = tracking_id;
        fee.bankReference = bank_ref_no;
        fee.paymentMode = payment_mode;
        await fee.save();

        // Create payment record (was missing in fallback path)
        await Payment.create({
          tenantId: fee.tenantId,
          feeId: fee._id,
          studentId: fee.student,
          amount: Number(amount),
          currency: currency || 'INR',
          orderId: order_id,
          transactionId: tracking_id,
          bankReference: bank_ref_no,
          paymentMode: payment_mode,
          status: 'success',
          gatewayResponse: req.body
        });
      }
    }

    // Always return 200 to the gateway
    res.status(200).json({ success: true, message: 'Notification received' });
  } catch (error) {
    logger.error('Payment webhook error', error, { body: req.body });
    // Still return 200 so gateway doesn't retry indefinitely
    res.status(200).json({ success: true, message: 'Notification acknowledged' });
  }
});

// @desc    Payment success redirect
// @route   POST /api/payments/return
// @access  Public (redirect from payment gateway)
router.post('/return', async(req, res) => {
  try {
    const { order_id } = req.body;
    logger.info('Payment return (success)', null, { orderId: order_id });

    // Redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_ORIGIN || 'https://learnovoapp.vercel.app';
    res.redirect(`${frontendUrl}/app/fees?payment=success&orderId=${order_id}`);
  } catch (error) {
    logger.error('Payment return error', error);
    res.redirect(`${process.env.FRONTEND_ORIGIN || 'https://learnovoapp.vercel.app'}/app/fees?payment=error`);
  }
});

// @desc    Payment cancel redirect
// @route   POST /api/payments/cancel
// @access  Public (redirect from payment gateway)
router.post('/cancel', async(req, res) => {
  try {
    const { order_id } = req.body;
    logger.info('Payment cancelled', null, { orderId: order_id });

    const frontendUrl = process.env.FRONTEND_ORIGIN || 'https://learnovoapp.vercel.app';
    res.redirect(`${frontendUrl}/app/fees?payment=cancelled&orderId=${order_id}`);
  } catch (error) {
    logger.error('Payment cancel error', error);
    res.redirect(`${process.env.FRONTEND_ORIGIN || 'https://learnovoapp.vercel.app'}/app/fees?payment=cancelled`);
  }
});

// @desc    Payment failure redirect
// @route   POST /api/payments/failure
// @access  Public (redirect from payment gateway)
router.post('/failure', async(req, res) => {
  try {
    const { order_id } = req.body;
    logger.info('Payment failed', null, { orderId: order_id });

    // Update fee status — lookup by orderId (orderId is unique across the system)
    if (order_id) {
      const fee = await Fee.findOne({ orderId: order_id });
      if (fee) {
        fee.status = 'failed';
        fee.failedAt = new Date();
        await fee.save();
      }
    }

    const frontendUrl = process.env.FRONTEND_ORIGIN || 'https://learnovoapp.vercel.app';
    res.redirect(`${frontendUrl}/app/fees?payment=failed&orderId=${order_id}`);
  } catch (error) {
    logger.error('Payment failure error', error);
    res.redirect(`${process.env.FRONTEND_ORIGIN || 'https://learnovoapp.vercel.app'}/app/fees?payment=failed`);
  }
});

module.exports = router;

