const mongoose = require('mongoose');

const studentListSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'List name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant ID is required']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Created By is required']
    }
}, { timestamps: true });

module.exports = mongoose.model('StudentList', studentListSchema);
