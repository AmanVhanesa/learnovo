const Joi = require('joi');
const ImportExportService = require('./importExportService');
const User = require('../models/User');
const Class = require('../models/Class');
const Section = require('../models/Section');
const mongoose = require('mongoose');

/**
 * Student Import Service
 * Handles importing students from CSV/Excel files
 */

class StudentImportService {
    /**
     * Validation schema for student import
     */
    static getValidationSchema() {
        return Joi.object({
            admissionNumber: Joi.string()
                .required()
                .trim()
                .uppercase()
                .pattern(/^[A-Z0-9]+$/)
                .min(3)
                .max(20)
                .messages({
                    'string.empty': 'Admission number is required',
                    'string.pattern.base': 'Admission number must be alphanumeric',
                    'string.min': 'Admission number must be at least 3 characters',
                    'string.max': 'Admission number cannot exceed 20 characters'
                }),

            firstName: Joi.string()
                .required()
                .trim()
                .min(2)
                .max(50)
                .messages({
                    'string.empty': 'First name is required',
                    'string.min': 'First name must be at least 2 characters',
                    'string.max': 'First name cannot exceed 50 characters'
                }),

            lastName: Joi.string()
                .required()
                .trim()
                .min(2)
                .max(50)
                .messages({
                    'string.empty': 'Last name is required',
                    'string.min': 'Last name must be at least 2 characters',
                    'string.max': 'Last name cannot exceed 50 characters'
                }),

            dateOfBirth: Joi.date()
                .required()
                .max('now')
                .min('1990-01-01')
                .messages({
                    'date.base': 'Invalid date of birth',
                    'date.max': 'Date of birth cannot be in the future',
                    'date.min': 'Date of birth seems too old'
                }),

            gender: Joi.string()
                .required()
                .valid('male', 'female', 'other')
                .messages({
                    'any.only': 'Gender must be male, female, or other'
                }),

            email: Joi.string()
                .email()
                .allow('', null)
                .trim()
                .lowercase()
                .messages({
                    'string.email': 'Invalid email format'
                }),

            phone: Joi.string()
                .pattern(/^[0-9]{10}$/)
                .allow('', null)
                .messages({
                    'string.pattern.base': 'Phone number must be 10 digits'
                }),

            currentClass: Joi.string()
                .required()
                .trim()
                .messages({
                    'string.empty': 'Class is required'
                }),

            currentSection: Joi.string()
                .required()
                .trim()
                .uppercase()
                .messages({
                    'string.empty': 'Section is required'
                }),

            rollNumber: Joi.number()
                .integer()
                .min(1)
                .allow('', null)
                .messages({
                    'number.base': 'Roll number must be a number',
                    'number.min': 'Roll number must be at least 1'
                }),

            bloodGroup: Joi.string()
                .valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '')
                .allow('', null)
                .messages({
                    'any.only': 'Invalid blood group'
                }),

            address: Joi.string()
                .allow('', null)
                .max(200)
                .messages({
                    'string.max': 'Address cannot exceed 200 characters'
                }),

            city: Joi.string()
                .allow('', null)
                .max(50),

            state: Joi.string()
                .allow('', null)
                .max(50),

            pincode: Joi.string()
                .pattern(/^[0-9]{6}$/)
                .allow('', null)
                .messages({
                    'string.pattern.base': 'Pincode must be 6 digits'
                }),

            admissionClass: Joi.string()
                .allow('', null)
                .trim()
                .max(50),

            admissionSection: Joi.string()
                .allow('', null)
                .trim()
                .max(10),

            admissionDate: Joi.date()
                .max('now')
                .allow('', null)
                .messages({
                    'date.base': 'Invalid admission date',
                    'date.max': 'Admission date cannot be in the future'
                }),

            guardianName: Joi.string()
                .allow('', null)
                .max(100),

            guardianPhone: Joi.string()
                .pattern(/^[0-9]{10}$/)
                .allow('', null)
                .messages({
                    'string.pattern.base': 'Guardian phone must be 10 digits'
                }),

            guardianEmail: Joi.string()
                .email()
                .allow('', null)
                .trim()
                .lowercase()
                .messages({
                    'string.email': 'Invalid guardian email format'
                }),

            // Ignore row number field
            _rowNumber: Joi.any()
        }).unknown(false); // Reject unknown fields
    }

    /**
     * Preview import - validate file without importing
     */
    static async previewImport(filePath, tenantId, options = {}) {
        try {
            // Parse file
            const ext = filePath.toLowerCase();
            let rows;

            if (ext.endsWith('.csv')) {
                rows = await ImportExportService.parseCSV(filePath);
            } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
                rows = await ImportExportService.parseExcel(filePath);
            } else {
                throw new Error('Unsupported file format');
            }

            if (rows.length === 0) {
                return {
                    success: false,
                    message: 'File is empty',
                    summary: { totalRows: 0, validRows: 0, invalidRows: 0 },
                    errors: [],
                    preview: []
                };
            }

            // Validate rows
            const schema = this.getValidationSchema();
            const { validRows, invalidRows, errors } = ImportExportService.validateRows(rows, schema);

            // Additional business validation for valid rows
            const businessValidation = await this.validateBusinessRules(validRows, tenantId);

            const finalValidRows = validRows.filter((row, index) =>
                !businessValidation.errors.some(err => err.rowIndex === index)
            );

            const allErrors = [...errors, ...businessValidation.errors];

            // Check for duplicates within file
            const duplicateAdmissionNumbers = ImportExportService.findDuplicates(
                finalValidRows,
                'admissionNumber'
            );

            if (duplicateAdmissionNumbers.length > 0) {
                duplicateAdmissionNumbers.forEach(admNo => {
                    allErrors.push({
                        row: 0,
                        field: 'admissionNumber',
                        message: `Duplicate admission number in file: ${admNo}`,
                        value: admNo
                    });
                });
            }

            return {
                success: true,
                summary: {
                    totalRows: rows.length,
                    validRows: finalValidRows.length,
                    invalidRows: rows.length - finalValidRows.length,
                    duplicatesInFile: duplicateAdmissionNumbers.length
                },
                errors: allErrors,
                preview: finalValidRows.slice(0, 10), // First 10 valid rows
                validData: finalValidRows // Store for execute step
            };
        } catch (error) {
            console.error('Preview import error:', error);
            throw error;
        }
    }

    /**
     * Validate business rules (class exists, no duplicates in DB, etc.)
     */
    static async validateBusinessRules(rows, tenantId) {
        const errors = [];

        // Get all classes for this tenant
        const classes = await Class.find({ tenantId, isActive: true }).lean();
        const classMap = new Map(); // Name -> Class Doc
        classes.forEach(cls => {
            classMap.set(cls.name.toLowerCase(), cls);
        });

        // Get all sections for this tenant
        // We need to fetch all active sections to validate the combinations
        const sections = await Section.find({ tenantId, isActive: true }).populate('classId').lean();
        const sectionMap = new Map(); // ClassId + SectionName -> Section Doc
        sections.forEach(sec => {
            // Key format: classID_sectionName
            const key = `${sec.classId._id}_${sec.name}`.toLowerCase();
            sectionMap.set(key, sec);
        });

        // Get existing admission numbers
        const admissionNumbers = rows.map(r => r.admissionNumber).filter(Boolean);
        const existingStudents = await User.find({
            tenantId,
            role: 'student',
            admissionNumber: { $in: admissionNumbers }
        }).select('admissionNumber').lean();

        const existingAdmissionNumbers = new Set(
            existingStudents.map(s => s.admissionNumber)
        );

        // Get existing emails
        const emails = rows.map(r => r.email).filter(Boolean);
        const existingEmails = await User.find({
            tenantId,
            email: { $in: emails }
        }).select('email').lean();

        const existingEmailSet = new Set(
            existingEmails.map(u => u.email)
        );

        // Validate each row
        rows.forEach((row, index) => {
            const rowNumber = row._rowNumber || index + 1;

            // 1. Resolve Class
            const classDoc = classMap.get(row.currentClass.toLowerCase());
            if (!classDoc) {
                errors.push({
                    row: rowNumber,
                    rowIndex: index,
                    field: 'currentClass',
                    message: `Class "${row.currentClass}" not found`,
                    value: row.currentClass
                });
                return; // Cannot validate section if class is missing
            }

            // 2. Resolve Section
            const sectionKey = `${classDoc._id}_${row.currentSection}`.toLowerCase();
            if (!sectionMap.has(sectionKey)) {
                errors.push({
                    row: rowNumber,
                    rowIndex: index,
                    field: 'currentSection',
                    message: `Section "${row.currentSection}" not found in Class "${row.currentClass}"`,
                    value: `${row.currentClass}-${row.currentSection}`
                });
            }

            // Check if admission number already exists
            if (existingAdmissionNumbers.has(row.admissionNumber)) {
                errors.push({
                    row: rowNumber,
                    rowIndex: index,
                    field: 'admissionNumber',
                    message: `Admission number already exists: ${row.admissionNumber}`,
                    value: row.admissionNumber
                });
            }

            // Check if email already exists
            if (row.email && existingEmailSet.has(row.email)) {
                errors.push({
                    row: rowNumber,
                    rowIndex: index,
                    field: 'email',
                    message: `Email already exists: ${row.email}`,
                    value: row.email
                });
            }
        });

        return { errors };
    }

    /**
     * Execute import - actually create students
     */
    static async executeImport(validData, tenantId, options = {}) {
        const {
            updateExisting = false,
            skipErrors = true
        } = options;

        const results = {
            created: 0,
            updated: 0,
            failed: 0,
            errors: []
        };
        // Get class map for quick lookup
        const classes = await Class.find({ tenantId, isActive: true }).lean();
        const classMap = new Map();
        classes.forEach(cls => {
            classMap.set(cls.name.toLowerCase(), cls);
        });

        // Get section map
        const sections = await Section.find({ tenantId, isActive: true }).lean();
        const sectionMap = new Map();
        sections.forEach(sec => {
            const key = `${sec.classId}_${sec.name}`.toLowerCase();
            sectionMap.set(key, sec);
        });

        // Process each student
        for (const row of validData) {
            try {
                // Resolve Class
                const classDoc = classMap.get(row.currentClass.toLowerCase());
                if (!classDoc) {
                    throw new Error(`Class "${row.currentClass}" not found`);
                }

                // Resolve Section
                const sectionKey = `${classDoc._id}_${row.currentSection}`.toLowerCase();
                const sectionDoc = sectionMap.get(sectionKey);
                if (!sectionDoc) {
                    throw new Error(`Section "${row.currentSection}" not found in Class "${row.currentClass}"`);
                }

                // Prepare student data
                const studentData = {
                    tenantId,
                    role: 'student',
                    admissionNumber: row.admissionNumber,
                    name: `${row.firstName} ${row.lastName}`,
                    email: row.email || undefined,
                    phone: row.phone || undefined,
                    dateOfBirth: row.dateOfBirth,
                    gender: row.gender,

                    // Linked Class & Section
                    class: row.currentClass,          // Display string
                    classId: classDoc._id,            // Reference
                    section: row.currentSection,      // Display string
                    sectionId: sectionDoc._id,        // Reference
                    rollNumber: row.rollNumber || undefined,
                    admissionClass: row.admissionClass || undefined,
                    admissionSection: row.admissionSection || undefined,
                    admissionDate: row.admissionDate || undefined,
                    bloodGroup: row.bloodGroup || undefined,
                    address: row.address || undefined,
                    city: row.city || undefined,
                    state: row.state || undefined,
                    pincode: row.pincode || undefined,
                    guardianInfo: {
                        name: row.guardianName || undefined,
                        phone: row.guardianPhone || undefined,
                        email: row.guardianEmail || undefined
                    },
                    isActive: true,
                    password: this.generateDefaultPassword(row.admissionNumber)
                };

                // Create student
                await User.create(studentData);
                results.created++;

            } catch (error) {
                console.error('Error creating student:', error);
                results.failed++;
                results.errors.push({
                    admissionNumber: row.admissionNumber,
                    error: error.message
                });

                if (!skipErrors) {
                    throw error;
                }
            }
        }

        return results;
    }

    /**
     * Generate default password for student
     */
    static generateDefaultPassword(admissionNumber) {
        // Default password: admission number + @123
        return `${admissionNumber}@123`;
    }

    /**
     * Generate CSV template
     */
    static async generateTemplate() {
        const columns = [
            { key: 'admissionNumber', header: 'admissionNumber' },
            { key: 'firstName', header: 'firstName' },
            { key: 'lastName', header: 'lastName' },
            { key: 'dateOfBirth', header: 'dateOfBirth' },
            { key: 'gender', header: 'gender' },
            { key: 'email', header: 'email' },
            { key: 'phone', header: 'phone' },
            { key: 'currentClass', header: 'currentClass' },
            { key: 'currentSection', header: 'currentSection' },
            { key: 'admissionClass', header: 'admissionClass' },
            { key: 'admissionSection', header: 'admissionSection' },
            { key: 'admissionDate', header: 'admissionDate' },
            { key: 'rollNumber', header: 'rollNumber' },
            { key: 'bloodGroup', header: 'bloodGroup' },
            { key: 'address', header: 'address' },
            { key: 'city', header: 'city' },
            { key: 'state', header: 'state' },
            { key: 'pincode', header: 'pincode' },
            { key: 'guardianName', header: 'guardianName' },
            { key: 'guardianPhone', header: 'guardianPhone' },
            { key: 'guardianEmail', header: 'guardianEmail' }
        ];

        const sampleData = [{
            admissionNumber: 'ANE2024001',
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '2010-05-15',
            gender: 'male',
            email: 'john@example.com',
            phone: '9876543210',
            currentClass: '10',
            currentSection: 'A',
            admissionClass: '1st',
            admissionSection: 'A',
            admissionDate: '2014-04-01',
            rollNumber: '1',
            bloodGroup: 'O+',
            address: '123 Main St',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            guardianName: 'Jane Doe',
            guardianPhone: '9876543211',
            guardianEmail: 'jane@example.com'
        }];

        return ImportExportService.generateTemplate(columns, sampleData);
    }
}

module.exports = StudentImportService;
