const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: [true, 'Exam name is required'],
        trim: true
    },
    examType: {
        type: String,
        enum: ['Quiz', 'Midterm', 'Final', 'Assignment', 'Other'],
        default: 'Midterm'
    },
    class: {
        type: String,
        required: [true, 'Class is required'],
        trim: true
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true
    },
    date: {
        type: Date,
        required: [true, 'Date is required']
    },
    totalMarks: {
        type: Number,
        required: [true, 'Total marks are required'],
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Scheduled', 'Completed', 'Cancelled'],
        default: 'Scheduled'
    }
}, {
    timestamps: true
});

examSchema.index({ tenantId: 1, class: 1, subject: 1 });

module.exports = mongoose.model('Exam', examSchema);
