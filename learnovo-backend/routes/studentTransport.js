const express = require('express');
const { body, query } = require('express-validator');
const StudentTransportAssignment = require('../models/StudentTransportAssignment');
const Route = require('../models/Route');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const ImportExportService = require('../services/importExportService');

const router = express.Router();

// ── Static routes MUST come before /:id to avoid Express matching them as params ──

// @desc    Export student transport assignments
// @route   GET /api/student-transport/export
// @access  Private (Admin)
router.get('/export', protect, authorize('admin'), async(req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };

    if (req.query.status) {
      filter.isActive = req.query.status === 'active';
    }
    if (req.query.route) {
      filter.route = req.query.route;
    }
    if (req.query.academicYear) {
      filter.academicYear = req.query.academicYear;
    }

    const assignments = await StudentTransportAssignment.find(filter)
      .populate('student', 'name class section admissionNumber phone')
      .populate('route', 'routeName routeCode')
      .lean();

    const columns = [
      { key: 'student', header: 'Student Name', format: (val) => val ? val.name : '' },
      { key: 'student', header: 'Admission Number', format: (val) => val ? val.admissionNumber : '' },
      { key: 'student', header: 'Class', format: (val) => val ? `${val.class}${val.section ? `-${  val.section}` : ''}` : '' },
      { key: 'route', header: 'Route', format: (val) => val ? val.routeName : '' },
      { key: 'stop', header: 'Stop' },
      { key: 'transportType', header: 'Transport Type' },
      { key: 'monthlyFee', header: 'Monthly Fee' },
      { key: 'academicYear', header: 'Academic Year' },
      { key: 'startDate', header: 'Start Date', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
      { key: 'isActive', header: 'Status', format: (val) => val ? 'Active' : 'Inactive' }
    ];

    const headerInfo = await ImportExportService.getExportHeaderInfo(req.user.tenantId, 'Student Transport Assignments');
    const csvBuffer = await ImportExportService.exportToCSV(assignments, columns, headerInfo);
    const filename = `student_transport_export_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvBuffer);
  } catch (error) {
    console.error('Export assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting assignments'
    });
  }
});

// @desc    Get all student transport assignments
// @route   GET /api/student-transport
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
  handleValidationErrors
], async(req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { tenantId: req.user.tenantId };

    // Add status filter
    if (req.query.status) {
      filter.isActive = req.query.status === 'active';
    }

    // Add route filter
    if (req.query.route) {
      filter.route = req.query.route;
    }

    // Add academic year filter
    if (req.query.academicYear) {
      filter.academicYear = req.query.academicYear;
    }

    // Add transport type filter
    if (req.query.transportType) {
      filter.transportType = req.query.transportType;
    }

    // Get assignments with student and route details
    const assignments = await StudentTransportAssignment.find(filter)
      .populate('student', 'name class section phone email admissionNumber')
      .populate('route', 'routeName routeCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await StudentTransportAssignment.countDocuments(filter);

    res.json({
      success: true,
      data: assignments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching assignments'
    });
  }
});

// @desc    Get student's transport details
// @route   GET /api/student-transport/student/:studentId
// @access  Private (Admin)
router.get('/student/:studentId', protect, authorize('admin'), async(req, res) => {
  try {
    const assignments = await StudentTransportAssignment.find({
      student: req.params.studentId,
      tenantId: req.user.tenantId
    })
      .populate('route', 'routeName routeCode stops assignedVehicle assignedDriver')
      .populate({
        path: 'route',
        populate: [
          { path: 'assignedVehicle', select: 'vehicleNumber vehicleType' },
          { path: 'assignedDriver', select: 'name phone' }
        ]
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Get student transport error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student transport details'
    });
  }
});

// @desc    Get students on a specific route
// @route   GET /api/student-transport/route/:routeId
// @access  Private (Admin)
router.get('/route/:routeId', protect, authorize('admin'), async(req, res) => {
  try {
    const assignments = await StudentTransportAssignment.find({
      route: req.params.routeId,
      tenantId: req.user.tenantId,
      isActive: true
    })
      .populate('student', 'name class section phone email admissionNumber')
      .sort({ stop: 1, 'student.name': 1 });

    res.json({
      success: true,
      data: assignments,
      count: assignments.length
    });
  } catch (error) {
    console.error('Get route students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching route students'
    });
  }
});

// @desc    Assign student to route
// @route   POST /api/student-transport
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('routeId').notEmpty().withMessage('Route ID is required'),
  body('stop').trim().notEmpty().withMessage('Stop name is required'),
  body('transportType').isIn(['Both', 'Pickup Only', 'Drop Only']).withMessage('Invalid transport type'),
  body('academicYear').trim().notEmpty().withMessage('Academic year is required'),
  body('monthlyFee').isFloat({ min: 0 }).withMessage('Monthly fee must be >= 0'),
  handleValidationErrors
], async(req, res) => {
  try {
    const {
      studentId, routeId, stop, transportType, academicYear,
      monthlyFee, startDate, notes
    } = req.body;

    const tenantId = req.user.tenantId;

    // Validate student
    const student = await User.findOne({
      _id: studentId,
      tenantId,
      role: 'student',
      isActive: true
    });

    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'Student not found or inactive'
      });
    }

    // Validate route
    const route = await Route.findOne({
      _id: routeId,
      tenantId,
      isActive: true
    });

    if (!route) {
      return res.status(400).json({
        success: false,
        message: 'Route not found or inactive'
      });
    }

    // Validate stop exists in route
    const stopExists = route.stops.some(
      s => s.stopName.toLowerCase() === stop.toLowerCase()
    );

    if (!stopExists) {
      return res.status(400).json({
        success: false,
        message: 'Stop does not exist in the selected route'
      });
    }

    // Check for existing active assignment
    const existingAssignment = await StudentTransportAssignment.findOne({
      student: studentId,
      tenantId,
      academicYear,
      isActive: true
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Student already has an active transport assignment for this academic year'
      });
    }

    const assignmentData = {
      tenantId,
      student: studentId,
      route: routeId,
      stop,
      transportType,
      academicYear,
      monthlyFee,
      startDate: startDate || new Date(),
      notes,
      isActive: true,
      createdBy: req.user._id
    };

    const assignment = await StudentTransportAssignment.create(assignmentData);

    const populatedAssignment = await StudentTransportAssignment.findById(assignment._id)
      .populate('student', 'name class section admissionNumber')
      .populate('route', 'routeName routeCode');

    res.status(201).json({
      success: true,
      message: 'Student assigned to route successfully',
      data: populatedAssignment
    });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @desc    Update student transport assignment
// @route   PUT /api/student-transport/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
  body('stop').optional().trim().notEmpty().withMessage('Stop name cannot be empty'),
  body('monthlyFee').optional().isFloat({ min: 0 }).withMessage('Monthly fee must be >= 0'),
  handleValidationErrors
], async(req, res) => {
  try {
    const assignment = await StudentTransportAssignment.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).populate('route');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // If stop is being updated, validate it exists in the route
    if (req.body.stop && req.body.stop !== assignment.stop) {
      const stopExists = assignment.route.stops.some(
        s => s.stopName.toLowerCase() === req.body.stop.toLowerCase()
      );

      if (!stopExists) {
        return res.status(400).json({
          success: false,
          message: 'Stop does not exist in the route'
        });
      }
    }

    // Update assignment — never allow route changes through this endpoint.
    // Route changes must go through POST /:id/transfer so the old assignment
    // is deactivated and a new one is created (preserves audit trail).
    const updatePayload = { ...req.body, updatedBy: req.user._id };
    delete updatePayload.route;
    delete updatePayload.student;
    delete updatePayload.tenantId;

    const updatedAssignment = await StudentTransportAssignment.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    )
      .populate('student', 'name class section admissionNumber')
      .populate('route', 'routeName routeCode');

    res.json({
      success: true,
      message: 'Assignment updated successfully',
      data: updatedAssignment
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating assignment'
    });
  }
});

// @desc    Deactivate student transport assignment
// @route   DELETE /api/student-transport/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async(req, res) => {
  try {
    const assignment = await StudentTransportAssignment.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Deactivate assignment
    assignment.isActive = false;
    assignment.inactiveReason = req.body.reason || 'Deactivated by admin';
    assignment.inactivatedAt = new Date();
    assignment.endDate = new Date();
    assignment.updatedBy = req.user._id;
    await assignment.save();

    res.json({
      success: true,
      message: 'Assignment deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating assignment'
    });
  }
});

// @desc    Transfer a single student to a different route/driver
// @route   POST /api/student-transport/:id/transfer
// @access  Private (Admin)
router.post('/:id/transfer', protect, authorize('admin'), [
  body('toRouteId').notEmpty().withMessage('Target route is required'),
  body('toStop').trim().notEmpty().withMessage('Target stop is required'),
  body('transportType').optional().isIn(['Both', 'Pickup Only', 'Drop Only']).withMessage('Invalid transport type'),
  body('monthlyFee').optional().isFloat({ min: 0 }).withMessage('Monthly fee must be >= 0'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { toRouteId, toStop, transportType, monthlyFee, reason } = req.body;

    // Find existing active assignment
    const existing = await StudentTransportAssignment.findOne({
      _id: req.params.id,
      tenantId,
      isActive: true
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Active assignment not found'
      });
    }

    // Validate target route
    const toRoute = await Route.findOne({
      _id: toRouteId,
      tenantId,
      isActive: true
    });

    if (!toRoute) {
      return res.status(400).json({
        success: false,
        message: 'Target route not found or inactive'
      });
    }

    // Validate target stop exists in target route
    const stopExists = toRoute.stops.some(
      s => s.stopName.toLowerCase() === toStop.toLowerCase()
    );

    if (!stopExists) {
      return res.status(400).json({
        success: false,
        message: 'Stop does not exist in the target route'
      });
    }

    // No-op if same route + stop
    if (existing.route.toString() === toRouteId &&
        existing.stop.toLowerCase() === toStop.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Student is already on this route and stop'
      });
    }

    // Deactivate the old assignment
    existing.isActive = false;
    existing.inactiveReason = reason || 'Transferred to another route';
    existing.inactivatedAt = new Date();
    existing.endDate = new Date();
    existing.updatedBy = req.user._id;
    await existing.save();

    // Create the new assignment on the target route
    const newAssignment = await StudentTransportAssignment.create({
      tenantId,
      student: existing.student,
      route: toRouteId,
      stop: toStop,
      transportType: transportType || existing.transportType,
      academicYear: existing.academicYear,
      monthlyFee: monthlyFee != null ? monthlyFee : existing.monthlyFee,
      startDate: new Date(),
      isActive: true,
      notes: 'Transferred from previous route',
      createdBy: req.user._id
    });

    const populated = await StudentTransportAssignment.findById(newAssignment._id)
      .populate('student', 'name class section admissionNumber')
      .populate('route', 'routeName routeCode');

    res.json({
      success: true,
      message: 'Student transferred successfully',
      data: populated
    });
  } catch (error) {
    console.error('Transfer assignment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during transfer'
    });
  }
});

// @desc    Bulk assign students to route
// @route   POST /api/student-transport/bulk-assign
// @access  Private (Admin)
router.post('/bulk-assign', protect, authorize('admin'), [
  body('studentIds').isArray({ min: 1 }).withMessage('At least one student ID is required'),
  body('routeId').notEmpty().withMessage('Route ID is required'),
  body('stop').trim().notEmpty().withMessage('Stop name is required'),
  body('transportType').isIn(['Both', 'Pickup Only', 'Drop Only']).withMessage('Invalid transport type'),
  body('academicYear').trim().notEmpty().withMessage('Academic year is required'),
  body('monthlyFee').isFloat({ min: 0 }).withMessage('Monthly fee must be >= 0'),
  handleValidationErrors
], async(req, res) => {
  try {
    const {
      studentIds, routeId, stop, transportType, academicYear,
      monthlyFee, startDate
    } = req.body;

    const tenantId = req.user.tenantId;

    // Validate route
    const route = await Route.findOne({
      _id: routeId,
      tenantId,
      isActive: true
    });

    if (!route) {
      return res.status(400).json({
        success: false,
        message: 'Route not found or inactive'
      });
    }

    // Validate stop
    const stopExists = route.stops.some(
      s => s.stopName.toLowerCase() === stop.toLowerCase()
    );

    if (!stopExists) {
      return res.status(400).json({
        success: false,
        message: 'Stop does not exist in the selected route'
      });
    }

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const studentId of studentIds) {
      try {
        // Validate student
        const student = await User.findOne({
          _id: studentId,
          tenantId,
          role: 'student',
          isActive: true
        });

        if (!student) {
          results.failed.push({
            studentId,
            reason: 'Student not found or inactive'
          });
          continue;
        }

        // Check for existing active assignment
        const existingAssignment = await StudentTransportAssignment.findOne({
          student: studentId,
          tenantId,
          academicYear,
          isActive: true
        });

        if (existingAssignment) {
          results.skipped.push({
            studentId,
            studentName: student.name,
            reason: 'Already has active assignment'
          });
          continue;
        }

        // Create assignment
        const assignment = await StudentTransportAssignment.create({
          tenantId,
          student: studentId,
          route: routeId,
          stop,
          transportType,
          academicYear,
          monthlyFee,
          startDate: startDate || new Date(),
          isActive: true,
          createdBy: req.user._id
        });

        results.success.push({
          studentId,
          studentName: student.name,
          assignmentId: assignment._id
        });
      } catch (error) {
        results.failed.push({
          studentId,
          reason: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk assignment completed. Success: ${results.success.length}, Failed: ${results.failed.length}, Skipped: ${results.skipped.length}`,
      data: results
    });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk assignment'
    });
  }
});

// @desc    Resolve admission numbers to transport assignments
// @route   POST /api/student-transport/resolve-by-admission
// @access  Private (Admin)
router.post('/resolve-by-admission', protect, authorize('admin'), [
  body('admissionNumbers').isArray({ min: 1 }).withMessage('At least one admission number is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { admissionNumbers } = req.body;
    const tenantId = req.user.tenantId;

    const students = [];
    const notFound = [];

    for (const admNum of admissionNumbers) {
      const trimmed = admNum.trim();
      if (!trimmed) continue;

      const student = await User.findOne({
        tenantId,
        role: 'student',
        admissionNumber: { $regex: new RegExp(`^${trimmed}$`, 'i') }
      }).select('name admissionNumber class section isActive').lean();

      if (!student) {
        notFound.push(trimmed);
        continue;
      }

      // Find active transport assignment
      const assignment = await StudentTransportAssignment.findOne({
        student: student._id,
        tenantId,
        isActive: true
      })
        .populate('route', 'routeName routeCode assignedDriver')
        .populate({ path: 'route', populate: { path: 'assignedDriver', select: 'name phone' } })
        .lean();

      students.push({
        _id: student._id,
        name: student.name,
        admissionNumber: student.admissionNumber,
        class: student.class,
        section: student.section,
        isActive: student.isActive,
        hasTransport: !!assignment,
        assignment: assignment || null
      });
    }

    res.json({
      success: true,
      data: { students, notFound }
    });
  } catch (error) {
    console.error('Resolve by admission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resolving admission numbers'
    });
  }
});

// @desc    Bulk transfer students from one route/driver to another
// @route   POST /api/student-transport/bulk-transfer
// @access  Private (Admin)
router.post('/bulk-transfer', protect, authorize('admin'), [
  body('toRouteId').notEmpty().withMessage('Target route is required'),
  body('toStop').trim().notEmpty().withMessage('Target stop is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const {
      admissionNumbers, studentIds, fromRouteId,
      toRouteId, toStop, transportType, monthlyFee, academicYear
    } = req.body;

    // Default academic year for students who don't have an existing assignment to inherit from
    const defaultAcademicYear = academicYear || new Date().getFullYear().toString();

    const tenantId = req.user.tenantId;

    // Validate target route
    const toRoute = await Route.findOne({ _id: toRouteId, tenantId, isActive: true });
    if (!toRoute) {
      return res.status(400).json({ success: false, message: 'Target route not found or inactive' });
    }

    // Validate target stop
    const stopExists = toRoute.stops.some(
      s => s.stopName.toLowerCase() === toStop.toLowerCase()
    );
    if (!stopExists) {
      return res.status(400).json({ success: false, message: 'Stop does not exist in the target route' });
    }

    // Resolve students to transfer
    let studentsToTransfer = [];

    if (admissionNumbers && admissionNumbers.length > 0) {
      // Resolve by admission numbers
      for (const admNum of admissionNumbers) {
        const student = await User.findOne({
          tenantId,
          role: 'student',
          admissionNumber: { $regex: new RegExp(`^${admNum.trim()}$`, 'i') }
        }).select('_id name admissionNumber').lean();
        if (student) studentsToTransfer.push(student);
      }
    } else if (studentIds && studentIds.length > 0) {
      // Resolve by student IDs
      studentsToTransfer = await User.find({
        _id: { $in: studentIds },
        tenantId,
        role: 'student'
      }).select('_id name admissionNumber').lean();
    } else if (fromRouteId) {
      // Get all active students on the source route
      const sourceAssignments = await StudentTransportAssignment.find({
        route: fromRouteId,
        tenantId,
        isActive: true
      }).populate('student', '_id name admissionNumber').lean();
      studentsToTransfer = sourceAssignments.map(a => a.student).filter(Boolean);
    }

    if (studentsToTransfer.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid students found to transfer' });
    }

    const results = { transferred: [], assigned: [], skipped: [], failed: [] };

    for (const student of studentsToTransfer) {
      try {
        // Find existing active assignment
        const existing = await StudentTransportAssignment.findOne({
          student: student._id,
          tenantId,
          isActive: true
        });

        if (existing) {
          // Skip if already on the target route+stop
          if (existing.route.toString() === toRouteId && existing.stop.toLowerCase() === toStop.toLowerCase()) {
            results.skipped.push({
              admissionNumber: student.admissionNumber,
              name: student.name,
              reason: 'Already on the target route and stop'
            });
            continue;
          }

          // Deactivate old assignment
          existing.isActive = false;
          existing.inactiveReason = 'Transferred to another route';
          existing.inactivatedAt = new Date();
          existing.endDate = new Date();
          existing.updatedBy = req.user._id;
          await existing.save();

          // Create new assignment inheriting fields from the previous one
          const newAssignment = await StudentTransportAssignment.create({
            tenantId,
            student: student._id,
            route: toRouteId,
            stop: toStop,
            transportType: transportType || existing.transportType,
            academicYear: existing.academicYear,
            monthlyFee: monthlyFee != null ? monthlyFee : existing.monthlyFee,
            startDate: new Date(),
            isActive: true,
            notes: 'Transferred from previous route',
            createdBy: req.user._id
          });

          results.transferred.push({
            admissionNumber: student.admissionNumber,
            name: student.name,
            newAssignmentId: newAssignment._id
          });
        } else {
          // No existing assignment — create a fresh one on the target route
          const newAssignment = await StudentTransportAssignment.create({
            tenantId,
            student: student._id,
            route: toRouteId,
            stop: toStop,
            transportType: transportType || 'Both',
            academicYear: defaultAcademicYear,
            monthlyFee: monthlyFee != null ? monthlyFee : toRoute.monthlyFee || 0,
            startDate: new Date(),
            isActive: true,
            notes: 'Assigned via bulk transfer',
            createdBy: req.user._id
          });

          results.assigned.push({
            admissionNumber: student.admissionNumber,
            name: student.name,
            newAssignmentId: newAssignment._id
          });
        }
      } catch (error) {
        results.failed.push({
          admissionNumber: student.admissionNumber,
          name: student.name,
          reason: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Transfer complete. Transferred: ${results.transferred.length}, Newly assigned: ${results.assigned.length}, Skipped: ${results.skipped.length}, Failed: ${results.failed.length}`,
      data: results
    });
  } catch (error) {
    console.error('Bulk transfer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk transfer'
    });
  }
});

module.exports = router;
