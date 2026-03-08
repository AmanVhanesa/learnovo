const Joi = require('joi');
const ImportExportService = require('./importExportService');
const User = require('../models/User');

/**
 * Employee Import Service
 * Handles importing employees from CSV/Excel files
 */

class EmployeeImportService {
    /**
     * Validation schema for employee import
     */
    static getValidationSchema() {
        return Joi.object({
            employeeId: Joi.string()
                .required()
                .trim()
                .uppercase()
                .pattern(/^[A-Z0-9]+$/)
                .min(3)
                .max(20)
                .messages({
                    'string.empty': 'Employee ID is required',
                    'string.pattern.base': 'Employee ID must be alphanumeric',
                    'string.min': 'Employee ID must be at least 3 characters',
                    'string.max': 'Employee ID cannot exceed 20 characters'
                }),

            firstName: Joi.string()
                .required()
                .trim()
                .min(2)
                .max(50)
                .messages({
                    'string.empty': 'First name is required'
                }),

            lastName: Joi.string()
                .required()
                .trim()
                .min(2)
                .max(50)
                .messages({
                    'string.empty': 'Last name is required'
                }),

            email: Joi.string()
                .email()
                .required()
                .trim()
                .lowercase()
                .messages({
                    'string.email': 'Invalid email format',
                    'string.empty': 'Email is required'
                }),

            phone: Joi.string()
                .pattern(/^[0-9]{10}$/)
                .required()
                .messages({
                    'string.pattern.base': 'Phone number must be 10 digits',
                    'string.empty': 'Phone is required'
                }),

            role: Joi.string()
                .required()
                .valid('teacher', 'admin', 'accountant', 'librarian', 'staff')
                .messages({
                    'any.only': 'Role must be: teacher, admin, accountant, librarian, or staff',
                    'string.empty': 'Role is required'
                }),

            department: Joi.string()
                .allow('', null)
                .max(50),

            dateOfJoining: Joi.date()
                .required()
                .max('now')
                .messages({
                    'date.base': 'Invalid date of joining',
                    'date.max': 'Date of joining cannot be in the future',
                    'date.empty': 'Date of joining is required'
                }),

            dateOfBirth: Joi.date()
                .required()
                .max('now')
                .min('1950-01-01')
                .messages({
                    'date.base': 'Invalid date of birth',
                    'date.max': 'Date of birth cannot be in the future'
                }),

            gender: Joi.string()
                .required()
                .valid('male', 'female', 'other')
                .messages({
                    'any.only': 'Gender must be male, female, or other'
                }),

            qualification: Joi.string()
                .allow('', null)
                .max(100),

            address: Joi.string()
                .allow('', null)
                .max(200),

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

            emergencyContact: Joi.string()
                .allow('', null)
                .max(100),

            emergencyPhone: Joi.string()
                .pattern(/^[0-9]{10}$/)
                .allow('', null)
                .messages({
                    'string.pattern.base': 'Emergency phone must be 10 digits'
                }),

            _rowNumber: Joi.any()
        }).unknown(false);
    }

    /**
     * Preview import
     */
    static async previewImport(filePath, tenantId, options = {}) {
        try {
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

            const schema = this.getValidationSchema();
            const { validRows, invalidRows, errors } = ImportExportService.validateRows(rows, schema);

            const businessValidation = await this.validateBusinessRules(validRows, tenantId);

            const finalValidRows = validRows.filter((row, index) =>
                !businessValidation.errors.some(err => err.rowIndex === index)
            );

            const allErrors = [...errors, ...businessValidation.errors];

            const duplicateEmployeeIds = ImportExportService.findDuplicates(
                finalValidRows,
                'employeeId'
            );

            if (duplicateEmployeeIds.length > 0) {
                duplicateEmployeeIds.forEach(empId => {
                    allErrors.push({
                        row: 0,
                        field: 'employeeId',
                        message: `Duplicate employee ID in file: ${empId}`,
                        value: empId
                    });
                });
            }

            return {
                success: true,
                summary: {
                    totalRows: rows.length,
                    validRows: finalValidRows.length,
                    invalidRows: rows.length - finalValidRows.length,
                    duplicatesInFile: duplicateEmployeeIds.length
                },
                errors: allErrors,
                preview: finalValidRows.slice(0, 10),
                validData: finalValidRows
            };
        } catch (error) {
            console.error('Preview import error:', error);
            throw error;
        }
    }

    /**
     * Validate business rules
     */
    static async validateBusinessRules(rows, tenantId) {
        const errors = [];

        const employeeIds = rows.map(r => r.employeeId).filter(Boolean);
        const existingEmployees = await User.find({
            tenantId,
            role: { $in: ['teacher', 'admin', 'accountant', 'librarian', 'staff'] },
            employeeId: { $in: employeeIds }
        }).select('employeeId').lean();

        const existingEmployeeIds = new Set(
            existingEmployees.map(e => e.employeeId)
        );

        const emails = rows.map(r => r.email).filter(Boolean);
        const existingEmails = await User.find({
            tenantId,
            email: { $in: emails }
        }).select('email').lean();

        const existingEmailSet = new Set(
            existingEmails.map(u => u.email)
        );

        rows.forEach((row, index) => {
            const rowNumber = row._rowNumber || index + 1;

            if (existingEmployeeIds.has(row.employeeId)) {
                errors.push({
                    row: rowNumber,
                    rowIndex: index,
                    field: 'employeeId',
                    message: `Employee ID already exists: ${row.employeeId}`,
                    value: row.employeeId
                });
            }

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
     * Execute import
     */
    static async executeImport(validData, tenantId, options = {}) {
        const { skipErrors = true } = options;

        const results = {
            created: 0,
            updated: 0,
            failed: 0,
            errors: []
        };

        for (const row of validData) {
            try {
                const employeeData = {
                    tenantId,
                    role: row.role,
                    employeeId: row.employeeId,
                    name: `${row.firstName} ${row.lastName}`,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    email: row.email,
                    phone: row.phone,
                    dateOfBirth: row.dateOfBirth,
                    gender: row.gender,
                    department: row.department || undefined,
                    qualification: row.qualification || undefined,
                    dateOfJoining: row.dateOfJoining,
                    address: row.address || undefined,
                    city: row.city || undefined,
                    state: row.state || undefined,
                    pincode: row.pincode || undefined,
                    emergencyContact: row.emergencyContact || undefined,
                    emergencyPhone: row.emergencyPhone || undefined,
                    isActive: true,
                    password: this.generateDefaultPassword(row.employeeId)
                };

                await User.create(employeeData);
                results.created++;

            } catch (error) {
                console.error('Error creating employee:', error);
                results.failed++;
                results.errors.push({
                    employeeId: row.employeeId,
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
     * Generate default password
     */
    static generateDefaultPassword(employeeId) {
        return `${employeeId}@123`;
    }

    /**
     * Generate CSV template
     */
    static async generateTemplate() {
        const columns = [
            { key: 'employeeId', header: 'employeeId' },
            { key: 'firstName', header: 'firstName' },
            { key: 'lastName', header: 'lastName' },
            { key: 'email', header: 'email' },
            { key: 'phone', header: 'phone' },
            { key: 'role', header: 'role' },
            { key: 'department', header: 'department' },
            { key: 'dateOfJoining', header: 'dateOfJoining' },
            { key: 'dateOfBirth', header: 'dateOfBirth' },
            { key: 'gender', header: 'gender' },
            { key: 'qualification', header: 'qualification' },
            { key: 'address', header: 'address' },
            { key: 'city', header: 'city' },
            { key: 'state', header: 'state' },
            { key: 'pincode', header: 'pincode' },
            { key: 'emergencyContact', header: 'emergencyContact' },
            { key: 'emergencyPhone', header: 'emergencyPhone' }
        ];

        const sampleData = [{
            employeeId: 'EMP001',
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@school.com',
            phone: '9876543210',
            role: 'teacher',
            department: 'Science',
            dateOfJoining: '2024-01-15',
            dateOfBirth: '1990-03-20',
            gender: 'female',
            qualification: 'M.Sc',
            address: '456 Park Ave',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001',
            emergencyContact: 'Bob Smith',
            emergencyPhone: '9876543211'
        }];

        return ImportExportService.generateTemplate(columns, sampleData);
    }
}

module.exports = EmployeeImportService;
