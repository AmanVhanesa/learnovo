const express = require('express');
const { protect } = require('../middleware/auth');
const Fee = require('../models/Fee');
const User = require('../models/User');
const Admission = require('../models/Admission');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');

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

    const TeacherSubjectAssignment = require('../models/TeacherSubjectAssignment');

    // ...

    if (user.role === 'teacher') {
      try {
        const Class = require('../models/Class');
        // 1. Legacy Assignments (String Array)
        const legacyClasses = Array.isArray(user.assignedClasses) ? user.assignedClasses : [];

        // 2. New Teacher Assignments (Relationship Model)
        const assignments = await TeacherSubjectAssignment.find({
          teacherId: user._id,
          tenantId: tenantId,
          isActive: true
        });

        // 3. Class Model Assignments (Embedded Teacher)
        const classAssignments = await Class.find({
          tenantId: tenantId,
          $or: [
            { classTeacher: user._id },
            { 'subjects.teacher': user._id }
          ]
        }).select('name');

        const criteria = [];

        // Add legacy criteria
        if (legacyClasses.length > 0) {
          criteria.push({ class: { $in: legacyClasses } });
        }

        // Add class model criteria
        if (classAssignments.length > 0) {
          const classNames = classAssignments.map(c => c.name);
          criteria.push({ class: { $in: classNames } });
          criteria.push({ classId: { $in: classAssignments.map(c => c._id) } });
        }

        // Add new assignment criteria
        if (assignments.length > 0) {
          assignments.forEach(assign => {
            const clause = { classId: assign.classId };
            if (assign.sectionId) {
              clause.sectionId = assign.sectionId;
            }
            criteria.push(clause);
          });
        }

        // If we have any criteria, find students matching ANY of them
        if (criteria.length > 0) {
          const students = await User.find({
            role: 'student',
            tenantId: tenantId,
            $or: criteria
          }).select('_id');

          const ids = students.map(s => s._id);

          if (ids.length > 0) {
            studentFilter._id = { $in: ids };
            feeFilter.student = { $in: ids };
            attendanceFilter.student = { $in: ids };
          } else {
            // Criteria exist but no students found
            studentFilter._id = { $in: [] };
          }
        } else {
          // No assignments at all
          studentFilter._id = { $in: [] };
        }
      } catch (err) {
        console.error('Teacher stats assignment error:', err);
        // Fallback to empty if error
        studentFilter._id = { $in: [] };
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

    // [ADMIN ONLY] Add statistics from Advanced Fee Module (FeeInvoice & Payment)
    if (user.role === 'admin') {
      try {
        // Pending Dues (Invoice Balance)
        const pendingAgg = await FeeInvoice.aggregate([
          { $match: { tenantId: tenantId, status: { $in: ['Pending', 'Partial', 'Overdue'] } } },
          { $group: { _id: null, total: { $sum: '$balanceAmount' } } }
        ]);
        const pendingAdvanced = pendingAgg.length > 0 ? pendingAgg[0].total : 0;
        statistics.fees.pending += pendingAdvanced;

        // Overdue Amount
        const overdueAgg = await FeeInvoice.aggregate([
          { $match: { tenantId: tenantId, status: 'Overdue' } },
          { $group: { _id: null, total: { $sum: '$balanceAmount' } } }
        ]);
        const overdueAdvanced = overdueAgg.length > 0 ? overdueAgg[0].total : 0;
        statistics.fees.overdue += overdueAdvanced;

        // Paid Amount (Total Collected)
        const paidAgg = await Payment.aggregate([
          { $match: { tenantId: tenantId, isConfirmed: true, isReversed: false } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const paidAdvanced = paidAgg.length > 0 ? paidAgg[0].total : 0;
        statistics.fees.paid += paidAdvanced;

        // Update Total (Collected + Pending balance)
        statistics.fees.total += (paidAdvanced + pendingAdvanced);

      } catch (advancedFeeError) {
        console.error('Error fetching advanced fee stats:', advancedFeeError);
        // Continue with legacy stats only
      }
    }

    // --- NEW DASHBOARD STATS ---
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // 1. Today's Fees
    // Assuming 'paidDate' is set when status is 'paid'. If not, fallback to updatedAt for paid fees.
    const feesToday = fees.filter(fee => {
      if (fee.status !== 'paid') return false;
      const date = fee.paidDate ? new Date(fee.paidDate) : new Date(fee.updatedAt);
      return date >= todayStart && date <= todayEnd;
    });
    statistics.fees.collectedToday = feesToday.reduce((sum, fee) => sum + (fee.amount || 0), 0);

    // [ADMIN ONLY] Add today's collection from Advanced Payment Module
    if (user.role === 'admin') {
      try {
        const paymentsToday = await Payment.aggregate([
          {
            $match: {
              tenantId: tenantId,
              isConfirmed: true,
              isReversed: false,
              paymentDate: { $gte: todayStart, $lte: todayEnd }
            }
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const collectedAdvanced = paymentsToday.length > 0 ? paymentsToday[0].total : 0;
        statistics.fees.collectedToday += collectedAdvanced;
      } catch (paymentError) {
        console.error('Error fetching advanced payment stats:', paymentError);
      }
    }

    // 2. Admissions this month (Count actual newly admitted students)
    // We check both admissionDate and createdAt to cover manual entries and imports
    statistics.admissions.thisMonth = await User.countDocuments({
      role: 'student',
      tenantId: tenantId,
      $or: [
        { admissionDate: { $gte: monthStart } },
        { createdAt: { $gte: monthStart } }
      ]
    });

    // 3. Attendance Today (Global)
    try {
      const Attendance = require('../models/Attendance');

      // Get student attendance
      const studentAttendanceToday = await Attendance.find({
        tenantId: tenantId,
        attendanceType: 'student',
        date: { $gte: todayStart, $lte: todayEnd }
      });

      // Count unique students present (from attendanceRecords)
      const uniqueStudentsPresent = new Set();
      studentAttendanceToday.forEach(attendance => {
        if (attendance.attendanceRecords && Array.isArray(attendance.attendanceRecords)) {
          attendance.attendanceRecords.forEach(record => {
            if (record.status === 'present' || record.status === 'late') {
              uniqueStudentsPresent.add(record.studentId.toString());
            }
          });
        }
      });

      // Get employee attendance
      const employeeAttendanceToday = await Attendance.find({
        tenantId: tenantId,
        attendanceType: 'employee',
        date: { $gte: todayStart, $lte: todayEnd }
      });

      // Count unique employees present (from employeeRecords)
      const uniqueEmployeesPresent = new Set();
      employeeAttendanceToday.forEach(attendance => {
        if (attendance.employeeRecords && Array.isArray(attendance.employeeRecords)) {
          attendance.employeeRecords.forEach(record => {
            if (record.status === 'present' || record.status === 'late') {
              uniqueEmployeesPresent.add(record.employeeId.toString());
            }
          });
        }
      });

      statistics.attendance = {
        studentsPresentToday: uniqueStudentsPresent.size,
        employeesPresentToday: uniqueEmployeesPresent.size
      };
    } catch (err) {
      console.warn('Attendance stats error:', err.message);
      statistics.attendance = { studentsPresentToday: 0, employeesPresentToday: 0 };
    }

    // 4. Upcoming Exams (Global for Admin)
    statistics.upcomingExams = [];
    if (user.role === 'admin') {
      try {
        const Exam = require('../models/Exam'); // Assuming Exam model exists
        const today = new Date();
        statistics.upcomingExams = await Exam.find({
          tenantId: tenantId,
          date: { $gte: today }
        })
          .sort({ date: 1 })
          .limit(5)
          .populate('subject', 'name')
          .populate('class', 'name');
      } catch (err) {
        console.warn('Exam stats error:', err.message);
      }
    }
    // ---------------------------

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

// @desc    Get recent activities
// @route   GET /api/reports/activities
// @access  Private
router.get('/activities', protect, async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenantId;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Get filter params
    const { search, startDate, endDate, type } = req.query;

    const activities = [];

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include entire end date
        dateFilter.$lte = end;
      }
    }

    // 1. Fetch Recent Payments (Collections)
    if ((user.role === 'admin' || user.role === 'accountant') && (!type || type === 'fee' || type === 'payment')) {
      try {
        const Payment = require('../models/Payment');

        let paymentQuery = {
          tenantId,
          isConfirmed: true,
          isReversed: false
        };

        // Apply date filter
        if (Object.keys(dateFilter).length > 0) {
          paymentQuery.paymentDate = dateFilter;
        }

        const payments = await Payment.find(paymentQuery)
          .sort({ paymentDate: -1, createdAt: -1 })
          .limit(limit * 2) // Fetch more to allow for filtering
          .populate('student', 'fullName admissionNumber class');

        payments.forEach(payment => {
          const studentName = payment.student?.fullName || 'Student';
          const message = `Received ${payment.currency || '₹'} ${payment.amount} from ${studentName}`;

          // Apply search filter
          if (search && !message.toLowerCase().includes(search.toLowerCase()) &&
            !studentName.toLowerCase().includes(search.toLowerCase())) {
            return; // Skip this activity
          }

          activities.push({
            id: payment._id,
            type: 'fee',
            message,
            date: payment.paymentDate || payment.createdAt,
            amount: payment.amount,
            studentName,
            status: 'success',
            icon: 'DollarSign'
          });
        });
      } catch (err) {
        console.warn('Payment model error:', err.message);
      }
    }

    // 2. Fetch Recent Admissions (New Students)
    if ((user.role === 'admin' || user.role === 'teacher') && (!type || type === 'admission' || type === 'student')) {
      try {
        let studentQuery = {
          tenantId,
          role: 'student'
        };

        // Apply date filter
        if (Object.keys(dateFilter).length > 0) {
          studentQuery.createdAt = dateFilter;
        }

        const students = await User.find(studentQuery)
          .sort({ createdAt: -1 })
          .limit(limit * 2)
          .select('fullName admissionNumber class createdAt admissionDate');

        students.forEach(student => {
          const studentName = student.fullName || 'Student';
          const message = `New Admission: ${studentName} (${student.class || 'N/A'})`;

          // Apply search filter
          if (search && !message.toLowerCase().includes(search.toLowerCase()) &&
            !studentName.toLowerCase().includes(search.toLowerCase())) {
            return; // Skip this activity
          }

          activities.push({
            id: student._id,
            type: 'admission',
            message,
            date: student.createdAt,
            studentName,
            status: 'primary',
            icon: 'UserPlus'
          });
        });
      } catch (err) {
        console.warn('Student fetch error:', err.message);
      }
    }

    // 3. Fetch Legacy Fees (Fallback or mixed usage)
    if (user.role === 'admin' && (!type || type === 'fee')) {
      try {
        let feeQuery = { tenantId, status: 'paid' };

        // Apply date filter
        if (Object.keys(dateFilter).length > 0) {
          feeQuery.updatedAt = dateFilter;
        }

        const fees = await Fee.find(feeQuery)
          .sort({ updatedAt: -1 })
          .limit(limit)
          .populate('student', 'fullName');

        fees.forEach(fee => {
          const studentName = fee.student?.fullName || 'Student';
          const message = `Collected ${fee.amount} from ${studentName}`;

          // Apply search filter
          if (search && !message.toLowerCase().includes(search.toLowerCase()) &&
            !studentName.toLowerCase().includes(search.toLowerCase())) {
            return; // Skip this activity
          }

          activities.push({
            id: fee._id,
            type: 'fee',
            message,
            date: fee.updatedAt,
            amount: fee.amount,
            studentName,
            status: 'success',
            icon: 'DollarSign'
          });
        });
      } catch (err) {
        console.warn('Legacy Fee error:', err.message);
      }
    }

    // 4. Sort, Paginate, and Limit
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = activities.length;
    const paginatedActivities = activities.slice(skip, skip + limit);

    res.json({
      success: true,
      count: paginatedActivities.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: paginatedActivities
    });

  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;

