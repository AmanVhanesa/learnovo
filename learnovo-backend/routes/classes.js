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

    // Use aggregation to fetch classes with their sections and student counts
    const classes = await Class.aggregate([
      { $match: filter },
      // Lookup Sections
      {
        $lookup: {
          from: 'sections',
          localField: '_id',
          foreignField: 'classId',
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
                    { $eq: ['$tenantId', '$$classTenantId'] }
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
          studentCount: { $size: '$students' },
          sections: {
            $sortArray: { input: '$sections', sortBy: { name: 1 } }
          }
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
  body('name').notEmpty().withMessage('Class name is required'),
  body('grade').notEmpty().withMessage('Grade is required'),
  body('academicYear').notEmpty().withMessage('Academic year is required'),
  body('classTeacher').isMongoId().withMessage('Valid class teacher is required')
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

    // Ensure tenantId is available
    if (!req.user || !req.user.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }

    // Check if class teacher exists and is a teacher
    const teacher = await User.findById(classTeacher);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'Invalid class teacher'
      });
    }

    const newClass = new Class({
      tenantId: req.user.tenantId,
      name,
      grade,
      academicYear,
      classTeacher
    });

    await newClass.save();

    // Create Sections if provided
    if (req.body.sections && Array.isArray(req.body.sections)) {
      const sectionConfig = req.body.sections; // Expecting { type: 'STANDARD/CUSTOM', count: 3, names: [] } but frontend sends flattened struct usually? 
      // Plan says: "sections" payload: { type: 'STANDARD', count: ... } OR { type: 'CUSTOM', names: [...] }
      // Actually, let's keep it robust. If it's an array of strings, just create them. 
      // If it's the config object, parse it.
      // Let's assume the frontend sends the *final list of names* to be simple, 
      // OR sends the config. 
      // Implementation Plan said: "POST ... sections array".
      // Let's support an array of objects or strings to be safe, but adhering to plan: 
      // "sections payload: type... count... names..." implies it is an OBJECT, not an array of sections directly.
      // But the previous lines say "sections (Array)".
      // I will support req.body.sections as an ARRAY of strings for simplicity giving the frontend full control to generate the list.

      const sectionsToCreate = req.body.sections.map(name => ({
        tenantId: req.user.tenantId,
        classId: newClass._id,
        name: name.trim()
      }));

      if (sectionsToCreate.length > 0) {
        await Section.insertMany(sectionsToCreate);
      }
    } else {
      // Default "A" section if none provided? Plan said "Existing classes... default".
      // But for NEW classes, we should enforce at least one via validation or default.
      // Let's create 'A' if empty to be safe
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

    // --- Section Sync Logic with Safety Checks ---
    if (req.body.sections && Array.isArray(req.body.sections)) {
      const inputSections = req.body.sections;
      const tenantId = req.user.tenantId;
      const classId = req.params.id;

      // Fetch existing sections
      const existingSections = await Section.find({ classId });

      // 1. Process Objects ({ id, name }) or Strings (name only)
      // If string, we assume it's a desired state list.
      // To safely support "Standard to Custom" switch, we treat input as the source of truth.
      // But we MUST respect locks.

      // We will execute operations in sequence to ensure safety.
      // Strategy: 
      // A. Identify IDs to UPDATE (if id provided)
      // B. Identify Names to CREATE (if no id)
      // C. Identify IDs to DELETE (if in DB but not in input IDs)

      // If input contains ONLY strings, we can't map to IDs easily unless names match. 
      // Fallback for strings: Map by Name.
      // If object with ID: Map by ID.

      const operations = []; // List of async tasks
      const processedIds = new Set();
      const processedNames = new Set();

      for (const input of inputSections) {
        let name, id;
        if (typeof input === 'string') {
          name = input.trim();
        } else {
          name = input.name.trim();
          id = input._id || input.id;
        }

        if (!name) continue;
        processedNames.add(name);

        if (id) {
          // Update specific section
          processedIds.add(id.toString());
          const section = existingSections.find(s => s._id.toString() === id.toString());
          if (section && section.name !== name) {
            // RENAME ATTEMPT
            const studentCount = await User.countDocuments({ sectionId: id, role: 'student' });
            if (studentCount > 0) {
              return res.status(400).json({ success: false, message: `Cannot rename section '${section.name}' because it has active students.` });
            }
            operations.push(Section.findByIdAndUpdate(id, { name }));
          }
        } else {
          // New Section (or matching existing by name if string-only input)
          // Check if name already exists to prevent duplicate creation if ID wasn't sent
          const exactMatch = existingSections.find(s => s.name === name);
          if (exactMatch) {
            processedIds.add(exactMatch._id.toString());
            // No op, exists
          } else {
            // Create
            operations.push(Section.create({ tenantId, classId, name }));
          }
        }
      }

      // Delete missing sections
      for (const section of existingSections) {
        if (!processedIds.has(section._id.toString())) {
          // DELETE ATTEMPT
          const studentCount = await User.countDocuments({ sectionId: section._id, role: 'student' });
          if (studentCount > 0) {
            return res.status(400).json({ success: false, message: `Cannot delete section '${section.name}' because it has active students.` });
          }
          operations.push(Section.findByIdAndDelete(section._id));
        }
      }

      await Promise.all(operations);
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

// Delete a class
router.delete('/:id', [protect, authorize('admin')], async (req, res) => {
  try {
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

    // Cascade delete sections
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

// Get students in a class
router.get('/:id/students', protect, async (req, res) => {
  try {
    const students = await User.find({
      classId: req.params.id,
      role: 'student'
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

module.exports = router;
