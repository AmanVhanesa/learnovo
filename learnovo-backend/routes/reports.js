const express = require('express');
const { protect } = require('../middleware/auth');
const Fee = require('../models/Fee');
const User = require('../models/User');
const Admission = require('../models/Admission');

const router = express.Router();

// @desc    Get dashboard statistics
// @route   GET /api/reports/dashboard
// @access  Private
router.get('/dashboard', protect, async(req, res) => {
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

    // Get basic statistics (always calculate for admin)
    const statistics = {
      students: {
        total: await User.countDocuments({ role: 'student', tenantId: tenantId, ...studentFilter }),
        active: await User.countDocuments({ role: 'student', isActive: true, tenantId: tenantId, ...studentFilter })
      },
      teachers: {
        total: user.role === 'admin' ? await User.countDocuments({ role: 'teacher', tenantId: tenantId }) : 0,
        active: user.role === 'admin' ? await User.countDocuments({ role: 'teacher', isActive: true, tenantId: tenantId }) : 0
      },
      admissions: {
        total: user.role === 'admin' ? await Admission.countDocuments({ tenantId: tenantId }) : 0,
        pending: user.role === 'admin' ? await Admission.countDocuments({ status: 'pending', tenantId: tenantId }) : 0,
        approved: user.role === 'admin' ? await Admission.countDocuments({ status: 'approved', tenantId: tenantId }) : 0,
        rejected: user.role === 'admin' ? await Admission.countDocuments({ status: 'rejected', tenantId: tenantId }) : 0
      },
      fees: {
        total: 0,
        paid: 0,
        pending: 0,
        overdue: 0
      }
    };

    // Get fee statistics
    const fees = await Fee.find(feeFilter).populate('student');
    statistics.fees.total = fees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
    statistics.fees.paid = fees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + (fee.amount || 0), 0);
    statistics.fees.pending = fees.filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + (fee.amount || 0), 0);
    statistics.fees.overdue = fees.filter(fee => fee.status === 'overdue').reduce((sum, fee) => sum + (fee.amount || 0), 0);

    // Role-specific statistics
    if (user.role === 'teacher') {
      const myStudents = await User.find({ role: 'student', tenantId: tenantId, ...studentFilter });
      statistics.teacher = {
        myStudents: myStudents.length,
        attendanceToday: 0,
        activeAssignments: 0,
        pendingSubmissions: 0
      };

      // Get today's attendance (if Attendance model exists)
      try {
        const Attendance = require('../models/Attendance');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayAttendance = await Attendance.find({
          tenantId: tenantId,
          date: { $gte: today, $lt: tomorrow },
          student: { $in: myStudents.map(s => s._id) }
        });
        
        if (todayAttendance.length > 0) {
          const presentCount = todayAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
          statistics.teacher.attendanceToday = myStudents.length > 0 
            ? Math.round((presentCount / myStudents.length) * 100) 
            : 0;
        }
      } catch (attendanceError) {
        console.warn('Attendance model not available:', attendanceError.message);
      }

      // Get assignment statistics (if Assignment model exists)
      try {
        const Assignment = require('../models/Assignment');
        const assignments = await Assignment.find({
          teacher: user._id,
          tenantId: tenantId
        });
        statistics.teacher.activeAssignments = assignments.filter(a => a.status === 'active' || !a.status).length;
        // Calculate pending submissions (simplified - would need submission model)
        statistics.teacher.pendingSubmissions = 0;
      } catch (assignmentError) {
        console.warn('Assignment model not available:', assignmentError.message);
      }

    } else if (user.role === 'student') {
      const studentFees = await Fee.find({ student: user._id, tenantId: tenantId });
      const pendingFeeCount = studentFees.filter(f => f.status === 'pending' || f.status === 'overdue').length;
      
      statistics.student = {
        profileComplete: user.isActive ? 'Complete' : 'Incomplete',
        pendingFees: pendingFeeCount,
        assignments: 0,
        notifications: 0
      };

      // Get assignment count (if Assignment model exists)
      try {
        const Assignment = require('../models/Assignment');
        const assignments = await Assignment.find({
          tenantId: tenantId,
          assignedTo: user._id
        });
        statistics.student.assignments = assignments.length;
      } catch (assignmentError) {
        console.warn('Assignment model not available:', assignmentError.message);
      }

      // Get notification count (would need Notification model)
      statistics.student.notifications = 0;

    } else if (user.role === 'parent') {
      const childrenCount = user.children && Array.isArray(user.children) ? user.children.length : 0;
      const childrenFees = await Fee.find({ student: { $in: user.children || [] }, tenantId: tenantId });
      const pendingFeeCount = childrenFees.filter(f => f.status === 'pending' || f.status === 'overdue').length;

      statistics.parent = {
        myChildren: childrenCount,
        pendingFees: pendingFeeCount,
        notifications: 0,
        performance: 'Good' // Would need actual calculation
      };
    }

    // Get enrollment trend (last 6 months) for admin
    if (user.role === 'admin') {
      const enrollmentTrend = [];
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        months.push(date.toLocaleDateString('en-US', { month: 'short' }));
        const count = await User.countDocuments({
          role: 'student',
          tenantId: tenantId,
          createdAt: { $gte: monthStart, $lte: monthEnd }
        });
        enrollmentTrend.push(count);
      }
      statistics.enrollmentTrend = {
        labels: months,
        data: enrollmentTrend
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

module.exports = router;
