const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const User = require('../models/User');

/**
 * Notification Service
 * Centralized service for creating and managing notifications across the system
 */

// ============================================================================
// CORE NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Create a single notification
 * @param {Object} params - Notification parameters
 * @returns {Promise<Object>} Created notification
 */
async function createNotification({
    tenantId,
    userId,
    title,
    message,
    type = 'info',
    category,
    actionUrl = null,
    actionLabel = null,
    metadata = {}
}) {
    try {
        // Check user preferences
        const shouldSend = await NotificationPreference.shouldNotify(userId, tenantId, category, 'inApp');

        if (!shouldSend) {
            console.log(`Notification skipped for user ${userId} - category ${category} disabled`);
            return null;
        }

        const notification = await Notification.create({
            tenantId,
            userId,
            title,
            message,
            type,
            category,
            actionUrl,
            actionLabel,
            metadata,
            channels: {
                inApp: {
                    enabled: true,
                    deliveredAt: new Date()
                }
            }
        });

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

/**
 * Create multiple notifications (bulk)
 * @param {Array} notifications - Array of notification objects
 * @returns {Promise<Array>} Created notifications
 */
async function createBulkNotifications(notifications) {
    try {
        // Filter notifications based on user preferences
        const filteredNotifications = [];

        for (const notif of notifications) {
            const shouldSend = await NotificationPreference.shouldNotify(
                notif.userId,
                notif.tenantId,
                notif.category,
                'inApp'
            );

            if (shouldSend) {
                filteredNotifications.push({
                    ...notif,
                    channels: {
                        inApp: {
                            enabled: true,
                            deliveredAt: new Date()
                        }
                    }
                });
            }
        }

        if (filteredNotifications.length === 0) {
            return [];
        }

        const created = await Notification.insertMany(filteredNotifications);
        return created;
    } catch (error) {
        console.error('Error creating bulk notifications:', error);
        throw error;
    }
}

/**
 * Get notifications for a user with filtering and pagination
 */
async function getNotifications(userId, tenantId, options = {}) {
    const {
        page = 1,
        limit = 20,
        isRead = null,
        category = null,
        startDate = null,
        endDate = null
    } = options;

    const query = {
        userId,
        tenantId,
        isDeleted: false
    };

    if (isRead !== null && isRead !== 'all') {
        // Handle both string and boolean values
        if (isRead === 'true' || isRead === true) {
            query.isRead = true;
        } else if (isRead === 'false' || isRead === false) {
            query.isRead = false;
        }
    }

    if (category) {
        query.category = category;
    }

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
        Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Notification.countDocuments(query)
    ]);

    return {
        notifications,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    };
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId, tenantId) {
    return await Notification.getUnreadCount(userId, tenantId);
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId, userId, tenantId) {
    const notification = await Notification.findOne({
        _id: notificationId,
        userId,
        tenantId,
        isDeleted: false
    });

    if (!notification) {
        throw new Error('Notification not found');
    }

    return await notification.markAsRead();
}

/**
 * Mark all notifications as read for a user
 */
async function markAllAsRead(userId, tenantId) {
    return await Notification.markAllAsRead(userId, tenantId);
}

/**
 * Soft delete a notification
 */
async function deleteNotification(notificationId, userId, tenantId) {
    const notification = await Notification.findOne({
        _id: notificationId,
        userId,
        tenantId
    });

    if (!notification) {
        throw new Error('Notification not found');
    }

    return await notification.softDelete();
}

/**
 * Cleanup old notifications (older than specified days)
 */
async function cleanupOldNotifications(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        isDeleted: true
    });

    return result.deletedCount;
}

// ============================================================================
// ADMISSION NOTIFICATIONS
// ============================================================================

/**
 * Notify admins about new admission application
 */
async function notifyNewAdmission(admission, tenantId) {
    try {
        // Get all admin users for this tenant
        const admins = await User.find({ tenantId, role: 'admin', isActive: true });

        const notifications = admins.map(admin => ({
            tenantId,
            userId: admin._id,
            title: 'New Admission Application',
            message: `New admission application received from ${admission.personalInfo.firstName} ${admission.personalInfo.lastName} for ${admission.academicInfo.classApplied}`,
            type: 'info',
            category: 'admission',
            actionUrl: `/app/admissions/${admission._id}`,
            actionLabel: 'View Application',
            metadata: {
                admissionId: admission._id,
                applicationNumber: admission.applicationNumber
            }
        }));

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyNewAdmission:', error);
    }
}

/**
 * Notify student/parents about admission approval
 */
async function notifyAdmissionApproved(admission, tenantId) {
    try {
        const notifications = [];

        // Notify the student if user account exists
        if (admission.student) {
            notifications.push({
                tenantId,
                userId: admission.student,
                title: 'Admission Approved! 🎉',
                message: `Congratulations! Your admission application for ${admission.academicInfo.classApplied} has been approved.`,
                type: 'success',
                category: 'admission',
                actionUrl: `/app/admissions/${admission._id}`,
                actionLabel: 'View Details',
                metadata: {
                    admissionId: admission._id,
                    applicationNumber: admission.applicationNumber
                }
            });
        }

        // TODO: Notify parents when family/guardian system is implemented

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyAdmissionApproved:', error);
    }
}

/**
 * Notify student/parents about admission rejection
 */
async function notifyAdmissionRejected(admission, tenantId) {
    try {
        const notifications = [];

        // Notify the student if user account exists
        if (admission.student) {
            notifications.push({
                tenantId,
                userId: admission.student,
                title: 'Admission Application Update',
                message: `Your admission application for ${admission.academicInfo.classApplied} has been reviewed. ${admission.reviewInfo?.rejectionReason || 'Please contact the school for more information.'}`,
                type: 'warning',
                category: 'admission',
                actionUrl: `/app/admissions/${admission._id}`,
                actionLabel: 'View Details',
                metadata: {
                    admissionId: admission._id,
                    applicationNumber: admission.applicationNumber
                }
            });
        }

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyAdmissionRejected:', error);
    }
}

// ============================================================================
// FEE NOTIFICATIONS
// ============================================================================

/**
 * Notify student/parents about new fee invoice
 */
async function notifyFeeInvoiceGenerated(fee, student, tenantId) {
    try {
        const notifications = [];

        // Notify the student
        notifications.push({
            tenantId,
            userId: student._id,
            title: 'New Fee Invoice Generated',
            message: `Fee invoice for ${fee.description} - ${fee.currency} ${fee.amount.toLocaleString()} has been generated. Due date: ${new Date(fee.dueDate).toLocaleDateString()}`,
            type: 'info',
            category: 'fee',
            actionUrl: `/app/fees`,
            actionLabel: 'View Invoice',
            metadata: {
                feeId: fee._id,
                amount: fee.amount,
                currency: fee.currency,
                dueDate: fee.dueDate
            }
        });

        // Notify parents if family exists
        if (student.familyId) {
            const family = await User.find({
                familyId: student.familyId,
                role: 'parent',
                tenantId,
                isActive: true
            });

            family.forEach(parent => {
                notifications.push({
                    tenantId,
                    userId: parent._id,
                    title: 'Fee Invoice for Your Child',
                    message: `Fee invoice for ${student.name} - ${fee.description}: ${fee.currency} ${fee.amount.toLocaleString()}. Due: ${new Date(fee.dueDate).toLocaleDateString()}`,
                    type: 'info',
                    category: 'fee',
                    actionUrl: `/app/students/${student._id}`,
                    actionLabel: 'View Details',
                    metadata: {
                        feeId: fee._id,
                        studentId: student._id,
                        amount: fee.amount
                    }
                });
            });
        }

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyFeeInvoiceGenerated:', error);
    }
}

/**
 * Notify student/parents about fee payment received
 */
async function notifyFeePaymentReceived(payment, student, tenantId) {
    try {
        const notifications = [];

        // Notify the student
        notifications.push({
            tenantId,
            userId: student._id,
            title: 'Payment Received ✓',
            message: `Payment of ${payment.currency} ${payment.amount.toLocaleString()} has been received for ${payment.description || 'fee payment'}.`,
            type: 'success',
            category: 'fee',
            actionUrl: `/app/fees`,
            actionLabel: 'View Receipt',
            metadata: {
                paymentId: payment._id,
                amount: payment.amount,
                currency: payment.currency
            }
        });

        // Notify parents
        if (student.familyId) {
            const family = await User.find({
                familyId: student.familyId,
                role: 'parent',
                tenantId,
                isActive: true
            });

            family.forEach(parent => {
                notifications.push({
                    tenantId,
                    userId: parent._id,
                    title: 'Payment Received for Your Child',
                    message: `Payment of ${payment.currency} ${payment.amount.toLocaleString()} received for ${student.name}.`,
                    type: 'success',
                    category: 'fee',
                    actionUrl: `/app/students/${student._id}`,
                    actionLabel: 'View Receipt',
                    metadata: {
                        paymentId: payment._id,
                        studentId: student._id
                    }
                });
            });
        }

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyFeePaymentReceived:', error);
    }
}

/**
 * Notify student/parents about fee payment reminder
 */
async function notifyFeeReminder(fee, student, tenantId) {
    try {
        const notifications = [];
        const daysUntilDue = Math.ceil((new Date(fee.dueDate) - new Date()) / (1000 * 60 * 60 * 24));

        // Notify the student
        notifications.push({
            tenantId,
            userId: student._id,
            title: 'Fee Payment Reminder',
            message: `Reminder: ${fee.description} payment of ${fee.currency} ${fee.amount.toLocaleString()} is due in ${daysUntilDue} days (${new Date(fee.dueDate).toLocaleDateString()}).`,
            type: 'warning',
            category: 'fee',
            actionUrl: `/app/fees`,
            actionLabel: 'Pay Now',
            metadata: {
                feeId: fee._id,
                daysUntilDue
            }
        });

        // Notify parents
        if (student.familyId) {
            const family = await User.find({
                familyId: student.familyId,
                role: 'parent',
                tenantId,
                isActive: true
            });

            family.forEach(parent => {
                notifications.push({
                    tenantId,
                    userId: parent._id,
                    title: 'Fee Payment Reminder',
                    message: `Reminder: Fee payment for ${student.name} - ${fee.description} (${fee.currency} ${fee.amount.toLocaleString()}) due in ${daysUntilDue} days.`,
                    type: 'warning',
                    category: 'fee',
                    actionUrl: `/app/students/${student._id}`,
                    actionLabel: 'View Details',
                    metadata: {
                        feeId: fee._id,
                        studentId: student._id
                    }
                });
            });
        }

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyFeeReminder:', error);
    }
}

/**
 * Notify about fee defaulter status
 */
async function notifyFeeDefaulter(student, tenantId, overdueAmount) {
    try {
        const notifications = [];

        // Notify the student
        notifications.push({
            tenantId,
            userId: student._id,
            title: 'Overdue Fee Payment',
            message: `You have overdue fee payments totaling ${student.currency || 'INR'} ${overdueAmount.toLocaleString()}. Please clear your dues immediately.`,
            type: 'error',
            category: 'fee',
            actionUrl: `/app/fees`,
            actionLabel: 'View Dues',
            metadata: {
                studentId: student._id,
                overdueAmount
            }
        });

        // Notify parents
        if (student.familyId) {
            const family = await User.find({
                familyId: student.familyId,
                role: 'parent',
                tenantId,
                isActive: true
            });

            family.forEach(parent => {
                notifications.push({
                    tenantId,
                    userId: parent._id,
                    title: 'Overdue Fee Payment',
                    message: `${student.name} has overdue fee payments totaling ${student.currency || 'INR'} ${overdueAmount.toLocaleString()}. Please clear the dues immediately.`,
                    type: 'error',
                    category: 'fee',
                    actionUrl: `/app/students/${student._id}`,
                    actionLabel: 'View Dues',
                    metadata: {
                        studentId: student._id,
                        overdueAmount
                    }
                });
            });
        }

        // Notify admins
        const admins = await User.find({ tenantId, role: 'admin', isActive: true }).limit(5);
        admins.forEach(admin => {
            notifications.push({
                tenantId,
                userId: admin._id,
                title: 'Fee Defaulter Alert',
                message: `${student.name} (${student.admissionNumber}) has overdue fees: ${student.currency || 'INR'} ${overdueAmount.toLocaleString()}`,
                type: 'warning',
                category: 'fee',
                actionUrl: `/app/students/${student._id}`,
                actionLabel: 'View Student',
                metadata: {
                    studentId: student._id,
                    overdueAmount
                }
            });
        });

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyFeeDefaulter:', error);
    }
}

// ============================================================================
// ACADEMIC NOTIFICATIONS
// ============================================================================

/**
 * Notify teachers about new class created
 */
async function notifyClassCreated(classData, tenantId) {
    try {
        const teachers = await User.find({ tenantId, role: 'teacher', isActive: true });

        const notifications = teachers.map(teacher => ({
            tenantId,
            userId: teacher._id,
            title: 'New Class Created',
            message: `A new class "${classData.name}" has been created.`,
            type: 'info',
            category: 'academic',
            actionUrl: `/app/academics`,
            actionLabel: 'View Classes',
            metadata: {
                classId: classData._id
            }
        }));

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyClassCreated:', error);
    }
}

/**
 * Notify teacher about subject assignment
 */
async function notifySubjectAssigned(assignment, tenantId) {
    try {
        const teacher = await User.findById(assignment.teacherId);
        if (!teacher) return;

        await assignment.populate('classId subjectId');

        return await createNotification({
            tenantId,
            userId: teacher._id,
            title: 'New Subject Assignment',
            message: `You have been assigned to teach ${assignment.subjectId?.name || 'a subject'} for ${assignment.classId?.name || 'a class'}.`,
            type: 'info',
            category: 'academic',
            actionUrl: `/app/academics`,
            actionLabel: 'View Assignment',
            metadata: {
                assignmentId: assignment._id,
                subjectId: assignment.subjectId?._id,
                classId: assignment.classId?._id
            }
        });
    } catch (error) {
        console.error('Error in notifySubjectAssigned:', error);
    }
}

// ============================================================================
// ATTENDANCE NOTIFICATIONS
// ============================================================================

/**
 * Notify student/parents about absence
 */
async function notifyStudentAbsent(attendance, student, tenantId) {
    try {
        const notifications = [];

        // Notify the student
        notifications.push({
            tenantId,
            userId: student._id,
            title: 'Attendance: Absent',
            message: `You were marked absent on ${new Date(attendance.date).toLocaleDateString()}.`,
            type: 'warning',
            category: 'attendance',
            actionUrl: `/app/attendance`,
            actionLabel: 'View Attendance',
            metadata: {
                attendanceId: attendance._id,
                date: attendance.date
            }
        });

        // Notify parents
        if (student.familyId) {
            const family = await User.find({
                familyId: student.familyId,
                role: 'parent',
                tenantId,
                isActive: true
            });

            family.forEach(parent => {
                notifications.push({
                    tenantId,
                    userId: parent._id,
                    title: 'Student Absence Alert',
                    message: `${student.name} was marked absent on ${new Date(attendance.date).toLocaleDateString()}.`,
                    type: 'warning',
                    category: 'attendance',
                    actionUrl: `/app/students/${student._id}`,
                    actionLabel: 'View Details',
                    metadata: {
                        attendanceId: attendance._id,
                        studentId: student._id,
                        date: attendance.date
                    }
                });
            });
        }

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyStudentAbsent:', error);
    }
}

/**
 * Notify teacher about pending attendance submission
 */
async function notifyAttendanceNotSubmitted(teacher, classData, date, tenantId) {
    try {
        return await createNotification({
            tenantId,
            userId: teacher._id,
            title: 'Attendance Submission Reminder',
            message: `Please submit attendance for ${classData.name} for ${new Date(date).toLocaleDateString()}.`,
            type: 'warning',
            category: 'attendance',
            actionUrl: `/app/attendance`,
            actionLabel: 'Submit Attendance',
            metadata: {
                classId: classData._id,
                date
            }
        });
    } catch (error) {
        console.error('Error in notifyAttendanceNotSubmitted:', error);
    }
}

// ============================================================================
// EMPLOYEE NOTIFICATIONS
// ============================================================================

/**
 * Notify about new employee addition
 */
async function notifyNewEmployee(employee, tenantId) {
    try {
        const notifications = [];

        // Notify the new employee
        notifications.push({
            tenantId,
            userId: employee._id,
            title: 'Welcome to the Team! 🎉',
            message: `Welcome! Your account has been created. Please check your email for login credentials.`,
            type: 'success',
            category: 'employee',
            actionUrl: `/app/dashboard`,
            actionLabel: 'Go to Dashboard',
            metadata: {
                employeeId: employee._id
            }
        });

        // Notify admins
        const admins = await User.find({ tenantId, role: 'admin', isActive: true }).limit(5);
        admins.forEach(admin => {
            if (admin._id.toString() !== employee._id.toString()) {
                notifications.push({
                    tenantId,
                    userId: admin._id,
                    title: 'New Employee Added',
                    message: `${employee.name} has been added as ${employee.role}.`,
                    type: 'info',
                    category: 'employee',
                    actionUrl: `/app/employees/${employee._id}`,
                    actionLabel: 'View Profile',
                    metadata: {
                        employeeId: employee._id
                    }
                });
            }
        });

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyNewEmployee:', error);
    }
}

/**
 * Notify employee about role change
 */
async function notifyRoleChanged(employee, oldRole, newRole, tenantId) {
    try {
        return await createNotification({
            tenantId,
            userId: employee._id,
            title: 'Role Updated',
            message: `Your role has been updated from ${oldRole} to ${newRole}.`,
            type: 'info',
            category: 'employee',
            actionUrl: `/app/dashboard`,
            actionLabel: 'View Dashboard',
            metadata: {
                employeeId: employee._id,
                oldRole,
                newRole
            }
        });
    } catch (error) {
        console.error('Error in notifyRoleChanged:', error);
    }
}

// ============================================================================
// EXAM NOTIFICATIONS
// ============================================================================

/**
 * Notify students about exam scheduled
 */
async function notifyExamScheduled(exam, students, tenantId) {
    try {
        const notifications = students.map(student => ({
            tenantId,
            userId: student._id,
            title: 'Exam Scheduled',
            message: `${exam.name} has been scheduled for ${new Date(exam.date).toLocaleDateString()}.`,
            type: 'info',
            category: 'exam',
            actionUrl: `/app/exams`,
            actionLabel: 'View Exam',
            metadata: {
                examId: exam._id,
                examDate: exam.date
            }
        }));

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyExamScheduled:', error);
    }
}

/**
 * Notify students about results published
 */
async function notifyResultsPublished(exam, students, tenantId) {
    try {
        const notifications = students.map(student => ({
            tenantId,
            userId: student._id,
            title: 'Results Published 📊',
            message: `Results for ${exam.name} have been published.`,
            type: 'success',
            category: 'exam',
            actionUrl: `/app/exams`,
            actionLabel: 'View Results',
            metadata: {
                examId: exam._id
            }
        }));

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifyResultsPublished:', error);
    }
}

// ============================================================================
// SYSTEM NOTIFICATIONS
// ============================================================================

/**
 * Notify user about data export completion
 */
async function notifyDataExportCompleted(user, exportUrl, tenantId) {
    try {
        return await createNotification({
            tenantId,
            userId: user._id,
            title: 'Data Export Ready',
            message: 'Your data export has been completed and is ready for download.',
            type: 'success',
            category: 'system',
            actionUrl: exportUrl,
            actionLabel: 'Download',
            metadata: {
                exportUrl
            }
        });
    } catch (error) {
        console.error('Error in notifyDataExportCompleted:', error);
    }
}

/**
 * Notify users about system updates
 */
async function notifySystemUpdate(message, users, tenantId) {
    try {
        const notifications = users.map(user => ({
            tenantId,
            userId: user._id,
            title: 'System Update',
            message,
            type: 'info',
            category: 'system',
            actionUrl: null,
            actionLabel: null,
            metadata: {}
        }));

        return await createBulkNotifications(notifications);
    } catch (error) {
        console.error('Error in notifySystemUpdate:', error);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Core functions
    createNotification,
    createBulkNotifications,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    cleanupOldNotifications,

    // Admission notifications
    notifyNewAdmission,
    notifyAdmissionApproved,
    notifyAdmissionRejected,

    // Fee notifications
    notifyFeeInvoiceGenerated,
    notifyFeePaymentReceived,
    notifyFeeReminder,
    notifyFeeDefaulter,

    // Academic notifications
    notifyClassCreated,
    notifySubjectAssigned,

    // Attendance notifications
    notifyStudentAbsent,
    notifyAttendanceNotSubmitted,

    // Employee notifications
    notifyNewEmployee,
    notifyRoleChanged,

    // Exam notifications
    notifyExamScheduled,
    notifyResultsPublished,

    // System notifications
    notifyDataExportCompleted,
    notifySystemUpdate
};
