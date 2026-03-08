const mongoose = require('mongoose');
const Counter = require('./Counter');

const paymentSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Receipt Number (Auto-generated)
    receiptNumber: {
        type: String,
        required: true,
        unique: true
    },

    // Student & Invoice
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

    // Payment Details
    amount: {
        type: Number,
        required: true,
        min: 0
    },

    paymentMethod: {
        type: String,
        enum: ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Online'],
        required: true
    },

    // Payment Method Specific Details
    transactionDetails: {
        transactionId: String,
        bankName: String,
        chequeNumber: String,
        chequeDate: Date,
        upiId: String,
        referenceNumber: String
    },

    paymentDate: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },

    // Allocation (for partial payments)
    allocation: [{
        feeHeadName: String,
        amount: Number
    }],

    remarks: {
        type: String,
        trim: true
    },

    // Immutability & Confirmation
    isConfirmed: {
        type: Boolean,
        default: false
    },

    confirmedAt: {
        type: Date
    },

    confirmedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Reversal (Only way to "undo" a payment)
    isReversed: {
        type: Boolean,
        default: false,
        index: true
    },

    reversedAt: {
        type: Date
    },

    reversedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    reversalReason: {
        type: String,
        trim: true
    },

    reversalPaymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment' // Points to the reversal payment record
    },

    // Metadata
    collectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
paymentSchema.index({ tenantId: 1, receiptNumber: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, studentId: 1, paymentDate: 1 });
paymentSchema.index({ tenantId: 1, invoiceId: 1 });
paymentSchema.index({ tenantId: 1, paymentDate: 1 });
paymentSchema.index({ tenantId: 1, isConfirmed: 1 });

// Static method to generate receipt number
paymentSchema.statics.generateReceiptNumber = async function (tenantId) {
    const year = new Date().getFullYear();
    const counter = await Counter.getNextSequence(`receipt_${tenantId}_${year}`);
    return `RCP-${year}-${String(counter).padStart(5, '0')}`;
};

// Method to confirm payment (makes it immutable)
paymentSchema.methods.confirm = async function (userId) {
    if (this.isConfirmed) {
        throw new Error('Payment is already confirmed');
    }

    this.isConfirmed = true;
    this.confirmedAt = new Date();
    this.confirmedBy = userId;

    return this.save();
};

// Method to reverse payment
paymentSchema.methods.reverse = async function (userId, reason) {
    if (!this.isConfirmed) {
        throw new Error('Only confirmed payments can be reversed');
    }

    if (this.isReversed) {
        throw new Error('Payment is already reversed');
    }

    // Create reversal payment record
    const reversalPayment = new this.constructor({
        tenantId: this.tenantId,
        receiptNumber: await this.constructor.generateReceiptNumber(this.tenantId),
        studentId: this.studentId,
        invoiceId: this.invoiceId,
        amount: -this.amount, // Negative amount for reversal
        paymentMethod: this.paymentMethod,
        paymentDate: new Date(),
        remarks: `Reversal of ${this.receiptNumber}: ${reason}`,
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedBy: userId,
        collectedBy: userId
    });

    await reversalPayment.save();

    // Mark original as reversed
    this.isReversed = true;
    this.reversedAt = new Date();
    this.reversedBy = userId;
    this.reversalReason = reason;
    this.reversalPaymentId = reversalPayment._id;

    return this.save();
};

// Prevent modification of confirmed payments
paymentSchema.pre('save', function (next) {
    if (!this.isNew && this.isConfirmed && this.isModified()) {
        // Allow only reversal fields to be modified
        const modifiedPaths = this.modifiedPaths();
        const allowedModifications = ['isReversed', 'reversedAt', 'reversedBy', 'reversalReason', 'reversalPaymentId'];

        const hasDisallowedModification = modifiedPaths.some(path => !allowedModifications.includes(path));

        if (hasDisallowedModification) {
            return next(new Error('Confirmed payments cannot be modified. Use reversal instead.'));
        }
    }
    next();
});

module.exports = mongoose.model('Payment', paymentSchema);
