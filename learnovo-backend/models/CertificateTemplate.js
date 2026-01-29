const mongoose = require('mongoose');

const certificateTemplateSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['TC', 'BONAFIDE'],
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        default: function () {
            return this.type === 'TC' ? 'School Leaving Certificate' : 'Bonafide Certificate';
        }
    },
    headerText: {
        type: String,
        trim: true,
        default: ''
    },
    declarationText: {
        type: String,
        trim: true,
        default: function () {
            if (this.type === 'BONAFIDE') {
                return 'This is to certify that the above student is a bonafide student of this institution.';
            }
            return '';
        }
    },
    footerText: {
        type: String,
        trim: true,
        default: ''
    },
    logoPosition: {
        type: String,
        enum: ['LEFT', 'CENTER', 'RIGHT', 'NONE'],
        default: 'CENTER'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Compound index to ensure one active template per type per tenant (optional, currently allowing multiple)
certificateTemplateSchema.index({ tenantId: 1, type: 1 });

module.exports = mongoose.model('CertificateTemplate', certificateTemplateSchema);
