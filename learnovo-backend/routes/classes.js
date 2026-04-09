const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const Class = require('../models/Class');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Section = require('../models/Section');

// Get all classes
router.get('/', protect, async(req, res) => {
  try {
    const { academicYear, grade } = req.query;
    const filter = {};

    // Add tenant filtering
    if (req.user && req.user.tenantId) {
      filter.tenantId = req.user.tenantId;
    }

    if (academicYear) filter.academicYear = academicYear;
    if (grade) filter.grade = grade;

    const classes = await Class.find(filter)
      .populate('classTeacher', 'name email')
      .populate('subjects.subject', 'name subjectCode')
      .populate('subjects.teacher', 'name email')
      .sort({ grade: 1, name: 1 });

    // Get sections and student counts for each class
    const classesWithDetails = await Promise.all(
      classes.map(async(classItem) => {
        const [studentCount, sections] = await Promise.all([
          User.countDocuments({
            tenantId: req.user.tenantId,
            role: 'student',
            $or: [
              { classId: classItem._id },
              { class: classItem.name },
              { class: classItem.grade }
            ]
          }),
          Section.find({ classId: classItem._id, tenantId: req.user.tenantId })
            .populate('sectionTeacher', 'name fullName email')
            .sort({ name: 1 })
        ]);

        // Get student count for each section (match by sectionId OR string section name)
        const sectionsWithCounts = await Promise.all(
          sections.map(async(section) => {
            const sectionStudentCount = await User.countDocuments({
              tenantId: req.user.tenantId,
              role: 'student',
              $or: [
                { sectionId: section._id },
                { section: section.name, classId: classItem._id },
                { section: section.name, class: classItem.name },
                { section: section.name, class: classItem.grade }
              ]
            });
            return {
              ...section.toObject(),
              studentCount: sectionStudentCount
            };
          })
        );

        return {
          ...classItem.toObject(),
          studentCount,
          sections: sectionsWithCounts
        };
      })
    );

    res.json({
      success: true,
      data: classesWithDetails
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
router.get('/:id', protect, async(req, res) => {
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

    // Include sections
    const sections = await Section.find({ classId: classItem._id, tenantId: req.user.tenantId })
      .populate('sectionTeacher', 'name fullName email')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: { ...classItem.toObject(), sections }
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
  body('academicYear').notEmpty().withMessage('Academic year is required'),
  body('classTeacher').optional({ checkFalsy: true }).isMongoId().withMessage('Valid class teacher is required')
], async(req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map(e => e.msg).join('. ');
      return res.status(400).json({
        success: false,
        message: messages,
        errors: errors.array()
      });
    }

    const { name, grade, academicYear, classTeacher, sections } = req.body;

    // Ensure tenantId is available
    if (!req.user || !req.user.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }

    // Validate class teacher if provided
    if (classTeacher) {
      const teacher = await User.findById(classTeacher);
      if (!teacher || (teacher.role !== 'teacher' && teacher.role !== 'admin')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid class teacher'
        });
      }
    }

    // Auto-generate name from grade if not provided
    const className = name || `Class ${grade}`;

    const newClass = new Class({
      tenantId: req.user.tenantId,
      name: className,
      grade,
      academicYear,
      classTeacher: classTeacher || undefined
    });

    await newClass.save();

    // Create sections if provided
    if (sections && sections.length > 0) {
      const sectionDocs = sections
        .filter(s => s.name && s.name.trim())
        .map(s => ({
          tenantId: req.user.tenantId,
          classId: newClass._id,
          name: s.name.trim(),
          sectionTeacher: s.sectionTeacher || undefined,
          createdBy: req.user._id
        }));

      if (sectionDocs.length > 0) {
        await Section.insertMany(sectionDocs);
      }
    }

    const populatedClass = await Class.findById(newClass._id)
      .populate('classTeacher', 'name email');

    // Fetch created sections
    const createdSections = await Section.find({ classId: newClass._id })
      .populate('sectionTeacher', 'name email');

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: { ...populatedClass.toObject(), sections: createdSections }
    });
  } catch (error) {
    console.error('Error creating class:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message).join('. ');
      return res.status(400).json({ success: false, message: messages });
    }
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'This class/section already exists' });
    }
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
  body('classTeacher').optional({ checkFalsy: true }).isMongoId().withMessage('Valid class teacher is required')
], async(req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map(e => e.msg).join('. ');
      return res.status(400).json({
        success: false,
        message: messages,
        errors: errors.array()
      });
    }

    const { name, grade, academicYear, classTeacher, sections } = req.body;

    // Check if class teacher exists (if provided)
    if (classTeacher) {
      const teacher = await User.findById(classTeacher);
      if (!teacher || (teacher.role !== 'teacher' && teacher.role !== 'admin')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid class teacher'
        });
      }
    }

    // Verify tenant ownership before update
    const existingClass = await Class.findById(req.params.id);
    if (!existingClass || existingClass.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (grade !== undefined) updateData.grade = grade;
    if (academicYear !== undefined) updateData.academicYear = academicYear;
    if (classTeacher !== undefined) updateData.classTeacher = classTeacher || null;

    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('classTeacher', 'name email');

    if (!updatedClass) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Handle sections if provided.
    //
    // The Academics page groups every Class record sharing the same `grade`
    // into a single card and flattens their sections together; the edit modal
    // is seeded from one of those classes (gradeClasses[0]) but contains
    // sections from ALL classes in that grade. So a "delete" or "edit" the
    // user makes can target a section that actually lives under a sibling
    // class in the same grade. We diff against the union of sections under
    // every class in this grade so cross-class deletes/edits actually take
    // effect instead of being silently ignored.
    if (sections && Array.isArray(sections)) {
      const tenantId = req.user.tenantId;
      const classId = updatedClass._id;

      // All classes in this tenant that share the same grade as the updated
      // class — i.e. every class the UI merged into the same edit modal.
      const gradeClasses = await Class.find({
        tenantId,
        grade: updatedClass.grade
      }).select('_id').lean();
      const gradeClassIds = gradeClasses.map(c => c._id);

      // Existing sections across the whole grade group
      const existingSections = await Section.find({
        tenantId,
        classId: { $in: gradeClassIds }
      });
      const existingIds = existingSections.map(s => s._id.toString());

      // Determine which sections to keep, add, or remove
      const incomingSectionIds = sections.filter(s => s._id).map(s => s._id.toString());
      const toRemove = existingIds.filter(id => !incomingSectionIds.includes(id));

      // Remove deleted sections (scoped by tenantId; classId restriction
      // dropped because the section may belong to a sibling class in the
      // same grade — _id + tenantId is sufficient).
      if (toRemove.length > 0) {
        await Section.deleteMany({ _id: { $in: toRemove }, tenantId });
      }

      // Update existing and create new sections
      for (const s of sections) {
        if (s._id && existingIds.includes(s._id.toString())) {
          // Update existing — preserves whichever class it actually belongs to
          await Section.findByIdAndUpdate(s._id, {
            name: s.name.trim(),
            sectionTeacher: s.sectionTeacher || null
          });
        } else if (s.name && s.name.trim()) {
          // Create new — under the class the user opened the modal for
          await Section.create({
            tenantId,
            classId,
            name: s.name.trim(),
            sectionTeacher: s.sectionTeacher || undefined,
            createdBy: req.user._id
          });
        }
      }
    }

    // Fetch updated sections
    const updatedSections = await Section.find({ classId: updatedClass._id, tenantId: req.user.tenantId })
      .populate('sectionTeacher', 'name fullName email')
      .sort({ name: 1 });

    res.json({
      success: true,
      message: 'Class updated successfully',
      data: { ...updatedClass.toObject(), sections: updatedSections }
    });
  } catch (error) {
    console.error('Error updating class:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message).join('. ');
      return res.status(400).json({ success: false, message: messages });
    }
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A section with this name already exists in the class' });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete a class
router.delete('/:id', [protect, authorize('admin')], async(req, res) => {
  try {
    // Verify tenant ownership
    const classToDelete = await Class.findById(req.params.id);
    if (!classToDelete || classToDelete.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Check if class has students
    const studentCount = await User.countDocuments({
      classId: req.params.id,
      role: 'student'
    });

    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete class with enrolled students'
      });
    }

    const deletedClass = await Class.findByIdAndDelete(req.params.id);

    if (!deletedClass) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Clean up sections for deleted class
    await Section.deleteMany({ classId: req.params.id });

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get sections for a class
router.get('/:id/sections', protect, async(req, res) => {
  try {
    const sections = await Section.find({
      classId: req.params.id,
      tenantId: req.user.tenantId
    })
      .populate('sectionTeacher', 'name fullName email')
      .sort({ name: 1 });

    // Add student count to each section
    const sectionsWithCounts = await Promise.all(
      sections.map(async(section) => {
        const studentCount = await User.countDocuments({
          sectionId: section._id,
          role: 'student'
        });
        return {
          ...section.toObject(),
          studentCount
        };
      })
    );

    res.json({
      success: true,
      data: sectionsWithCounts
    });
  } catch (error) {
    console.error('Error fetching sections for class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get students in a class
router.get('/:id/students', protect, async(req, res) => {
  try {
    // Verify tenant ownership
    const classItem = await Class.findById(req.params.id);
    if (!classItem || classItem.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const students = await User.find({
      classId: req.params.id,
      role: 'student',
      tenantId: req.user.tenantId
    }).select('name email studentId rollNumber admissionDate guardianName guardianPhone');

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
], async(req, res) => {
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

    // Check if class exists and belongs to tenant
    const classItem = await Class.findById(classId);
    if (!classItem || classItem.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Update students' classId (only for students in same tenant)
    const result = await User.updateMany(
      { _id: { $in: studentIds }, role: 'student', tenantId: req.user.tenantId },
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
router.get('/:id/subjects', protect, async(req, res) => {
  try {
    const classItem = await Class.findById(req.params.id)
      .populate('subjects.subject', 'name subjectCode')
      .populate('subjects.teacher', 'name email');

    if (!classItem || classItem.tenantId.toString() !== req.user.tenantId.toString()) {
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
], async(req, res) => {
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

    // Check if class exists and belongs to tenant
    const classItem = await Class.findById(classId);
    if (!classItem || classItem.tenantId.toString() !== req.user.tenantId.toString()) {
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
router.delete('/:id/subjects/:subjectId', [protect, authorize('admin')], async(req, res) => {
  try {
    const { id, subjectId } = req.params;

    const classItem = await Class.findById(id);
    if (!classItem || classItem.tenantId.toString() !== req.user.tenantId.toString()) {
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

module.exports = router;
