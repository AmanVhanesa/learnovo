const express = require('express')
const router = express.Router()
const { body } = require('express-validator')
const Attendance = require('../models/Attendance')
const Class = require('../models/Class')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')

/**
 * @route   GET /api/attendance
 * @desc    Get attendance for a specific class, date, and subject
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const { classId, date, subject } = req.query

    if (!classId || !date || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Class ID, date, and subject are required'
      })
    }

    const attendance = await Attendance.findOne({
      tenantId: req.user.tenantId,
      classId,
      date: new Date(date),
      subject
    })
      .populate('attendanceRecords.studentId', 'name email admissionNumber photo')
      .populate('teacherId', 'name email')
      .populate('classId', 'name grade')

    if (!attendance) {
      return res.json({
        success: true,
        data: null,
        message: 'No attendance records found for this date'
      })
    }

    res.json({
      success: true,
      data: attendance
    })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance'
    })
  }
})

/**
 * @route   POST /api/attendance
 * @desc    Create or update attendance
 * @access  Private (Teacher only)
 */
router.post('/', [
  protect,
  authorize('teacher', 'admin'),
  body('classId').notEmpty().withMessage('Class ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('attendanceRecords').isArray().withMessage('Attendance records must be an array'),
  body('attendanceRecords.*.studentId').notEmpty().withMessage('Student ID is required'),
  body('attendanceRecords.*.status').isIn(['present', 'absent', 'late']).withMessage('Invalid status'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { classId, date, subject, attendanceRecords } = req.body

    // Validate class exists
    const classDoc = await Class.findOne({
      _id: classId,
      tenantId: req.user.tenantId
    })

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      })
    }

    // Validate teacher is assigned to this class (skip for admin)
    if (req.user.role !== 'admin') {
      const isAssigned = classDoc.subjects.some(
        sub => sub.teacher && sub.teacher.toString() === req.user._id.toString()
      )

      if (!isAssigned && classDoc.classTeacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this class'
        })
      }
    }

    // Validate date is not in the future
    const attendanceDate = new Date(date)
    if (attendanceDate > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark attendance for future dates'
      })
    }

    // Check for existing attendance record
    let attendance = await Attendance.findOne({
      tenantId: req.user.tenantId,
      classId,
      date: attendanceDate,
      subject
    })

    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const academicYear = `${currentYear}-${nextYear}`

    const isNew = !attendance

    if (attendance) {
      // Update existing record
      attendance.attendanceRecords = attendanceRecords
      attendance.teacherId = req.user._id
      await attendance.save()
    } else {
      // Create new record
      attendance = await Attendance.create({
        tenantId: req.user.tenantId,
        classId,
        teacherId: req.user._id,
        subject,
        date: attendanceDate,
        academicYear,
        attendanceRecords
      })
    }

    await attendance.populate('attendanceRecords.studentId', 'name email admissionNumber photo')

    res.status(isNew ? 201 : 200).json({
      success: true,
      message: 'Attendance saved successfully',
      data: attendance
    })
  } catch (error) {
    console.error('Error saving attendance:', error)
    res.status(500).json({
      success: false,
      message: 'Server error while saving attendance'
    })
  }
})

/**
 * @route   GET /api/attendance/report
 * @desc    Get attendance report with statistics
 * @access  Private
 */
router.get('/report', protect, async (req, res) => {
  try {
    const { startDate, endDate, classId, studentId } = req.query

    const filter = { tenantId: req.user.tenantId }

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }

    if (classId) {
      filter.classId = classId
    }

    const attendanceRecords = await Attendance.find(filter)
      .populate('attendanceRecords.studentId', 'name email admissionNumber')
      .populate('classId', 'name grade')
      .sort({ date: 1 })

    let records = attendanceRecords

    // Filter by student if specified
    if (studentId) {
      records = attendanceRecords.map(record => ({
        ...record.toObject(),
        attendanceRecords: record.attendanceRecords.filter(
          r => r.studentId._id.toString() === studentId
        )
      })).filter(record => record.attendanceRecords.length > 0)
    }

    // Calculate statistics
    const stats = {
      totalDays: records.length,
      totalRecords: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0
    }

    records.forEach(record => {
      record.attendanceRecords.forEach(studentRecord => {
        stats.totalRecords++
        switch (studentRecord.status) {
          case 'present':
            stats.presentCount++
            break
          case 'absent':
            stats.absentCount++
            break
          case 'late':
            stats.lateCount++
            break
        }
      })
    })

    const attendanceRate = stats.totalRecords > 0
      ? parseFloat(((stats.presentCount / stats.totalRecords) * 100).toFixed(1))
      : 0

    res.json({
      success: true,
      data: {
        records,
        statistics: {
          ...stats,
          attendanceRate
        }
      }
    })
  } catch (error) {
    console.error('Error generating attendance report:', error)
    res.status(500).json({
      success: false,
      message: 'Server error while generating report'
    })
  }
})

/**
 * @route   GET /api/attendance/students/:classId
 * @desc    Get students for a specific class
 * @access  Private
 */
router.get('/students/:classId', protect, async (req, res) => {
  try {
    const { classId } = req.params

    const classDoc = await Class.findOne({
      _id: classId,
      tenantId: req.user.tenantId
    }).populate('subjects.teacher', 'name email')

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      })
    }

    // Get all students in this class
    const students = await User.find({
      role: 'student',
      tenantId: req.user.tenantId,
      class: classDoc.name,
      isActive: true
    })
      .select('name email admissionNumber photo class')
      .sort({ admissionNumber: 1 })

    res.json({
      success: true,
      data: {
        class: classDoc,
        students
      }
    })
  } catch (error) {
    console.error('Error fetching students:', error)
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students'
    })
  }
})

module.exports = router
