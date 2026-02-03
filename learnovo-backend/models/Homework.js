const mongoose = require('mongoose');

const homeworkSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Homework details
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true
    },

    // Subject and class information
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: [true, 'Subject is required']
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: [true, 'Class is required']
    },
    section: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Section'
    },

    // Teacher information
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Dates
    assignedDate: {
        type: Date,
        required: [true, 'Assigned date is required'],
        default: Date.now
    },
    dueDate: {
        type: Date,
        required: [true, 'Due date is required']
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
    isActive: {
        type: Boolean,
        default: true
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
homeworkSchema.index({ tenantId: 1, class: 1 });
homeworkSchema.index({ tenantId: 1, assignedBy: 1 });
homeworkSchema.index({ tenantId: 1, subject: 1 });
homeworkSchema.index({ tenantId: 1, dueDate: 1 });
homeworkSchema.index({ tenantId: 1, isActive: 1 });

// Pre-save middleware
homeworkSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Homework', homeworkSchema);
