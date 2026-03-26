const mongoose = require('mongoose');

const teacherSubjectAssignmentSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // References
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true,
        index: true
    },

    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
        index: true
    },

    sectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Section',
        index: true // Optional: null means all sections
    },

    academicSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AcademicSession',
        required: true,
        index: true
    },

    // Assignment Properties
    isPrimary: {
        type: Boolean,
        default: true // Primary teacher for this subject
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
teacherSubjectAssignmentSchema.index(
    { tenantId: 1, teacherId: 1, subjectId: 1, classId: 1, sectionId: 1, academicSessionId: 1 },
    { unique: true }
);
teacherSubjectAssignmentSchema.index({ teacherId: 1 });
teacherSubjectAssignmentSchema.index({ classId: 1, subjectId: 1 });
teacherSubjectAssignmentSchema.index({ academicSessionId: 1 });

module.exports = mongoose.model('TeacherSubjectAssignment', teacherSubjectAssignmentSchema);
