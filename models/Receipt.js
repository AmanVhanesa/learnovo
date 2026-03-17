const mongoose = require('mongoose');
const Counter = require('./Counter');

const receiptSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Link to the exact attempt that was successful
    paymentAttemptId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentAttempt',
        required: true,
        unique: true
    },

    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeeInvoice',
        required: true,
        index: true
    },

    // Auto-generated receipt number via Counter model
    receiptNumber: {
        type: String,
        required: true,
        unique: true
    },

    // Optional reference if PDF is generated/stored later
    pdfPath: {
        type: String
    },

    // Who initiated the payment: 'student' or 'admin'
    initiatedBy: {
        type: String,
        enum: ['student', 'admin'],
        default: 'student'
    },

    // Admin who verified or recorded the payment
    verifiedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    verifiedByName: {
        type: String,
        default: null
    },

    // Payment details for the receipt
    amount: { type: Number, default: 0 },
    paymentMode: { type: String, default: null },
    transactionRefId: { type: String, default: null },
    paymentDate: { type: Date, default: null },

    issuedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Static method to generate receipt number
receiptSchema.statics.generateReceiptNumber = async function (tenantId) {
    const year = new Date().getFullYear();
    const counter = await Counter.getNextSequence(`student_receipt_${tenantId}_${year}`);
    return `RCP-STU-${year}-${String(counter).padStart(5, '0')}`;
};

module.exports = mongoose.model('Receipt', receiptSchema);
