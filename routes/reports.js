const express = require('express');
const { protect } = require('../middleware/auth');
const Fee = require('../models/Fee');
const User = require('../models/User');
const Admission = require('../models/Admission');

const router = express.Router();

// @desc    Get dashboard statistics
// @route   GET /api/reports/dashboard
// @access  Private
router.get('/dashboard', protect, async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenantId;

    // Build filter based on user role and tenant
    const studentFilter = { tenantId: tenantId };
    const feeFilter = {};
    const attendanceFilter = { tenantId: tenantId };

    if (user.role === 'teacher') {
      // Teacher visibility: students in classes where teacher is assigned
      const teacherAssignedClasses = Array.isArray(user.assignedClasses) ? user.assignedClasses : [];
      if (teacherAssignedClasses.length > 0) {
        // Find students by class name (since class field is string)
        const studentsInClass = await User.find({
          role: 'student',
          class: { $in: teacherAssignedClasses },
          tenantId: tenantId
        }).select('_id');
        const ids = studentsInClass.map(s => s._id);
        if (ids.length > 0) {
          studentFilter._id = { $in: ids };
          feeFilter.student = { $in: ids };
          attendanceFilter.student = { $in: ids };
        } else {
          // If no students found, return empty stats
          studentFilter._id = { $in: [] };
        }
      }
    } else if (user.role === 'student') {
      studentFilter._id = user._id;
      feeFilter.student = user._id;
      attendanceFilter.student = user._id;
    } else if (user.role === 'parent') {
      // Parent visibility: their children
      if (user.children && Array.isArray(user.children) && user.children.length > 0) {
        studentFilter._id = { $in: user.children };
        feeFilter.student = { $in: user.children };
        attendanceFilter.student = { $in: user.children };
      } else {
        studentFilter._id = { $in: [] };
      }
    }

    const statistics = {
      students: { total: 0, active: 0 },
      teachers: { total: 0, active: 0 },
      admissions: { total: 0, pending: 0, approved: 0, rejected: 0 },
      fees: { total: 0, paid: 0, pending: 0, overdue: 0 },
    };

    // ── Admin dashboard: run all counts in parallel ──────────────────────
    if (user.role === 'admin') {
      // Fee aggregation pipeline — single query replaces fetch-all + filter
      const feeAggPipeline = [
        { $match: { tenantId, ...feeFilter } },
        { $group: {
          _id: null,
          total: { $sum: '$amount' },
          paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
          overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] } },
        }}
      ];

      // Build the 6-month enrollment trend promises in advance
      const trendPromises = [];
      const trendLabels = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        trendLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        trendPromises.push(
          User.countDocuments({ role: 'student', tenantId, createdAt: { $gte: start, $lte: end } })
        );
      }

      const [
        totalStudents, activeStudents,
        totalTeachers, activeTeachers,
        totalAdmissions, pendingAdmissions, approvedAdmissions, rejectedAdmissions,
        feeAgg,
        ...trendCounts
      ] = await Promise.all([
        User.countDocuments({ role: 'student', tenantId }),
        User.countDocuments({ role: 'student', isActive: true, tenantId }),
        User.countDocuments({ role: 'teacher', tenantId }),
        User.countDocuments({ role: 'teacher', isActive: true, tenantId }),
        Admission.countDocuments({ tenantId }),
        Admission.countDocuments({ status: 'pending', tenantId }),
        Admission.countDocuments({ status: 'approved', tenantId }),
        Admission.countDocuments({ status: 'rejected', tenantId }),
        Fee.aggregate(feeAggPipeline),
        ...trendPromises,
      ]);

      const feeTotals = feeAgg[0] || { total: 0, paid: 0, pending: 0, overdue: 0 };

      Object.assign(statistics, {
        students: { total: totalStudents, active: activeStudents },
        teachers: { total: totalTeachers, active: activeTeachers },
        admissions: { total: totalAdmissions, pending: pendingAdmissions, approved: approvedAdmissions, rejected: rejectedAdmissions },
        fees: feeTotals,
        enrollmentTrend: { labels: trendLabels, data: trendCounts },
      });
    }

    // ── Teacher dashboard ──────────────────────────────────────────────
    if (user.role === 'teacher') {
      const myStudentIds = studentFilter._id?.$in || [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const [studentCount, todayAtt, assignmentCount] = await Promise.all([
        User.countDocuments({ role: 'student', tenantId, ...studentFilter }),
        (async () => {
          try {
            const Attendance = require('../models/Attendance');
            return Attendance.countDocuments({
              tenantId, date: { $gte: today, $lt: tomorrow },
              student: { $in: myStudentIds }, status: { $in: ['present', 'late'] }
            });
          } catch { return 0; }
        })(),
        (async () => {
          try {
            const Assignment = require('../models/Assignment');
            return Assignment.countDocuments({ teacher: user._id, tenantId });
          } catch { return 0; }
        })(),
      ]);

      statistics.students = {
        total: studentCount,
        active: studentCount, // teachers only see active students
      };
      statistics.teacher = {
        myStudents: studentCount,
        attendanceToday: studentCount > 0 ? Math.round((todayAtt / studentCount) * 100) : 0,
        activeAssignments: assignmentCount,
        pendingSubmissions: 0,
      };
    }

    // ── Student dashboard ──────────────────────────────────────────────
    if (user.role === 'student') {
      const [pendingFeeCount, assignmentCount] = await Promise.all([
        Fee.countDocuments({ student: user._id, tenantId, status: { $in: ['pending', 'overdue'] } }),
        (async () => {
          try {
            const Assignment = require('../models/Assignment');
            return Assignment.countDocuments({ tenantId, assignedTo: user._id });
          } catch { return 0; }
        })(),
      ]);
      statistics.students = { total: 1, active: user.isActive ? 1 : 0 };
      statistics.student = {
        profileComplete: user.isActive ? 'Complete' : 'Incomplete',
        pendingFees: pendingFeeCount,
        assignments: assignmentCount,
        notifications: 0,
      };
    }

    // ── Parent dashboard ───────────────────────────────────────────────
    if (user.role === 'parent') {
      const childrenIds = user.children && Array.isArray(user.children) ? user.children : [];
      const pendingFeeCount = await Fee.countDocuments({
        student: { $in: childrenIds }, tenantId, status: { $in: ['pending', 'overdue'] }
      });
      statistics.parent = {
        myChildren: childrenIds.length,
        pendingFees: pendingFeeCount,
        notifications: 0,
        performance: 'Good',
      };
    }

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get dashboard statistics error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get recent activities
// @route   GET /api/reports/activities
// @access  Private
router.get('/activities', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const limit = parseInt(req.query.limit) || 10;

    // Arrays to hold different types of activities
    let activities = [];

    // 1. Get recent student enrollments
    const recentStudents = await User.find({
      tenantId: tenantId,
      role: 'student'
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id name fullName firstName lastName createdAt');

    const studentActivities = recentStudents.map(student => ({
      id: `student-${student._id}`,
      type: 'student',
      status: 'success',
      message: `New student enrolled: ${student.fullName || student.name || 'Unknown'}`,
      date: student.createdAt,
      studentName: student.fullName || student.name
    }));

    activities = [...activities, ...studentActivities];

    // 2. Get recent fee payments
    const recentFees = await Fee.find({
      tenantId: tenantId,
      status: 'paid'
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('student', 'name fullName');

    const feeActivities = recentFees.map(fee => ({
      id: `fee-${fee._id}`,
      type: 'fee',
      status: 'success',
      message: `Fee payment of ₹${fee.amount || 0} received`,
      date: fee.updatedAt || fee.createdAt,
      studentName: fee.student ? (fee.student.fullName || fee.student.name) : 'Unknown'
    }));

    activities = [...activities, ...feeActivities];

    // 3. Get recent employees
    const recentEmployees = await User.find({
      tenantId: tenantId,
      role: { $in: ['admin', 'teacher', 'accountant', 'staff'] }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id name fullName firstName lastName createdAt role');

    const employeeActivities = recentEmployees.map(emp => ({
      id: `employee-${emp._id}`,
      type: 'employee',
      status: 'success',
      message: `New employee added: ${emp.fullName || emp.name || emp.firstName || 'Unknown'} (${emp.role})`,
      date: emp.createdAt,
      studentName: emp.fullName || emp.name || emp.firstName // Used for generic name display in UI
    }));

    activities = [...activities, ...employeeActivities];

    // 4. Sort combined activities by date descending
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 4. Apply limit
    const finalActivities = activities.slice(0, limit);

    res.json({
      success: true,
      data: finalActivities
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching activities'
    });
  }
});

module.exports = router;
