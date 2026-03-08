const mongoose = require('mongoose');

const homeworkSubmissionSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // References
    homeworkId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Homework',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Submission content
    submissionText: {
        type: String,
        trim: true
    },

    // Attachments (images and files)
    attachments: [{
        fileName: {
            type: String,
            required: true
        },
        fileUrl: {
            type: String,
            required: true
        },
        fileType: {
            type: String,
            required: true
        },
        fileSize: {
            type: Number,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Status
    status: {
        type: String,
        enum: ['pending', 'submitted', 'reviewed'],
        default: 'pending'
    },

    // Submission timestamp
    submittedAt: {
        type: Date
    },

    // Teacher feedback
    teacherFeedback: {
        type: String,
        trim: true
    },
    grade: {
        type: Number,
        min: 0
    },
    reviewedAt: {
        type: Date
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for better query performance
homeworkSubmissionSchema.index({ tenantId: 1, homeworkId: 1 });
homeworkSubmissionSchema.index({ tenantId: 1, studentId: 1 });
homeworkSubmissionSchema.index({ tenantId: 1, status: 1 });
homeworkSubmissionSchema.index({ homeworkId: 1, studentId: 1 }, { unique: true }); // One submission per student per homework

// Pre-save middleware
homeworkSubmissionSchema.pre('save', function (next) {
    this.updatedAt = new Date();

    // Set submittedAt when status changes to submitted
    if (this.isModified('status') && this.status === 'submitted' && !this.submittedAt) {
        this.submittedAt = new Date();
    }

    // Set reviewedAt when feedback is added
    if (this.isModified('teacherFeedback') && this.teacherFeedback && !this.reviewedAt) {
        this.reviewedAt = new Date();
        this.status = 'reviewed';
    }

    next();
});

module.exports = mongoose.model('HomeworkSubmission', homeworkSubmissionSchema);
