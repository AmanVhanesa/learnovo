const express = require('express')
const router = express.Router()
const { body, query } = require('express-validator')
const Attendance = require('../models/Attendance')
const EmployeeAttendance = require('../models/EmployeeAttendance')
const AttendanceSettings = require('../models/AttendanceSettings')
const Holiday = require('../models/Holiday')
const Class = require('../models/Class')
const Section = require('../models/Section')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')

// ─── Helper: check if date is a holiday ─────────────────────────────────────
async function isHoliday(tenantId, date, appliesTo = 'all') {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const holiday = await Holiday.findOne({
    tenantId,
    $or: [
      { date: d, appliesTo: { $in: [appliesTo, 'all'] } },
      { startDate: { $lte: d }, endDate: { $gte: d }, appliesTo: { $in: [appliesTo, 'all'] } }
    ]
  })
  return holiday
}

// ─── Helper: check if date is a working day ──────────────────────────────────
async function isWorkingDay(tenantId, date) {
  const settings = await AttendanceSettings.findOne({ tenantId })
  if (!settings) return true // default: all days are working
  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  return settings.workingDays.includes(dayName)
}

// ─── Helper: check past-edit permission ──────────────────────────────────────
async function canEditDate(tenantId, date) {
  const settings = await AttendanceSettings.findOne({ tenantId })
  if (!settings) return true
  if (!settings.allowPastEditing) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    if (d < today) return false
  } else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today - d) / (1000 * 60 * 60 * 24))
    if (diffDays > settings.pastEditDays) return false
  }
  return true
}

// ════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/attendance/dashboard
 * @desc    Combined dashboard stats for today
 * @access  Private (admin, teacher)
 */
router.get('/dashboard', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Total students
    const totalStudents = await User.countDocuments({ tenantId, role: 'student', isActive: true })

    // Today's student attendance records
    const todayAttendance = await Attendance.find({ tenantId, date: today })

    let studentPresent = 0, studentAbsent = 0, studentLate = 0, studentHalfDay = 0
    todayAttendance.forEach(a => {
      studentPresent += a.totalPresent || 0
      studentAbsent += a.totalAbsent || 0
      studentLate += a.totalLate || 0
      studentHalfDay += a.totalHalfDay || 0
    })
    const studentMarked = studentPresent + studentAbsent + studentLate + studentHalfDay + (todayAttendance.reduce((sum, a) => sum + (a.totalExcused || 0), 0))

    // Total employees
    const totalEmployees = await User.countDocuments({
      tenantId,
      role: { $in: ['teacher', 'accountant', 'staff'] },
      isActive: true
    })

    // Today's employee attendance
    const employeeAttendanceToday = await EmployeeAttendance.find({ tenantId, date: today })
    const empPresent = employeeAttendanceToday.filter(e => e.status === 'present').length
    const empAbsent = employeeAttendanceToday.filter(e => e.status === 'absent').length

    // Unmarked classes: all active classes with sections - classes that have attendance for today
    const allClasses = await Class.find({ tenantId, isActive: true }).populate('subjects.teacher', 'name')
    const allSections = await Section.find({ tenantId, isActive: true })

    const markedClassSections = new Set()
    todayAttendance.forEach(a => {
      markedClassSections.add(a.classId.toString())
    })

    // Build unmarked list - we consider a class "marked" if any attendance record exists for it today
    const unmarkedClasses = []
    for (const cls of allClasses) {
      const classSections = allSections.filter(s => s.classId.toString() === cls._id.toString())
      if (classSections.length === 0) {
        // Class with no sections - check if class itself has attendance
        if (!markedClassSections.has(cls._id.toString())) {
          unmarkedClasses.push({
            classId: cls._id,
            className: cls.name,
            sectionName: null,
            classTeacher: cls.classTeacher
          })
        }
      } else {
        for (const sec of classSections) {
          // For section-based, we need to check attendance per class (existing model is class-based)
          if (!markedClassSections.has(cls._id.toString())) {
            unmarkedClasses.push({
              classId: cls._id,
              sectionId: sec._id,
              className: cls.name,
              sectionName: sec.name,
              classTeacher: sec.sectionTeacher || cls.classTeacher
            })
          }
        }
      }
    }

    // Weekly trend (last 7 working days)
    const weeklyTrend = []
    let daysBack = 0
    let trendDays = 0
    while (trendDays < 7 && daysBack < 14) {
      const d = new Date(today)
      d.setDate(d.getDate() - daysBack)
      d.setHours(0, 0, 0, 0)
      daysBack++

      const dayAttendance = await Attendance.find({ tenantId, date: d })
      if (dayAttendance.length === 0) continue

      let p = 0, total = 0
      dayAttendance.forEach(a => {
        p += a.totalPresent || 0
        total += (a.attendanceRecords || []).length
      })

      weeklyTrend.unshift({
        date: d.toISOString().split('T')[0],
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        present: p,
        total,
        percentage: total > 0 ? Math.round((p / total) * 100) : 0
      })
      trendDays++
    }

    // Top 5 absentees today
    const absentees = []
    todayAttendance.forEach(a => {
      a.attendanceRecords.forEach(r => {
        if (r.status === 'absent') {
          absentees.push({ studentId: r.studentId, classId: a.classId })
        }
      })
    })

    // Populate first 5 absentees
    const topAbsenteeIds = absentees.slice(0, 5).map(a => a.studentId)
    const absenteeStudents = await User.find({ _id: { $in: topAbsenteeIds } })
      .select('name class section admissionNumber photo')

    res.json({
      success: true,
      data: {
        students: {
          total: totalStudents,
          present: studentPresent,
          absent: studentAbsent,
          late: studentLate,
          marked: studentMarked,
          percentage: studentMarked > 0 ? Math.round((studentPresent / studentMarked) * 100) : 0
        },
        employees: {
          total: totalEmployees,
          present: empPresent,
          absent: empAbsent,
          marked: employeeAttendanceToday.length,
          percentage: employeeAttendanceToday.length > 0 ? Math.round((empPresent / employeeAttendanceToday.length) * 100) : 0
        },
        unmarkedClasses: unmarkedClasses.slice(0, 20),
        unmarkedCount: unmarkedClasses.length,
        weeklyTrend,
        todayAbsentees: absenteeStudents
      }
    })
  } catch (error) {
    console.error('Error fetching attendance dashboard:', error)
    res.status(500).json({ success: false, message: 'Server error fetching dashboard' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  STUDENT ATTENDANCE
// ════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/attendance/students/daily-summary
 * @desc    School-wide daily summary
 * @access  Private
 */
router.get('/students/daily-summary', protect, async (req, res) => {
  try {
    const { date } = req.query
    const d = date ? new Date(date) : new Date()
    d.setHours(0, 0, 0, 0)

    const tenantId = req.user.tenantId
    const totalStudents = await User.countDocuments({ tenantId, role: 'student', isActive: true })
    const records = await Attendance.find({ tenantId, date: d })

    let present = 0, absent = 0, late = 0, halfDay = 0, excused = 0
    records.forEach(a => {
      present += a.totalPresent || 0
      absent += a.totalAbsent || 0
      late += a.totalLate || 0
      halfDay += a.totalHalfDay || 0
      excused += a.totalExcused || 0
    })

    const marked = present + absent + late + halfDay + excused

    res.json({
      success: true,
      data: { totalStudents, present, absent, late, halfDay, excused, marked, percentage: marked > 0 ? Math.round((present / marked) * 100) : 0 }
    })
  } catch (error) {
    console.error('Error fetching daily summary:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   GET /api/attendance/students/unmarked-classes
 * @desc    Classes where attendance hasn't been marked today
 * @access  Private (admin, teacher)
 */
router.get('/students/unmarked-classes', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const allClasses = await Class.find({ tenantId, isActive: true })
    const allSections = await Section.find({ tenantId, isActive: true })
    const todayAttendance = await Attendance.find({ tenantId, date: today })

    const markedClassIds = new Set(todayAttendance.map(a => a.classId.toString()))

    const unmarked = []
    for (const cls of allClasses) {
      if (!markedClassIds.has(cls._id.toString())) {
        const classSections = allSections.filter(s => s.classId.toString() === cls._id.toString())
        if (classSections.length === 0) {
          unmarked.push({ classId: cls._id, className: cls.name, sectionName: null })
        } else {
          classSections.forEach(sec => {
            unmarked.push({
              classId: cls._id,
              sectionId: sec._id,
              className: cls.name,
              sectionName: sec.name,
              sectionTeacher: sec.sectionTeacher
            })
          })
        }
      }
    }

    // Populate section teachers
    const teacherIds = unmarked.filter(u => u.sectionTeacher).map(u => u.sectionTeacher)
    const teachers = await User.find({ _id: { $in: teacherIds } }).select('name')
    const teacherMap = {}
    teachers.forEach(t => { teacherMap[t._id.toString()] = t.name })

    const result = unmarked.map(u => ({
      ...u,
      teacherName: u.sectionTeacher ? teacherMap[u.sectionTeacher.toString()] || null : null
    }))

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Error fetching unmarked classes:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   GET /api/attendance/students/absentees
 * @desc    Get absent students for a date
 * @access  Private
 */
router.get('/students/absentees', protect, async (req, res) => {
  try {
    const { date, classId } = req.query
    const d = date ? new Date(date) : new Date()
    d.setHours(0, 0, 0, 0)
    const tenantId = req.user.tenantId

    const filter = { tenantId, date: d }
    if (classId) filter.classId = classId

    const records = await Attendance.find(filter)
      .populate('classId', 'name grade')

    const absentees = []
    for (const record of records) {
      for (const sr of record.attendanceRecords) {
        if (sr.status === 'absent') {
          absentees.push({
            studentId: sr.studentId,
            classId: record.classId?._id,
            className: record.classId?.name,
            remarks: sr.remarks
          })
        }
      }
    }

    // Populate student details
    const studentIds = absentees.map(a => a.studentId)
    const students = await User.find({ _id: { $in: studentIds } })
      .select('name admissionNumber class section phone photo parentPhone fatherPhone motherPhone')

    const studentMap = {}
    students.forEach(s => { studentMap[s._id.toString()] = s })

    const result = absentees.map(a => {
      const s = studentMap[a.studentId.toString()]
      return {
        ...a,
        studentName: s?.name,
        admissionNumber: s?.admissionNumber,
        class: s?.class,
        section: s?.section,
        phone: s?.parentPhone || s?.fatherPhone || s?.motherPhone || s?.phone,
        photo: s?.photo
      }
    })

    // Group by class
    const grouped = {}
    result.forEach(r => {
      const key = `${r.className || r.class} - ${r.section || 'N/A'}`
      if (!grouped[key]) grouped[key] = { className: key, students: [] }
      grouped[key].students.push(r)
    })

    res.json({
      success: true,
      data: {
        absentees: result,
        grouped: Object.values(grouped),
        totalAbsent: result.length
      }
    })
  } catch (error) {
    console.error('Error fetching absentees:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   GET /api/attendance/students/monthly-report
 * @desc    Class/section monthly report with day-by-day status
 * @access  Private
 */
router.get('/students/monthly-report', protect, async (req, res) => {
  try {
    const { classId, month, year } = req.query
    if (!classId || !month || !year) {
      return res.status(400).json({ success: false, message: 'classId, month, and year are required' })
    }

    const tenantId = req.user.tenantId
    const m = parseInt(month) - 1 // JS months are 0-indexed
    const y = parseInt(year)
    const startDate = new Date(y, m, 1)
    const endDate = new Date(y, m + 1, 0) // last day of month
    const daysInMonth = endDate.getDate()

    // Get all attendance records for this class in the month
    const records = await Attendance.find({
      tenantId,
      classId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 })

    // Get students in this class
    const classDoc = await Class.findById(classId)
    if (!classDoc) return res.status(404).json({ success: false, message: 'Class not found' })

    const students = await User.find({
      tenantId,
      role: 'student',
      class: classDoc.name,
      isActive: true
    }).select('name admissionNumber class section photo').sort({ admissionNumber: 1 })

    // Get holidays in this month
    const holidays = await Holiday.find({
      tenantId,
      $or: [
        { date: { $gte: startDate, $lte: endDate } },
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
      ]
    })

    // Build date-to-attendance mapping
    const dateMap = {} // date string -> { studentId -> status }
    records.forEach(r => {
      const ds = r.date.toISOString().split('T')[0]
      if (!dateMap[ds]) dateMap[ds] = {}
      r.attendanceRecords.forEach(sr => {
        dateMap[ds][sr.studentId.toString()] = sr.status
      })
    })

    // Get working days config
    const settings = await AttendanceSettings.findOne({ tenantId })
    const workingDays = settings?.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    // Build holiday set
    const holidayDates = new Set()
    holidays.forEach(h => {
      if (h.startDate && h.endDate) {
        let d = new Date(h.startDate)
        while (d <= h.endDate) {
          holidayDates.add(d.toISOString().split('T')[0])
          d.setDate(d.getDate() + 1)
        }
      } else {
        holidayDates.add(h.date.toISOString().split('T')[0])
      }
    })

    // Build student report
    const report = students.map(student => {
      const days = []
      let totalPresent = 0, totalAbsent = 0, totalLate = 0, totalHalfDay = 0, totalExcused = 0, workingDaysCount = 0

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(y, m, day)
        const ds = d.toISOString().split('T')[0]
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
        const isHol = holidayDates.has(ds)
        const isWorking = workingDays.includes(dayName)

        let status = null
        if (isHol) {
          status = 'holiday'
        } else if (!isWorking) {
          status = 'weekend'
        } else {
          workingDaysCount++
          status = dateMap[ds]?.[student._id.toString()] || null
          if (status === 'present') totalPresent++
          else if (status === 'absent') totalAbsent++
          else if (status === 'late') totalLate++
          else if (status === 'half_day') totalHalfDay++
          else if (status === 'excused') totalExcused++
        }

        days.push({ day, date: ds, status })
      }

      return {
        student: {
          _id: student._id,
          name: student.name,
          admissionNumber: student.admissionNumber,
          photo: student.photo
        },
        days,
        summary: {
          workingDays: workingDaysCount,
          present: totalPresent,
          absent: totalAbsent,
          late: totalLate,
          halfDay: totalHalfDay,
          excused: totalExcused,
          percentage: workingDaysCount > 0 ? Math.round((totalPresent / workingDaysCount) * 100) : 0
        }
      }
    })

    // Daily totals
    const dailyTotals = []
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m, day)
      const ds = d.toISOString().split('T')[0]
      let p = 0, a = 0
      if (dateMap[ds]) {
        Object.values(dateMap[ds]).forEach(s => {
          if (s === 'present') p++
          else if (s === 'absent') a++
        })
      }
      dailyTotals.push({ day, date: ds, present: p, absent: a })
    }

    res.json({
      success: true,
      data: {
        className: classDoc.name,
        month: parseInt(month),
        year: parseInt(year),
        daysInMonth,
        students: report,
        dailyTotals,
        holidays: holidays.map(h => ({ title: h.title, date: h.date, type: h.type }))
      }
    })
  } catch (error) {
    console.error('Error generating monthly report:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   GET /api/attendance/students/export
 * @desc    Export attendance data as CSV
 * @access  Private (admin, teacher)
 */
router.get('/students/export', protect, async (req, res) => {
  try {
    const { classId, month, year } = req.query
    if (!classId || !month || !year) {
      return res.status(400).json({ success: false, message: 'classId, month, year required' })
    }

    const tenantId = req.user.tenantId
    const m = parseInt(month) - 1
    const y = parseInt(year)
    const startDate = new Date(y, m, 1)
    const endDate = new Date(y, m + 1, 0)
    const daysInMonth = endDate.getDate()

    const records = await Attendance.find({
      tenantId, classId, date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 })

    const classDoc = await Class.findById(classId)
    const students = await User.find({
      tenantId, role: 'student', class: classDoc?.name, isActive: true
    }).select('name admissionNumber').sort({ admissionNumber: 1 })

    const dateMap = {}
    records.forEach(r => {
      const ds = r.date.toISOString().split('T')[0]
      if (!dateMap[ds]) dateMap[ds] = {}
      r.attendanceRecords.forEach(sr => {
        dateMap[ds][sr.studentId.toString()] = sr.status
      })
    })

    // Build CSV
    let csv = 'S.No,Student Name,Admission No'
    for (let d = 1; d <= daysInMonth; d++) csv += `,${d}`
    csv += ',Total Present,Total Absent,Attendance %\n'

    students.forEach((student, idx) => {
      let row = `${idx + 1},"${student.name}",${student.admissionNumber || ''}`
      let p = 0, a = 0
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = new Date(y, m, d).toISOString().split('T')[0]
        const status = dateMap[ds]?.[student._id.toString()]
        const code = status ? status.charAt(0).toUpperCase() : '-'
        if (status === 'present') p++
        if (status === 'absent') a++
        row += `,${code}`
      }
      const pct = (p + a) > 0 ? Math.round((p / (p + a)) * 100) : 0
      row += `,${p},${a},${pct}%`
      csv += row + '\n'
    })

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${classDoc?.name}_${month}_${year}.csv`)
    res.send(csv)
  } catch (error) {
    console.error('Error exporting attendance:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   GET /api/attendance/students/:studentId/summary
 * @desc    Get attendance summary for a student
 * @access  Private
 */
router.get('/students/:studentId/summary', protect, async (req, res) => {
  try {
    const { studentId } = req.params
    const { month, year, from, to } = req.query
    const tenantId = req.user.tenantId

    let dateFilter = {}
    if (from && to) {
      dateFilter = { $gte: new Date(from), $lte: new Date(to) }
    } else if (month && year) {
      const m = parseInt(month) - 1
      const y = parseInt(year)
      dateFilter = { $gte: new Date(y, m, 1), $lte: new Date(y, m + 1, 0) }
    }

    const filter = { tenantId }
    if (dateFilter.$gte) filter.date = dateFilter

    const records = await Attendance.find(filter)

    let present = 0, absent = 0, late = 0, halfDay = 0, excused = 0, totalDays = 0

    records.forEach(record => {
      record.attendanceRecords.forEach(sr => {
        if (sr.studentId.toString() === studentId) {
          totalDays++
          if (sr.status === 'present') present++
          else if (sr.status === 'absent') absent++
          else if (sr.status === 'late') late++
          else if (sr.status === 'half_day') halfDay++
          else if (sr.status === 'excused') excused++
        }
      })
    })

    res.json({
      success: true,
      data: {
        totalDays,
        present,
        absent,
        late,
        halfDay,
        excused,
        percentage: totalDays > 0 ? Math.round((present / totalDays) * 100) : 0
      }
    })
  } catch (error) {
    console.error('Error fetching student summary:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   GET /api/attendance/students/:studentId
 * @desc    Get a student's attendance history
 * @access  Private
 */
router.get('/students/:studentId', protect, async (req, res) => {
  try {
    const { studentId } = req.params
    const { month, year, from, to } = req.query
    const tenantId = req.user.tenantId

    let dateFilter = {}
    if (from && to) {
      dateFilter = { $gte: new Date(from), $lte: new Date(to) }
    } else if (month && year) {
      const m = parseInt(month) - 1
      const y = parseInt(year)
      dateFilter = { $gte: new Date(y, m, 1), $lte: new Date(y, m + 1, 0) }
    }

    const filter = { tenantId }
    if (dateFilter.$gte) filter.date = dateFilter

    const records = await Attendance.find(filter)
      .populate('classId', 'name')
      .sort({ date: -1 })

    const studentRecords = []
    records.forEach(record => {
      record.attendanceRecords.forEach(sr => {
        if (sr.studentId.toString() === studentId) {
          studentRecords.push({
            date: record.date,
            status: sr.status,
            remarks: sr.remarks,
            subject: record.subject,
            className: record.classId?.name,
            markedAt: sr.markedAt
          })
        }
      })
    })

    // Get student info
    const student = await User.findById(studentId).select('name admissionNumber class section photo')

    res.json({
      success: true,
      data: {
        student,
        records: studentRecords
      }
    })
  } catch (error) {
    console.error('Error fetching student attendance:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ─── Existing routes (kept & enhanced) ───────────────────────────────────────

/**
 * @route   GET /api/attendance
 * @desc    Get attendance for a specific class, date, and subject
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const { classId, date, subject } = req.query

    if (!classId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Class ID and date are required'
      })
    }

    const filter = {
      tenantId: req.user.tenantId,
      classId,
      date: new Date(date)
    }
    if (subject) filter.subject = subject

    const attendance = await Attendance.findOne(filter)
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
    res.status(500).json({ success: false, message: 'Server error while fetching attendance' })
  }
})

/**
 * @route   POST /api/attendance
 * @desc    Mark/update student attendance (bulk)
 * @access  Private (admin, teacher)
 */
router.post('/', [
  protect,
  authorize('admin', 'teacher'),
  body('classId').notEmpty().withMessage('Class ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('attendanceRecords').isArray().withMessage('Attendance records must be an array'),
  body('attendanceRecords.*.studentId').notEmpty().withMessage('Student ID is required'),
  body('attendanceRecords.*.status').isIn(['present', 'absent', 'late', 'half_day', 'excused']).withMessage('Invalid status'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { classId, date, subject, attendanceRecords } = req.body
    const tenantId = req.user.tenantId

    // Validate class exists
    const classDoc = await Class.findOne({ _id: classId, tenantId })
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' })
    }

    // Validate date not in future
    const attendanceDate = new Date(date)
    attendanceDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (attendanceDate > today) {
      return res.status(400).json({ success: false, message: 'Cannot mark attendance for future dates' })
    }

    // Check holiday
    const holiday = await isHoliday(tenantId, attendanceDate, 'students')
    if (holiday) {
      return res.status(400).json({ success: false, message: `This date is a holiday: ${holiday.title}. Attendance cannot be marked.` })
    }

    // Check working day
    const working = await isWorkingDay(tenantId, attendanceDate)
    if (!working) {
      return res.status(400).json({ success: false, message: 'This is not a working day. Attendance cannot be marked.' })
    }

    // Check past-edit permission
    const canEdit = await canEditDate(tenantId, attendanceDate)
    if (!canEdit) {
      return res.status(400).json({ success: false, message: 'Past attendance editing is not allowed or the date is too far back.' })
    }

    // Teacher assignment check (skip for admin)
    if (req.user.role === 'teacher') {
      const isAssigned = classDoc.subjects?.some(
        sub => sub.teacher && sub.teacher.toString() === req.user._id.toString()
      )
      const isClassTeacher = classDoc.classTeacher && classDoc.classTeacher.toString() === req.user._id.toString()
      if (!isAssigned && !isClassTeacher) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this class' })
      }
    }

    const subjectName = subject || 'General'

    // Check for existing attendance record
    let attendance = await Attendance.findOne({
      tenantId, classId, date: attendanceDate, subject: subjectName
    })

    const currentYear = new Date().getFullYear()
    const academicYear = attendanceDate.getMonth() >= 3
      ? `${currentYear}-${currentYear + 1}`
      : `${currentYear - 1}-${currentYear}`

    const isNew = !attendance

    if (attendance) {
      attendance.attendanceRecords = attendanceRecords
      attendance.teacherId = req.user._id
      await attendance.save()
    } else {
      attendance = await Attendance.create({
        tenantId,
        classId,
        teacherId: req.user._id,
        subject: subjectName,
        date: attendanceDate,
        academicYear,
        attendanceRecords
      })
    }

    await attendance.populate('attendanceRecords.studentId', 'name email admissionNumber photo')

    res.status(isNew ? 201 : 200).json({
      success: true,
      message: 'Attendance saved successfully',
      data: attendance,
      isNew
    })
  } catch (error) {
    console.error('Error saving attendance:', error)
    res.status(500).json({ success: false, message: 'Server error while saving attendance' })
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
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) }
    }
    if (classId) filter.classId = classId

    const attendanceRecords = await Attendance.find(filter)
      .populate('attendanceRecords.studentId', 'name email admissionNumber')
      .populate('classId', 'name grade')
      .sort({ date: 1 })

    let records = attendanceRecords

    // Auto-scope to own records for student/parent roles
    const effectiveStudentId = studentId || (req.user.role === 'student' ? req.user._id.toString() : null)
    if (effectiveStudentId) {
      records = attendanceRecords.map(record => ({
        ...record.toObject(),
        attendanceRecords: record.attendanceRecords.filter(
          r => r.studentId._id.toString() === effectiveStudentId
        )
      })).filter(record => record.attendanceRecords.length > 0)
    }

    const stats = { totalDays: records.length, totalRecords: 0, presentCount: 0, absentCount: 0, lateCount: 0, halfDayCount: 0, excusedCount: 0 }
    records.forEach(record => {
      record.attendanceRecords.forEach(sr => {
        stats.totalRecords++
        if (sr.status === 'present') stats.presentCount++
        else if (sr.status === 'absent') stats.absentCount++
        else if (sr.status === 'late') stats.lateCount++
        else if (sr.status === 'half_day') stats.halfDayCount++
        else if (sr.status === 'excused') stats.excusedCount++
      })
    })

    const attendanceRate = stats.totalRecords > 0
      ? parseFloat(((stats.presentCount / stats.totalRecords) * 100).toFixed(1))
      : 0

    res.json({
      success: true,
      data: { records, statistics: { ...stats, attendanceRate } }
    })
  } catch (error) {
    console.error('Error generating attendance report:', error)
    res.status(500).json({ success: false, message: 'Server error while generating report' })
  }
})

/**
 * @route   GET /api/attendance/students-list/:classId
 * @desc    Get students for a specific class
 * @access  Private
 */
router.get('/students-list/:classId', protect, async (req, res) => {
  try {
    const { classId } = req.params
    const classDoc = await Class.findOne({ _id: classId, tenantId: req.user.tenantId })
      .populate('subjects.teacher', 'name email')

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' })
    }

    // Query by classId (ObjectId ref) OR class name string for backward compatibility
    const students = await User.find({
      role: 'student',
      tenantId: req.user.tenantId,
      $or: [
        { classId: classDoc._id },
        { class: classDoc.name }
      ],
      isActive: true
    }).select('name email admissionNumber photo class section classId').sort({ name: 1 })

    res.json({ success: true, data: { class: classDoc, students } })
  } catch (error) {
    console.error('Error fetching students:', error)
    res.status(500).json({ success: false, message: 'Server error while fetching students' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  EMPLOYEE ATTENDANCE
// ════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/attendance/employees
 * @desc    Get all employees with attendance for a date
 * @access  Private (admin)
 */
router.get('/employees', protect, authorize('admin'), async (req, res) => {
  try {
    const { date, department } = req.query
    const d = date ? new Date(date) : new Date()
    d.setHours(0, 0, 0, 0)
    const tenantId = req.user.tenantId

    const empFilter = {
      tenantId,
      role: { $in: ['teacher', 'accountant', 'staff'] },
      isActive: true
    }
    if (department) empFilter.department = department

    const employees = await User.find(empFilter)
      .select('name email department designation photo employeeId phone')
      .sort({ name: 1 })

    const attendanceRecords = await EmployeeAttendance.find({ tenantId, date: d })
    const attendanceMap = {}
    attendanceRecords.forEach(r => {
      attendanceMap[r.employeeId.toString()] = {
        status: r.status,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        remarks: r.remarks
      }
    })

    const result = employees.map(emp => ({
      ...emp.toObject(),
      attendance: attendanceMap[emp._id.toString()] || null
    }))

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Error fetching employee attendance:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   POST /api/attendance/employees/mark
 * @desc    Mark attendance for multiple employees
 * @access  Private (admin)
 */
router.post('/employees/mark', [
  protect,
  authorize('admin'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('records').isArray().withMessage('Records must be an array'),
  body('records.*.employeeId').notEmpty().withMessage('Employee ID is required'),
  body('records.*.status').isIn(['present', 'absent', 'late', 'half_day', 'on_leave', 'excused']).withMessage('Invalid status'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { date, records } = req.body
    const tenantId = req.user.tenantId
    const attendanceDate = new Date(date)
    attendanceDate.setHours(0, 0, 0, 0)

    // Validate date
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (attendanceDate > today) {
      return res.status(400).json({ success: false, message: 'Cannot mark attendance for future dates' })
    }

    const holiday = await isHoliday(tenantId, attendanceDate, 'employees')
    if (holiday) {
      return res.status(400).json({ success: false, message: `This date is a holiday: ${holiday.title}` })
    }

    const results = []
    for (const record of records) {
      const existing = await EmployeeAttendance.findOne({
        tenantId, employeeId: record.employeeId, date: attendanceDate
      })

      if (existing) {
        existing.status = record.status
        existing.checkInTime = record.checkInTime || existing.checkInTime
        existing.checkOutTime = record.checkOutTime || existing.checkOutTime
        existing.remarks = record.remarks || existing.remarks
        existing.markedBy = req.user._id
        existing.markedAt = new Date()
        await existing.save()
        results.push(existing)
      } else {
        const newRecord = await EmployeeAttendance.create({
          tenantId,
          employeeId: record.employeeId,
          date: attendanceDate,
          status: record.status,
          checkInTime: record.checkInTime,
          checkOutTime: record.checkOutTime,
          remarks: record.remarks,
          markedBy: req.user._id
        })
        results.push(newRecord)
      }
    }

    res.status(200).json({
      success: true,
      message: `Attendance saved for ${results.length} employees`,
      data: results
    })
  } catch (error) {
    console.error('Error saving employee attendance:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   GET /api/attendance/employees/daily-summary
 * @desc    Daily employee attendance summary
 * @access  Private (admin)
 */
router.get('/employees/daily-summary', protect, authorize('admin'), async (req, res) => {
  try {
    const { date } = req.query
    const d = date ? new Date(date) : new Date()
    d.setHours(0, 0, 0, 0)
    const tenantId = req.user.tenantId

    const totalEmployees = await User.countDocuments({
      tenantId, role: { $in: ['teacher', 'accountant', 'staff'] }, isActive: true
    })

    const records = await EmployeeAttendance.find({ tenantId, date: d })
    const summary = { present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0, excused: 0 }
    records.forEach(r => {
      if (r.status === 'present') summary.present++
      else if (r.status === 'absent') summary.absent++
      else if (r.status === 'late') summary.late++
      else if (r.status === 'half_day') summary.halfDay++
      else if (r.status === 'on_leave') summary.onLeave++
      else if (r.status === 'excused') summary.excused++
    })

    res.json({
      success: true,
      data: {
        totalEmployees,
        marked: records.length,
        ...summary,
        percentage: records.length > 0 ? Math.round((summary.present / records.length) * 100) : 0
      }
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   GET /api/attendance/employees/:employeeId
 * @desc    Single employee attendance history
 * @access  Private
 */
router.get('/employees/:employeeId', protect, async (req, res) => {
  try {
    const { employeeId } = req.params
    const { month, year } = req.query
    const tenantId = req.user.tenantId

    const filter = { tenantId, employeeId }
    if (month && year) {
      const m = parseInt(month) - 1
      const y = parseInt(year)
      filter.date = { $gte: new Date(y, m, 1), $lte: new Date(y, m + 1, 0) }
    }

    const records = await EmployeeAttendance.find(filter).sort({ date: -1 })
    const employee = await User.findById(employeeId).select('name department designation photo')

    res.json({ success: true, data: { employee, records } })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   GET /api/attendance/employees/:employeeId/summary
 * @desc    Employee attendance summary
 * @access  Private
 */
router.get('/employees/:employeeId/summary', protect, async (req, res) => {
  try {
    const { employeeId } = req.params
    const { month, year } = req.query
    const tenantId = req.user.tenantId

    const filter = { tenantId, employeeId }
    if (month && year) {
      const m = parseInt(month) - 1
      const y = parseInt(year)
      filter.date = { $gte: new Date(y, m, 1), $lte: new Date(y, m + 1, 0) }
    }

    const records = await EmployeeAttendance.find(filter)
    const summary = { totalDays: records.length, present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0, excused: 0 }
    records.forEach(r => {
      if (r.status === 'present') summary.present++
      else if (r.status === 'absent') summary.absent++
      else if (r.status === 'late') summary.late++
      else if (r.status === 'half_day') summary.halfDay++
      else if (r.status === 'on_leave') summary.onLeave++
      else if (r.status === 'excused') summary.excused++
    })
    summary.percentage = summary.totalDays > 0 ? Math.round((summary.present / summary.totalDays) * 100) : 0

    res.json({ success: true, data: summary })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/attendance/settings
 * @desc    Get attendance settings
 * @access  Private
 */
router.get('/settings', protect, async (req, res) => {
  try {
    let settings = await AttendanceSettings.findOne({ tenantId: req.user.tenantId })
    if (!settings) {
      // Create default settings
      settings = await AttendanceSettings.create({ tenantId: req.user.tenantId })
    }
    res.json({ success: true, data: settings })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   PUT /api/attendance/settings
 * @desc    Update attendance settings
 * @access  Private (admin)
 */
router.put('/settings', protect, authorize('admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const updates = req.body

    let settings = await AttendanceSettings.findOne({ tenantId })
    if (!settings) {
      settings = new AttendanceSettings({ tenantId, ...updates })
    } else {
      Object.assign(settings, updates)
    }
    await settings.save()

    res.json({ success: true, message: 'Settings updated', data: settings })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  HOLIDAYS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/attendance/holidays
 * @desc    List holidays
 * @access  Private
 */
router.get('/holidays', protect, async (req, res) => {
  try {
    const { year } = req.query
    const filter = { tenantId: req.user.tenantId }

    if (year) {
      const y = parseInt(year)
      // Academic year: April to March
      filter.date = { $gte: new Date(y, 3, 1), $lte: new Date(y + 1, 2, 31) }
    }

    const holidays = await Holiday.find(filter).sort({ date: 1 })
    res.json({ success: true, data: holidays })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   POST /api/attendance/holidays
 * @desc    Add a holiday
 * @access  Private (admin)
 */
router.post('/holidays', [
  protect,
  authorize('admin'),
  body('title').trim().notEmpty().withMessage('Holiday title is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { title, date, startDate, endDate, type, appliesTo } = req.body
    const holiday = await Holiday.create({
      tenantId: req.user.tenantId,
      title,
      date: new Date(date),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      type: type || 'school_holiday',
      appliesTo: appliesTo || 'all'
    })
    res.status(201).json({ success: true, message: 'Holiday added', data: holiday })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   PUT /api/attendance/holidays/:id
 * @desc    Update a holiday
 * @access  Private (admin)
 */
router.put('/holidays/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const holiday = await Holiday.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    )
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' })
    res.json({ success: true, message: 'Holiday updated', data: holiday })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

/**
 * @route   DELETE /api/attendance/holidays/:id
 * @desc    Delete a holiday
 * @access  Private (admin)
 */
router.delete('/holidays/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const holiday = await Holiday.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId
    })
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' })
    res.json({ success: true, message: 'Holiday deleted' })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  ANALYTICS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/attendance/analytics
 * @desc    Attendance analytics data
 * @access  Private (admin, teacher)
 */
router.get('/analytics', protect, async (req, res) => {
  try {
    const { month, year, classId } = req.query
    const tenantId = req.user.tenantId

    const y = parseInt(year) || new Date().getFullYear()
    const m = month ? parseInt(month) - 1 : new Date().getMonth()

    // Class-wise comparison for the month
    const startDate = new Date(y, m, 1)
    const endDate = new Date(y, m + 1, 0)

    const allClasses = await Class.find({ tenantId, isActive: true }).select('name grade')

    const classWise = []
    for (const cls of allClasses) {
      const records = await Attendance.find({
        tenantId, classId: cls._id, date: { $gte: startDate, $lte: endDate }
      })

      let totalPresent = 0, totalRecords = 0
      records.forEach(r => {
        totalPresent += r.totalPresent || 0
        totalRecords += (r.attendanceRecords || []).length
      })

      classWise.push({
        classId: cls._id,
        className: cls.name,
        percentage: totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0,
        totalRecords
      })
    }

    // Monthly trend for the academic year (April to current month)
    const academicYearStart = m >= 3 ? new Date(y, 3, 1) : new Date(y - 1, 3, 1)
    const monthlyTrend = []
    const today = new Date()

    for (let mi = 0; mi < 12; mi++) {
      const trendMonth = new Date(academicYearStart)
      trendMonth.setMonth(trendMonth.getMonth() + mi)
      if (trendMonth > today) break

      const ms = new Date(trendMonth.getFullYear(), trendMonth.getMonth(), 1)
      const me = new Date(trendMonth.getFullYear(), trendMonth.getMonth() + 1, 0)

      const filter = { tenantId, date: { $gte: ms, $lte: me } }
      if (classId) filter.classId = classId

      const records = await Attendance.find(filter)
      let p = 0, t = 0
      records.forEach(r => { p += r.totalPresent || 0; t += (r.attendanceRecords || []).length })

      monthlyTrend.push({
        month: ms.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        percentage: t > 0 ? Math.round((p / t) * 100) : 0
      })
    }

    // Day-of-week analysis
    const dayOfWeekStats = { monday: { p: 0, t: 0 }, tuesday: { p: 0, t: 0 }, wednesday: { p: 0, t: 0 }, thursday: { p: 0, t: 0 }, friday: { p: 0, t: 0 }, saturday: { p: 0, t: 0 }, sunday: { p: 0, t: 0 } }
    const monthRecords = await Attendance.find({
      tenantId, date: { $gte: startDate, $lte: endDate }, ...(classId ? { classId } : {})
    })
    monthRecords.forEach(r => {
      const dayName = r.date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      if (dayOfWeekStats[dayName]) {
        dayOfWeekStats[dayName].p += r.totalPresent || 0
        dayOfWeekStats[dayName].t += (r.attendanceRecords || []).length
      }
    })

    const dayOfWeek = Object.entries(dayOfWeekStats).map(([day, s]) => ({
      day: day.charAt(0).toUpperCase() + day.slice(1, 3),
      percentage: s.t > 0 ? Math.round((s.p / s.t) * 100) : 0
    }))

    // Chronic absentees - students with lowest attendance
    const allRecords = await Attendance.find({
      tenantId, date: { $gte: startDate, $lte: endDate }, ...(classId ? { classId } : {})
    })

    const studentStats = {}
    allRecords.forEach(r => {
      r.attendanceRecords.forEach(sr => {
        const sid = sr.studentId.toString()
        if (!studentStats[sid]) studentStats[sid] = { present: 0, total: 0 }
        studentStats[sid].total++
        if (sr.status === 'present') studentStats[sid].present++
      })
    })

    const chronicAbsentees = Object.entries(studentStats)
      .map(([id, s]) => ({ studentId: id, ...s, percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0 }))
      .filter(s => s.percentage < 90)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 20)

    // Populate student details
    const absenteeIds = chronicAbsentees.map(a => a.studentId)
    const absenteeStudents = await User.find({ _id: { $in: absenteeIds } })
      .select('name admissionNumber class section phone photo')
    const studentMap = {}
    absenteeStudents.forEach(s => { studentMap[s._id.toString()] = s })

    const chronicList = chronicAbsentees.map((a, idx) => ({
      rank: idx + 1,
      student: studentMap[a.studentId],
      present: a.present,
      total: a.total,
      absentDays: a.total - a.present,
      percentage: a.percentage
    }))

    res.json({
      success: true,
      data: { classWise, monthlyTrend, dayOfWeek, chronicAbsentees: chronicList }
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
