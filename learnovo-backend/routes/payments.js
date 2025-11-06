const express = require('express');
const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const { protect } = require('../middleware/auth');
const { getTenantFromRequest, validateTenantAccess } = require('../middleware/tenant');

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

// Subscription plans
const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic Plan',
    maxStudents: 100,
    maxTeachers: 10,
    price: 999, // in INR
    features: ['100 Students', '10 Teachers', 'Basic Support']
  },
  pro: {
    name: 'Pro Plan',
    maxStudents: 500,
    maxTeachers: 50,
    price: 2999,
    features: ['500 Students', '50 Teachers', 'Priority Support', 'Advanced Reports']
  },
  enterprise: {
    name: 'Enterprise Plan',
    maxStudents: 10000,
    maxTeachers: 500,
    price: 9999,
    features: ['Unlimited Students', '500 Teachers', '24/7 Support', 'All Features', 'Custom Integration']
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
router.post('/create-order', protect, getTenantFromRequest, validateTenantAccess, async (req, res) => {
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
          orderId: 'mock_order_' + Date.now(),
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
router.post('/verify', protect, getTenantFromRequest, validateTenantAccess, async (req, res) => {
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

    const text = orderId + '|' + paymentId;
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
router.get('/subscription', protect, getTenantFromRequest, validateTenantAccess, async (req, res) => {
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

module.exports = router;

