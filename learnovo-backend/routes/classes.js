const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const Class = require('../models/Class');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Section = require('../models/Section');

// Get all classes
router.get('/', protect, async (req, res) => {
  try {
    const { academicYear, grade } = req.query;
    const filter = {};

    // Add tenant filtering
    if (req.user && req.user.tenantId) {
      filter.tenantId = req.user.tenantId;
    }

    if (academicYear) filter.academicYear = academicYear;
    if (grade) filter.grade = grade;

    // For teachers, only show classes they are assigned to
    if (req.user.role === 'teacher') {
      filter.$or = [
        { classTeacher: req.user._id },
        { 'subjects.teacher': req.user._id }
      ];
    }


    // Use aggregation to fetch classes with their sections and student counts
    const classes = await Class.aggregate([
      { $match: filter },
      // Lookup Sections with their sectionTeacher names and per-section student counts
      {
        $lookup: {
          from: 'sections',
          let: { classId: '$_id', classGrade: '$grade', classTenantId: '$tenantId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$classId', '$$classId'] } } },
            // Populate sectionTeacher name
            {
              $lookup: {
                from: 'users',
                localField: 'sectionTeacher',
                foreignField: '_id',
                as: 'sectionTeacherData'
              }
            },
            { $unwind: { path: '$sectionTeacherData', preserveNullAndEmptyArrays: true } },
            // Count students assigned to this section — match by sectionId OR by section name + grade string
            {
              $lookup: {
                from: 'users',
                let: { secId: '$_id', secName: '$name', clsGrade: '$$classGrade', clsTenantId: '$$classTenantId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$role', 'student'] },
                          { $ne: ['$isActive', false] },
                          { $eq: ['$tenantId', '$$clsTenantId'] },
                          {
                            $or: [
                              { $eq: ['$sectionId', '$$secId'] },
                              {
                                $and: [
                                  { $eq: [{ $ifNull: ['$sectionId', null] }, null] },
                                  { $eq: [{ $toLower: '$section' }, { $toLower: '$$secName' }] },
                                  { $eq: ['$class', '$$clsGrade'] }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    }
                  },
                  { $count: 'total' }
                ],
                as: 'studentCounts'
              }
            },
            {
              $addFields: {
                sectionTeacherName: '$sectionTeacherData.name',
                studentCount: { $ifNull: [{ $arrayElemAt: ['$studentCounts.total', 0] }, 0] }
              }
            },
            { $project: { sectionTeacherData: 0, studentCounts: 0 } },
            { $sort: { name: 1 } }
          ],
          as: 'sections'
        }
      },
      // Lookup Class Teacher
      {
        $lookup: {
          from: 'users',
          localField: 'classTeacher',
          foreignField: '_id',
          as: 'classTeacher'
        }
      },
      { $unwind: { path: '$classTeacher', preserveNullAndEmptyArrays: true } },
      // Lookup Student Count - Match by grade since students have 'class' field, not 'classId'
      {
        $lookup: {
          from: 'users',
          let: { classGrade: '$grade', classTenantId: '$tenantId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$class', '$$classGrade'] },
                    { $eq: ['$role', 'student'] },
                    { $eq: ['$tenantId', '$$classTenantId'] },
                    { $ne: ['$isActive', false] }
                  ]
                }
              }
            }
          ],
          as: 'students'
        }
      },
      {
        $addFields: {
          studentCount: { $size: '$students' }
        }
      },
      { $project: { students: 0 } }, // Remove heavy student array
      { $sort: { grade: 1, name: 1 } }
    ]);

    res.json({
      success: true,
      data: classes
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get a specific class
router.get('/:id', protect, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id)
      .populate('classTeacher', 'name email phone')
      .populate('subjects.subject', 'name subjectCode')
      .populate('subjects.teacher', 'name email phone');

    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Verify tenant access
    if (req.user && req.user.tenantId && classItem.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: classItem
    });
  } catch (error) {
    console.error('Error fetching class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create a new class
router.post('/', [
  protect,
  authorize('admin'),
  body('grade').notEmpty().withMessage('Grade is required'),
  body('academicYear').notEmpty().withMessage('Academic year is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { grade, academicYear, classTeacher } = req.body;
    // Auto-generate name from grade if not provided
    const name = req.body.name || grade;

    // Ensure tenantId is available
    if (!req.user || !req.user.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }

    const newClass = new Class({
      tenantId: req.user.tenantId,
      name,
      grade,
      academicYear,
      ...(classTeacher && { classTeacher })
    });

    await newClass.save();

    // Create Sections if provided
    if (req.body.sections && Array.isArray(req.body.sections) && req.body.sections.length > 0) {
      const sectionsToCreate = req.body.sections.map(s => {
        // Support both string names and { name, sectionTeacher } objects
        const name = typeof s === 'string' ? s.trim() : s.name?.trim();
        const sectionTeacher = typeof s === 'object' ? s.sectionTeacher || null : null;
        return {
          tenantId: req.user.tenantId,
          classId: newClass._id,
          name,
          ...(sectionTeacher && { sectionTeacher })
        };
      }).filter(s => s.name);

      if (sectionsToCreate.length > 0) {
        await Section.insertMany(sectionsToCreate);
      }
    } else {
      // Default section 'A' if none provided
      await Section.create({
        tenantId: req.user.tenantId,
        classId: newClass._id,
        name: 'A'
      });
    }

    const populatedClass = await Class.findById(newClass._id)
      .populate('classTeacher', 'name email');

    // Fetch sections to return full object
    const createdSections = await Section.find({ classId: newClass._id });

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: { ...populatedClass.toObject(), sections: createdSections }
    });
  } catch (error) {
    console.error('Error creating class:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
      errors: error.errors
    });
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update a class
router.put('/:id', [
  protect,
  authorize('admin'),
  body('name').optional().notEmpty().withMessage('Class name cannot be empty'),
  body('grade').optional().notEmpty().withMessage('Grade cannot be empty'),
  body('academicYear').optional().notEmpty().withMessage('Academic year cannot be empty'),
  body('classTeacher').optional().isMongoId().withMessage('Valid class teacher is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, grade, academicYear, classTeacher } = req.body;

    // Check if class teacher exists and is a teacher (if provided)
    if (classTeacher) {
      const teacher = await User.findById(classTeacher);
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(400).json({
          success: false,
          message: 'Invalid class teacher'
        });
      }
    }

    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      { name, grade, academicYear, classTeacher },
      { new: true, runValidators: true }
    ).populate('classTeacher', 'name email');

    if (!updatedClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // --- Section Sync: safe upsert on target class only ---
    if (req.body.sections && Array.isArray(req.body.sections)) {
      const tenantId = req.user.tenantId;
      const targetClassId = req.params.id;
      const inputSections = req.body.sections;

      // Fetch ONLY the sections belonging to this specific class document
      const existingSections = await Section.find({ classId: targetClassId });

      // Build lookup maps for existing sections
      const existingById = new Map(existingSections.map(s => [s._id.toString(), s]));
      const existingByName = new Map(existingSections.map(s => [s.name.toUpperCase(), s]));

      // Track which existing section _ids are still present in the input
      const keptIds = new Set();
      const bulkOps = [];

      for (const s of inputSections) {
        const rawName = (typeof s === 'string' ? s.trim() : s.name?.trim());
        if (!rawName) continue;
        const upperName = rawName.toUpperCase();
        const sectionTeacher = (typeof s === 'object' && s.sectionTeacher) ? s.sectionTeacher : null;
        const inputId = s._id ? s._id.toString() : null;

        // Resolve the existing section — prefer _id match, fall back to name
        const existing = (inputId && existingById.get(inputId))
          || existingByName.get(upperName)
          || null;

        if (existing) {
          keptIds.add(existing._id.toString());
          // UPDATE in-place — preserves _id so student sectionId references stay valid
          bulkOps.push({
            updateOne: {
              filter: { _id: existing._id },
              update: { $set: { sectionTeacher: sectionTeacher || null } }
            }
          });
        } else {
          // Brand-new section — insert
          bulkOps.push({
            insertOne: {
              document: { tenantId, classId: targetClassId, name: upperName, sectionTeacher: sectionTeacher || null }
            }
          });
        }
      }

      // Only delete sections that the frontend explicitly sent (had an _id) but then removed.
      // Sections that were never in the form are left untouched.
      const inputIdsFromForm = new Set(
        inputSections.filter(s => s._id).map(s => s._id.toString())
      );
      const hadIds = inputIdsFromForm.size > 0; // were any _ids submitted?

      for (const sec of existingSections) {
        if (keptIds.has(sec._id.toString())) continue; // still in the list

        // Only delete if the form originally contained section _ids (meaning removals are intentional)
        if (hadIds && inputIdsFromForm.size > 0) {
          // Check the section has no students before deleting
          const studentCount = await User.countDocuments({
            $or: [
              { sectionId: sec._id, role: 'student' },
              { section: { $regex: new RegExp(`^${sec.name}$`, 'i') }, sectionId: { $exists: false }, role: 'student' }
            ]
          });
          if (studentCount > 0) {
            return res.status(400).json({
              success: false,
              message: `Cannot remove section '${sec.name}' — it has ${studentCount} enrolled student(s).`
            });
          }
          bulkOps.push({ deleteOne: { filter: { _id: sec._id } } });
        }
        // If no _ids were submitted (old form format), don't delete anything
      }

      if (bulkOps.length > 0) {
        await Section.collection.bulkWrite(bulkOps, { ordered: false });
      }
    }


    // Re-fetch sections for response
    const currentSections = await Section.find({ classId: req.params.id }).sort({ name: 1 });

    res.json({
      success: true,
      message: 'Class updated successfully',
      data: { ...updatedClass.toObject(), sections: currentSections }
    });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete a class (and all other class docs for the same grade)
router.delete('/:id', [protect, authorize('admin')], async (req, res) => {
  try {
    const classId = req.params.id;
    // 1. Find the target class to get grade & tenant
    const targetClass = await Class.findById(classId);

    if (!targetClass) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Verify tenant access
    if (req.user.tenantId && targetClass.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // 2. Find ALL class docs for this grade (handle legacy multiple docs)
    const allGradeClasses = await Class.find({
      grade: targetClass.grade,
      tenantId: targetClass.tenantId
    });
    const allClassIds = allGradeClasses.map(c => c._id);

    // 3. Check if ANY of these classes have students
    const studentCount = await User.countDocuments({
      classId: { $in: allClassIds },
      role: 'student'
    });

    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete grade '${targetClass.grade}' because it has ${studentCount} enrolled student(s).`
      });
    }

    // 4. Delete ALL class docs for this grade
    await Class.deleteMany({ _id: { $in: allClassIds } });

    // 5. Delete ALL sections for these classes
    await Section.deleteMany({ classId: { $in: allClassIds } });

    res.json({
      success: true,
      message: `Grade '${targetClass.grade}' and all associated data deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get students in a class
router.get('/:id/students', protect, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id);
    if (!classItem) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const students = await User.find({
      $or: [
        { classId: req.params.id },
        { class: classItem.grade, tenantId: classItem.tenantId }
      ],
      role: 'student',
      isActive: { $ne: false }
    }).select('name email studentId rollNumber admissionDate guardianName guardianPhone section sectionId');

    res.json({
      success: true,
      data: students
    });
  } catch (error) {
    console.error('Error fetching class students:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Enroll student in class
router.post('/:id/students', [
  protect,
  authorize('admin'),
  body('studentIds').isArray().withMessage('Student IDs must be an array'),
  body('studentIds.*').isMongoId().withMessage('Invalid student ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { studentIds } = req.body;
    const classId = req.params.id;

    // Check if class exists
    const classItem = await Class.findById(classId);
    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Update students' classId
    const result = await User.updateMany(
      { _id: { $in: studentIds }, role: 'student' },
      { classId }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} students enrolled successfully`,
      data: { enrolledCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Error enrolling students:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get subjects and teachers for a class
router.get('/:id/subjects', protect, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id)
      .populate('subjects.subject', 'name subjectCode')
      .populate('subjects.teacher', 'name email');

    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      data: classItem.subjects
    });
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Assign subject to class
router.post('/:id/subjects', [
  protect,
  authorize('admin'),
  body('subjectId').isMongoId().withMessage('Valid subject ID is required'),
  body('teacherId').isMongoId().withMessage('Valid teacher ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { subjectId, teacherId } = req.body;
    const classId = req.params.id;

    // Check if class exists
    const classItem = await Class.findById(classId);
    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Check if teacher exists and is a teacher
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'Invalid teacher'
      });
    }

    // Check if subject is already assigned to this class
    const existingAssignment = classItem.subjects.find(
      s => s.subject.toString() === subjectId
    );

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Subject already assigned to this class'
      });
    }

    // Add subject assignment
    classItem.subjects.push({ subject: subjectId, teacher: teacherId });
    await classItem.save();

    const updatedClass = await Class.findById(classId)
      .populate('subjects.subject', 'name subjectCode')
      .populate('subjects.teacher', 'name email');

    res.json({
      success: true,
      message: 'Subject assigned successfully',
      data: updatedClass.subjects
    });
  } catch (error) {
    console.error('Error assigning subject:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Remove subject from class
router.delete('/:id/subjects/:subjectId', [protect, authorize('admin')], async (req, res) => {
  try {
    const { id, subjectId } = req.params;

    const classItem = await Class.findById(id);
    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    classItem.subjects = classItem.subjects.filter(
      s => s.subject.toString() !== subjectId
    );
    await classItem.save();

    res.json({
      success: true,
      message: 'Subject removed successfully'
    });
  } catch (error) {
    console.error('Error removing subject:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get sections for a specific class
router.get('/:id/sections', protect, async (req, res) => {
  try {
    const classId = req.params.id;

    // Verify class exists and user has access
    const classItem = await Class.findById(classId);
    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Verify tenant access
    if (req.user && req.user.tenantId && classItem.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Fetch sections for this class
    const sections = await Section.find({
      classId,
      isActive: true
    }).sort({ name: 1 });

    res.json({
      success: true,
      data: sections
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
