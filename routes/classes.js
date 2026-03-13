const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const Class = require('../models/Class');
const User = require('../models/User');
const Subject = require('../models/Subject');

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

    const classes = await Class.find(filter)
      .populate('classTeacher', 'name email')
      .populate('subjects.subject', 'name subjectCode')
      .populate('subjects.teacher', 'name email')
      .sort({ grade: 1, name: 1 });

    // Get sections and student count for each class
    const Section = require('../models/Section');
    const classesWithData = await Promise.all(
      classes.map(async (classItem) => {
        const [sections, studentCount] = await Promise.all([
          Section.find({ classId: classItem._id, tenantId: req.user.tenantId }).populate('sectionTeacher', 'name email'),
          User.countDocuments({ classId: classItem._id, role: 'student' })
        ]);
        
        return {
          ...classItem.toObject(),
          sections,
          studentCount
        };
      })
    );

    res.json({
      success: true,
      data: classesWithData
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
  body('classTeacher').optional().custom((value) => {
    if (value && !require('mongoose').Types.ObjectId.isValid(value)) {
      throw new Error('Invalid class teacher ID');
    }
    return true;
  }),
  body('sections').optional().isArray().withMessage('Sections must be an array')
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

    const { name, grade, academicYear, classTeacher, sections } = req.body;
    const tenantId = req.user.tenantId;

    // Ensure tenantId is available
    if (!req.user || !req.user.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }

    // Default classTeacher logic
    let effectiveClassTeacher = classTeacher;
    if (!effectiveClassTeacher && sections && sections.length > 0) {
      // Use teacher of the first section if available
      const firstSectionTeacher = sections[0].sectionTeacher;
      if (firstSectionTeacher && require('mongoose').Types.ObjectId.isValid(firstSectionTeacher)) {
        effectiveClassTeacher = firstSectionTeacher;
      }
    }

    // If still no teacher, we can leave it null since we made it optional in model
    const newClass = new Class({
      tenantId,
      name,
      grade,
      academicYear,
      classTeacher: effectiveClassTeacher || undefined
    });

    await newClass.save();

    // Handle sections creation
    if (sections && Array.isArray(sections)) {
      const Section = require('../models/Section');
      const sectionDocs = sections.map(sec => ({
        tenantId,
        classId: newClass._id,
        name: sec.name.trim().toUpperCase(),
        sectionTeacher: (sec.sectionTeacher && require('mongoose').Types.ObjectId.isValid(sec.sectionTeacher)) 
          ? sec.sectionTeacher 
          : undefined,
        createdBy: req.user._id
      }));
      
      if (sectionDocs.length > 0) {
        await Section.insertMany(sectionDocs);
      }
    }

    const populatedClass = await Class.findById(newClass._id)
      .populate('classTeacher', 'name email');

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: populatedClass
    });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
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
  body('classTeacher').optional().custom((value) => {
    if (value && !require('mongoose').Types.ObjectId.isValid(value)) {
      throw new Error('Invalid class teacher ID');
    }
    return true;
  }),
  body('sections').optional().isArray().withMessage('Sections must be an array')
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

    const { name, grade, academicYear, classTeacher, sections } = req.body;
    const tenantId = req.user.tenantId;

    // Default classTeacher logic if not provided and sections are provided
    let effectiveClassTeacher = classTeacher;
    if (!effectiveClassTeacher && sections && sections.length > 0) {
      const firstSectionTeacher = sections[0].sectionTeacher;
      if (firstSectionTeacher && require('mongoose').Types.ObjectId.isValid(firstSectionTeacher)) {
        effectiveClassTeacher = firstSectionTeacher;
      }
    }

    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      { name, grade, academicYear, classTeacher: effectiveClassTeacher },
      { new: true, runValidators: true }
    ).populate('classTeacher', 'name email');

    if (!updatedClass) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Handle sections sync
    if (sections && Array.isArray(sections)) {
      const Section = require('../models/Section');
      
      // Get existing sections to identify which ones to remove/update
      const existingSections = await Section.find({ classId: updatedClass._id, tenantId });
      const existingIds = existingSections.map(s => s._id.toString());
      const incomingIds = sections.filter(s => s._id).map(s => s._id.toString());
      
      // Remove sections not in incoming list
      await Section.deleteMany({
        classId: updatedClass._id,
        tenantId,
        _id: { $in: existingIds.filter(id => !incomingIds.includes(id)) }
      });
      
      // Update/Create incoming sections
      for (const sec of sections) {
        const sectionData = {
          name: sec.name.trim().toUpperCase(),
          sectionTeacher: (sec.sectionTeacher && require('mongoose').Types.ObjectId.isValid(sec.sectionTeacher)) 
            ? sec.sectionTeacher 
            : undefined,
          tenantId,
          classId: updatedClass._id
        };
        
        if (sec._id && require('mongoose').Types.ObjectId.isValid(sec._id)) {
          await Section.findByIdAndUpdate(sec._id, sectionData);
        } else {
          await Section.create({ ...sectionData, createdBy: req.user._id });
        }
      }
    }

    res.json({
      success: true,
      message: 'Class updated successfully',
      data: updatedClass
    });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
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
router.get('/:id/sections', protect, async (req, res) => {
  try {
    const Section = require('../models/Section');
    const sections = await Section.find({
      classId: req.params.id,
      tenantId: req.user.tenantId
    }).sort({ name: 1 });

    res.json({
      success: true,
      data: sections
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
