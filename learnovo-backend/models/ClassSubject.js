const mongoose = require('mongoose');

const classSubjectSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // References
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
        index: true
    },

    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true,
        index: true
    },

    academicSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AcademicSession',
        required: true,
        index: true
    },

    // Marks Configuration (can override subject defaults)
    maxMarks: {
        type: Number,
        min: 0
    },

    passingMarks: {
        type: Number,
        min: 0
    },

    // Subject Properties
    isCompulsory: {
        type: Boolean,
        default: true
    },

    // Status
    isActive: {
        type: Boolean,
        default: true
    },

    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes
classSubjectSchema.index(
    { tenantId: 1, classId: 1, subjectId: 1, academicSessionId: 1 },
    { unique: true }
);
classSubjectSchema.index({ classId: 1 });
classSubjectSchema.index({ subjectId: 1 });

// Validation: Passing marks cannot exceed max marks
classSubjectSchema.pre('validate', function (next) {
    if (this.maxMarks && this.passingMarks && this.passingMarks > this.maxMarks) {
        next(new Error('Passing marks cannot exceed maximum marks'));
    } else {
        next();
    }
});

module.exports = mongoose.model('ClassSubject', classSubjectSchema);
