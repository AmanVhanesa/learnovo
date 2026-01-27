const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    exam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    marksObtained: {
        type: Number,
        required: true,
        min: 0
    },
    remarks: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Ensure one result per student per exam
resultSchema.index({ exam: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);
