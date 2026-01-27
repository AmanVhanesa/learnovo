const mongoose = require('mongoose');

const studentBalanceSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Student & Session
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    academicSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AcademicSession',
        required: true,
        index: true
    },

    // Financial Summary (All derived from transactions)
    totalInvoiced: {
        type: Number,
        default: 0,
        min: 0
    },

    totalPaid: {
        type: Number,
        default: 0,
        min: 0
    },

    totalBalance: {
        type: Number,
        default: 0
        // Can be negative (advance payment)
    },

    // Last Payment Info
    lastPaymentDate: {
        type: Date
    },

    lastPaymentAmount: {
        type: Number
    },

    // Carry Forward from Previous Session
    carryForwardBalance: {
        type: Number,
        default: 0
    },

    carryForwardDate: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes
studentBalanceSchema.index({ tenantId: 1, studentId: 1, academicSessionId: 1 }, { unique: true });
studentBalanceSchema.index({ tenantId: 1, totalBalance: 1 }); // For defaulters query
studentBalanceSchema.index({ tenantId: 1, academicSessionId: 1, totalBalance: 1 });

// Static method to update balance for a student
studentBalanceSchema.statics.updateBalance = async function (tenantId, studentId, academicSessionId) {
    const FeeInvoice = mongoose.model('FeeInvoice');
    const Payment = mongoose.model('Payment');

    // Calculate total invoiced
    const invoiceAgg = await FeeInvoice.aggregate([
        {
            $match: {
                tenantId: mongoose.Types.ObjectId(tenantId),
                studentId: mongoose.Types.ObjectId(studentId),
                academicSessionId: mongoose.Types.ObjectId(academicSessionId),
                status: { $ne: 'Cancelled' }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $add: ['$totalAmount', '$lateFeeApplied'] } }
            }
        }
    ]);

    const totalInvoiced = invoiceAgg.length > 0 ? invoiceAgg[0].total : 0;

    // Calculate total paid
    const paymentAgg = await Payment.aggregate([
        {
            $match: {
                tenantId: mongoose.Types.ObjectId(tenantId),
                studentId: mongoose.Types.ObjectId(studentId),
                isConfirmed: true,
                isReversed: false
            }
        },
        {
            $lookup: {
                from: 'feeinvoices',
                localField: 'invoiceId',
                foreignField: '_id',
                as: 'invoice'
            }
        },
        {
            $unwind: '$invoice'
        },
        {
            $match: {
                'invoice.academicSessionId': mongoose.Types.ObjectId(academicSessionId)
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' }
            }
        }
    ]);

    const totalPaid = paymentAgg.length > 0 ? paymentAgg[0].total : 0;

    // Get last payment
    const lastPayment = await Payment.findOne({
        tenantId: mongoose.Types.ObjectId(tenantId),
        studentId: mongoose.Types.ObjectId(studentId),
        isConfirmed: true,
        isReversed: false
    }).sort({ paymentDate: -1 });

    // Find or create balance record
    const balance = await this.findOneAndUpdate(
        { tenantId, studentId, academicSessionId },
        {
            $set: {
                totalInvoiced,
                totalPaid,
                totalBalance: totalInvoiced - totalPaid,
                lastPaymentDate: lastPayment?.paymentDate,
                lastPaymentAmount: lastPayment?.amount
            }
        },
        { upsert: true, new: true }
    );

    return balance;
};

// Static method to get defaulters
studentBalanceSchema.statics.getDefaulters = async function (tenantId, academicSessionId, options = {}) {
    const query = {
        tenantId: mongoose.Types.ObjectId(tenantId),
        academicSessionId: mongoose.Types.ObjectId(academicSessionId),
        totalBalance: { $gt: 0 }
    };

    if (options.minBalance) {
        query.totalBalance.$gte = options.minBalance;
    }

    const defaulters = await this.find(query)
        .populate('studentId', 'name studentId phone email classId sectionId')
        .populate('academicSessionId', 'name')
        .sort({ totalBalance: -1 })
        .limit(options.limit || 1000);

    return defaulters;
};

module.exports = mongoose.model('StudentBalance', studentBalanceSchema);
