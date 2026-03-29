const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const Fee = require('../models/Fee');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Admission = require('../models/Admission');
const TeacherSubjectAssignment = require('../models/TeacherSubjectAssignment');
const Class = require('../models/Class');

const planGate = require('../middleware/planGate');

const router = express.Router();
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
      // Uses all 4 allocation methods (same as GET /api/students)
      try {
        const legacyClasses = Array.isArray(user.assignedClasses) ? user.assignedClasses : [];

        // 1. TeacherSubjectAssignment (new relation)
        const assignments = await TeacherSubjectAssignment.find({
          teacherId: user._id, tenantId, isActive: true
        });

        // 2. Class model assignments (classTeacher or subjects[].teacher)
        const classAssignments = await Class.find({
          tenantId,
          $or: [
            { classTeacher: user._id },
            { 'subjects.teacher': user._id }
          ]
        }).select('name');

        // 3. Section model assignments (sectionTeacher)
        const Section = require('../models/Section');
        const sectionAssignments = await Section.find({
          tenantId, sectionTeacher: user._id, isActive: true
        }).select('name classId');

        // Build $or criteria from all allocation methods
        const criteria = [];

        if (legacyClasses.length > 0) {
          criteria.push({ class: { $in: legacyClasses } });
        }
        if (classAssignments.length > 0) {
          const classNames = classAssignments.map(c => c.name);
          criteria.push({ class: { $in: classNames } });
          criteria.push({ classId: { $in: classAssignments.map(c => c._id) } });
        }
        if (sectionAssignments.length > 0) {
          const sectionIds = sectionAssignments.map(s => s._id);
          const sectionNames = sectionAssignments.map(s => s.name);
          const relatedClassIds = sectionAssignments.map(s => s.classId);
          criteria.push({
            $or: [
              { sectionId: { $in: sectionIds } },
              { section: { $in: sectionNames }, classId: { $in: relatedClassIds } }
            ]
          });
        }
        assignments.forEach(a => {
          const clause = { classId: a.classId };
          if (a.sectionId) clause.sectionId = a.sectionId;
          criteria.push(clause);
        });

        // Find matching students using all criteria
        if (criteria.length > 0) {
          const studentsInClass = await User.find({
            role: 'student', tenantId,
            $or: criteria
          }).select('_id');
          const ids = studentsInClass.map(s => s._id);
          if (ids.length > 0) {
            studentFilter._id = { $in: ids };
            feeFilter.student = { $in: ids };
            attendanceFilter.student = { $in: ids };
          } else {
            studentFilter._id = { $in: [] };
          }
        } else {
          // No assignments at all — show no students
          studentFilter._id = { $in: [] };
        }
      } catch (err) {
        console.error('Teacher dashboard filter error:', err);
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

    const statistics = {
      students: { total: 0, active: 0 },
      teachers: { total: 0, active: 0 },
      admissions: { total: 0, pending: 0, approved: 0, rejected: 0 },
      fees: { total: 0, paid: 0, pending: 0, overdue: 0 },
    };

    // ── Admin dashboard: run all counts in parallel ──────────────────────
    if (user.role === 'admin') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      // Start of current month for "this month" counts
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Fee aggregation — legacy Fee model (lowercase statuses)
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

      // Fee aggregation — FeeInvoice model (capitalized statuses)
      const invoiceAggPipeline = [
        { $match: { tenantId } },
        { $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          paid: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$totalAmount', 0] } },
          pending: { $sum: { $cond: [{ $in: ['$status', ['Pending', 'Partial']] }, '$balanceAmount', 0] } },
          overdue: { $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, '$balanceAmount', 0] } },
        }}
      ];

      // Today's fee collection — legacy Fee model
      const todayFeeAggPipeline = [
        { $match: { tenantId, status: 'paid', updatedAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, collectedToday: { $sum: '$amount' } } }
      ];

      // Today's fee collection — Payment model (non-reversed payments made today)
      const todayPaymentAggPipeline = [
        { $match: { tenantId, isReversed: { $ne: true }, paymentDate: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, collectedToday: { $sum: '$amount' } } }
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

      // Attendance counts — Attendance model uses nested attendanceRecords array
      const attendancePromises = (async () => {
        try {
          const Attendance = require('../models/Attendance');
          const todayRecords = await Attendance.find({
            tenantId, date: { $gte: today, $lt: tomorrow }
          }).select('totalPresent totalLate');
          const studentsPresentToday = todayRecords.reduce(
            (sum, rec) => sum + (rec.totalPresent || 0) + (rec.totalLate || 0), 0
          );
          // Employee attendance not tracked in this model — return active teacher count as fallback
          return { studentsPresentToday, employeesPresentToday: 0 };
        } catch {
          return { studentsPresentToday: 0, employeesPresentToday: 0 };
        }
      })();

      // Upcoming exams (class/subject are strings, not ObjectId refs)
      const upcomingExamsPromise = (async () => {
        try {
          const Exam = require('../models/Exam');
          const exams = await Exam.find({
            tenantId,
            date: { $gte: today },
            status: { $in: ['Scheduled', 'Ongoing'] }
          })
            .sort({ date: 1 })
            .limit(5)
            .lean();
          // Map string fields into the shape the frontend expects
          return exams.map(e => ({
            ...e,
            subject: { name: e.subject },
            class: { name: e.class }
          }));
        } catch {
          return [];
        }
      })();

      const [
        totalStudents, activeStudents,
        totalTeachers, activeTeachers,
        totalAdmissions, pendingAdmissions, approvedAdmissions, rejectedAdmissions,
        admissionsThisMonth,
        feeAgg, invoiceAgg, todayFeeAgg, todayPaymentAgg,
        attendanceCounts, upcomingExams,
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
        User.countDocuments({ role: 'student', tenantId, createdAt: { $gte: monthStart, $lt: tomorrow } }),
        Fee.aggregate(feeAggPipeline),
        FeeInvoice.aggregate(invoiceAggPipeline),
        Fee.aggregate(todayFeeAggPipeline),
        Payment.aggregate(todayPaymentAggPipeline),
        attendancePromises,
        upcomingExamsPromise,
        ...trendPromises,
      ]);

      // Combine totals from both legacy Fee and FeeInvoice systems
      const legacyFees = feeAgg[0] || { total: 0, paid: 0, pending: 0, overdue: 0 };
      const invoiceFees = invoiceAgg[0] || { total: 0, paid: 0, pending: 0, overdue: 0 };
      const feeTotals = {
        total: legacyFees.total + invoiceFees.total,
        paid: legacyFees.paid + invoiceFees.paid,
        pending: legacyFees.pending + invoiceFees.pending,
        overdue: legacyFees.overdue + invoiceFees.overdue,
      };
      const collectedToday =
        (todayFeeAgg[0]?.collectedToday || 0) +
        (todayPaymentAgg[0]?.collectedToday || 0);

      Object.assign(statistics, {
        students: { total: totalStudents, active: activeStudents },
        teachers: { total: totalTeachers, active: activeTeachers },
        admissions: {
          total: totalAdmissions, pending: pendingAdmissions,
          approved: approvedAdmissions, rejected: rejectedAdmissions,
          thisMonth: admissionsThisMonth
        },
        fees: { ...feeTotals, collectedToday },
        attendance: attendanceCounts,
        enrollmentTrend: { labels: trendLabels, data: trendCounts },
        upcomingExams: upcomingExams || [],
      });
    }

    // ── Teacher dashboard ──────────────────────────────────────────────
    if (user.role === 'teacher') {
      const myStudentIds = studentFilter._id?.$in || [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const [
        studentCount,
        todayAttResult,
        assignmentCount,
        homeworkStats,
        weeklyAttendance,
        upcomingAssignments,
        assignedClassesList,
      ] = await Promise.all([
        // 1. Student count
        User.countDocuments({ role: 'student', tenantId, ...studentFilter }),

        // 2. Today's attendance — uses attendanceRecords array, scoped by teacherId
        (async () => {
          try {
            const Attendance = require('../models/Attendance');
            const todayRecords = await Attendance.find({
              tenantId, teacherId: user._id,
              date: { $gte: today, $lt: tomorrow },
            }).select('totalPresent totalLate totalAbsent');
            const present = todayRecords.reduce((s, r) => s + (r.totalPresent || 0) + (r.totalLate || 0), 0);
            const total = todayRecords.reduce((s, r) => s + (r.totalPresent || 0) + (r.totalLate || 0) + (r.totalAbsent || 0), 0);
            return { present, total };
          } catch { return { present: 0, total: 0 }; }
        })(),

        // 3. Active assignment count
        (async () => {
          try {
            const Assignment = require('../models/Assignment');
            return Assignment.countDocuments({ teacher: user._id, tenantId, status: 'active' });
          } catch { return 0; }
        })(),

        // 4. Homework submission stats (submitted, pending, late)
        (async () => {
          try {
            const Homework = require('../models/Homework');
            const HomeworkSubmission = require('../models/HomeworkSubmission');
            // Get all active homework IDs for this teacher
            const myHomework = await Homework.find({
              assignedBy: user._id, tenantId, isActive: true,
            }).select('_id dueDate');
            const hwIds = myHomework.map(h => h._id);
            if (hwIds.length === 0) return { submitted: 0, pending: 0, late: 0 };

            const submissions = await HomeworkSubmission.find({
              tenantId, homeworkId: { $in: hwIds },
            }).select('status homeworkId submittedAt').lean();

            // Build due-date lookup
            const dueDateMap = {};
            myHomework.forEach(h => { dueDateMap[h._id.toString()] = h.dueDate; });

            let submitted = 0, pending = 0, late = 0;
            submissions.forEach(s => {
              if (s.status === 'submitted' || s.status === 'reviewed') {
                submitted++;
                // Check if submitted after due date
                const dueDate = dueDateMap[s.homeworkId?.toString()];
                if (dueDate && s.submittedAt && new Date(s.submittedAt) > new Date(dueDate)) {
                  late++;
                }
              } else {
                pending++;
              }
            });
            return { submitted, pending, late };
          } catch { return { submitted: 0, pending: 0, late: 0 }; }
        })(),

        // 5. Weekly attendance trend (last 7 days)
        (async () => {
          try {
            const Attendance = require('../models/Attendance');
            const labels = [];
            const data = [];
            for (let i = 6; i >= 0; i--) {
              const dayStart = new Date(today);
              dayStart.setDate(dayStart.getDate() - i);
              const dayEnd = new Date(dayStart);
              dayEnd.setDate(dayEnd.getDate() + 1);

              labels.push(dayStart.toLocaleDateString('en-US', { weekday: 'short' }));

              const dayRecords = await Attendance.find({
                tenantId, teacherId: user._id,
                date: { $gte: dayStart, $lt: dayEnd },
              }).select('totalPresent totalLate totalAbsent');

              const present = dayRecords.reduce((s, r) => s + (r.totalPresent || 0) + (r.totalLate || 0), 0);
              const total = dayRecords.reduce((s, r) => s + (r.totalPresent || 0) + (r.totalLate || 0) + (r.totalAbsent || 0), 0);
              data.push(total > 0 ? Math.round((present / total) * 100) : 0);
            }
            return { labels, data };
          } catch { return { labels: [], data: [] }; }
        })(),

        // 6. Upcoming assignments (due in future, active)
        (async () => {
          try {
            const Assignment = require('../models/Assignment');
            return Assignment.find({
              teacher: user._id, tenantId,
              status: 'active', dueDate: { $gte: today },
            })
              .sort({ dueDate: 1 })
              .limit(5)
              .select('title subject class dueDate')
              .lean();
          } catch { return []; }
        })(),

        // 7. Assigned classes list (all 4 allocation methods)
        (async () => {
          try {
            const classMap = new Map(); // deduplicate by class _id

            // 7a. Class model: classTeacher or subjects[].teacher
            const directClasses = await Class.find({
              tenantId,
              $or: [
                { classTeacher: user._id },
                { 'subjects.teacher': user._id },
              ],
            }).select('name grade').lean();
            directClasses.forEach(c => {
              classMap.set(c._id.toString(), { id: c._id, name: c.name, grade: c.grade });
            });

            // 7b. Section model: sectionTeacher
            const Section = require('../models/Section');
            const teacherSections = await Section.find({
              tenantId, sectionTeacher: user._id, isActive: true,
            }).select('classId name').lean();
            if (teacherSections.length > 0) {
              const sectionClassIds = [...new Set(teacherSections.map(s => s.classId?.toString()).filter(Boolean))];
              const sectionClasses = await Class.find({
                _id: { $in: sectionClassIds }, tenantId,
              }).select('name grade').lean();
              sectionClasses.forEach(c => {
                if (!classMap.has(c._id.toString())) {
                  classMap.set(c._id.toString(), { id: c._id, name: c.name, grade: c.grade });
                }
              });
            }

            // 7c. TeacherSubjectAssignment model
            const tsaRecords = await TeacherSubjectAssignment.find({
              teacherId: user._id, tenantId, isActive: true,
            }).select('classId').lean();
            if (tsaRecords.length > 0) {
              const tsaClassIds = [...new Set(tsaRecords.map(a => a.classId?.toString()).filter(Boolean))];
              const missingIds = tsaClassIds.filter(id => !classMap.has(id));
              if (missingIds.length > 0) {
                const tsaClasses = await Class.find({
                  _id: { $in: missingIds }, tenantId,
                }).select('name grade').lean();
                tsaClasses.forEach(c => {
                  classMap.set(c._id.toString(), { id: c._id, name: c.name, grade: c.grade });
                });
              }
            }

            // 7d. Legacy assignedClasses (string names)
            const legacyClasses = Array.isArray(user.assignedClasses) ? user.assignedClasses : [];
            if (legacyClasses.length > 0) {
              const legacyFound = await Class.find({
                tenantId, name: { $in: legacyClasses },
              }).select('name grade').lean();
              legacyFound.forEach(c => {
                if (!classMap.has(c._id.toString())) {
                  classMap.set(c._id.toString(), { id: c._id, name: c.name, grade: c.grade });
                }
              });
            }

            // Count students per class
            const classList = Array.from(classMap.values());
            if (classList.length > 0) {
              const classIds = classList.map(c => c.id);
              const classNames = classList.map(c => c.name);
              const studentCounts = await User.aggregate([
                { $match: {
                  role: 'student', tenantId, isActive: true,
                  $or: [
                    { classId: { $in: classIds } },
                    { class: { $in: classNames } }
                  ]
                }},
                { $group: {
                  _id: { $ifNull: ['$classId', '$class'] },
                  count: { $sum: 1 }
                }}
              ]);
              const countMap = {};
              studentCounts.forEach(sc => { countMap[sc._id?.toString()] = sc.count; });
              classList.forEach(c => {
                c.studentCount = countMap[c.id?.toString()] || countMap[c.name] || 0;
              });
            }
            return classList;
          } catch { return []; }
        })(),
      ]);

      const attendancePercent = todayAttResult.total > 0
        ? Math.round((todayAttResult.present / todayAttResult.total) * 100)
        : 0;

      statistics.students = {
        total: studentCount,
        active: studentCount,
      };
      statistics.teacher = {
        myStudents: studentCount,
        myClasses: assignedClassesList.length,
        attendanceToday: attendancePercent,
        activeAssignments: assignmentCount,
        pendingSubmissions: homeworkStats.pending,
        submittedAssignments: homeworkStats.submitted,
        lateSubmissions: homeworkStats.late,
        weeklyAttendance: weeklyAttendance,
        upcomingAssignments: upcomingAssignments,
        assignedClasses: assignedClassesList,
      };
    }

    // ── Student dashboard ──────────────────────────────────────────────
    if (user.role === 'student') {
      const studentOid = new mongoose.Types.ObjectId(user._id);
      const tenantOid = new mongoose.Types.ObjectId(user.tenantId);
      const Notification = require('../models/Notification');
      const [invoiceAgg, assignmentCount, unreadNotifications] = await Promise.all([
        FeeInvoice.aggregate([
          { $match: { studentId: studentOid, tenantId: tenantOid, status: { $in: ['Pending', 'Partial', 'Overdue'] } } },
          { $group: { _id: null, totalOutstanding: { $sum: '$balanceAmount' }, count: { $sum: 1 } } }
        ]),
        (async () => {
          try {
            const Assignment = require('../models/Assignment');
            return Assignment.countDocuments({ tenantId, assignedTo: user._id });
          } catch { return 0; }
        })(),
        Notification.getUnreadCount(user._id, tenantId),
      ]);
      const outstandingData = invoiceAgg[0] || { totalOutstanding: 0, count: 0 };
      statistics.students = { total: 1, active: user.isActive ? 1 : 0 };
      statistics.student = {
        profileComplete: user.isActive ? 'Complete' : 'Incomplete',
        pendingFees: outstandingData.count,
        pendingFeesAmount: outstandingData.totalOutstanding,
        assignments: assignmentCount,
        notifications: unreadNotifications,
      };
    }

    // ── Parent dashboard ───────────────────────────────────────────────
    if (user.role === 'parent') {
      const childrenIds = (user.children && Array.isArray(user.children) ? user.children : [])
        .map(id => new mongoose.Types.ObjectId(id));
      const parentTenantOid = new mongoose.Types.ObjectId(user.tenantId);
      const Notification = require('../models/Notification');
      const [invoiceAgg, parentUnreadNotifications] = await Promise.all([
        FeeInvoice.aggregate([
          { $match: { studentId: { $in: childrenIds }, tenantId: parentTenantOid, status: { $in: ['Pending', 'Partial', 'Overdue'] } } },
          { $group: { _id: null, totalOutstanding: { $sum: '$balanceAmount' }, count: { $sum: 1 } } }
        ]),
        Notification.getUnreadCount(user._id, tenantId),
      ]);
      const outstandingData = invoiceAgg[0] || { totalOutstanding: 0, count: 0 };
      statistics.parent = {
        myChildren: childrenIds.length,
        pendingFees: outstandingData.count,
        pendingFeesAmount: outstandingData.totalOutstanding,
        notifications: parentUnreadNotifications,
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
    // Only admins should see recent activities (contains fee payments, employee data)
    if (req.user.role !== 'admin') {
      return res.json({ success: true, data: [] });
    }

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

// @route   GET /api/reports/enrollment-trend?range=30d
// @access  Private (admin)
router.get('/enrollment-trend', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const range = req.query.range || '30d';

    const now = new Date();
    let startDate;
    let groupFormat; // MongoDB $dateToString format
    let labelFn;     // JS function to format labels for missing buckets

    switch (range) {
      case '7d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        groupFormat = '%Y-%m-%d';
        labelFn = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        break;
      case '30d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        groupFormat = '%Y-%m-%d';
        labelFn = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        break;
      case '90d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 89);
        startDate.setHours(0, 0, 0, 0);
        groupFormat = '%Y-%U'; // group by week
        labelFn = (d) => 'W' + getWeekNumber(d) + ' ' + d.toLocaleDateString('en-US', { month: 'short' });
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        groupFormat = '%Y-%m';
        labelFn = (d) => d.toLocaleDateString('en-US', { month: 'short' });
        break;
      case 'all':
        // Find the earliest student to determine start
        const earliest = await User.findOne({ role: 'student', tenantId }).sort({ createdAt: 1 }).select('createdAt').lean();
        startDate = earliest ? new Date(earliest.createdAt) : new Date(now.getFullYear(), 0, 1);
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        groupFormat = '%Y-%m';
        labelFn = (d) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        groupFormat = '%Y-%m-%d';
        labelFn = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Aggregate students by the chosen time bucket
    const pipeline = [
      { $match: { role: 'student', tenantId, createdAt: { $gte: startDate } } },
      { $group: {
        _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ];

    const results = await User.aggregate(pipeline);
    const countMap = {};
    for (const r of results) {
      countMap[r._id] = r.count;
    }

    // Build complete labels array (fill in zero-count buckets)
    const labels = [];
    const data = [];

    if (groupFormat === '%Y-%m-%d') {
      // Daily buckets
      const cursor = new Date(startDate);
      while (cursor <= now) {
        const key = cursor.toISOString().slice(0, 10); // YYYY-MM-DD
        labels.push(labelFn(new Date(cursor)));
        data.push(countMap[key] || 0);
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (groupFormat === '%Y-%m') {
      // Monthly buckets
      const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (cursor <= now) {
        const key = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0');
        labels.push(labelFn(new Date(cursor)));
        data.push(countMap[key] || 0);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      // Weekly buckets (%Y-%U)
      const cursor = new Date(startDate);
      // Align to start of week (Sunday)
      cursor.setDate(cursor.getDate() - cursor.getDay());
      while (cursor <= now) {
        const wn = getWeekNumber(cursor);
        const key = cursor.getFullYear() + '-' + String(wn).padStart(2, '0');
        labels.push(labelFn(new Date(cursor)));
        data.push(countMap[key] || 0);
        cursor.setDate(cursor.getDate() + 7);
      }
    }

    res.json({ success: true, data: { labels, data } });
  } catch (error) {
    console.error('Enrollment trend error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch enrollment trend' });
  }
});

// Helper: get week number (Sunday-based, matching MongoDB %U)
function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d - onejan) / 86400000) + 1;
  return Math.floor((dayOfYear + onejan.getDay()) / 7);
}

module.exports = router;
