const express = require('express');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Counter = require('../models/Counter');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const Settings = require('../models/Settings');
const notificationService = require('../services/notificationService');

const router = express.Router();

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private (Admin, Teacher)
router.get('/', protect, authorize('admin', 'teacher'), [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 2000 }).withMessage('Limit must be between 1 and 2000'),
    query('role').optional().trim().notEmpty().withMessage('Role filter cannot be empty'),
    query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Build filter for employees (non-student, non-parent roles)
        const filter = {
            role: { $in: ['admin', 'teacher', 'accountant', 'staff'] },
            tenantId: req.user.tenantId
        };

        // Add role filter
        if (req.query.role) {
            filter.role = req.query.role;
        }

        // Add department filter
        if (req.query.department) {
            filter.department = req.query.department;
        }

        // Add status filter
        if (req.query.status) {
            filter.isActive = req.query.status === 'active';
        }

        // Add search filter
        if (req.query.search) {
            filter.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } },
                { phone: { $regex: req.query.search, $options: 'i' } },
                { employeeId: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Get employees
        const employees = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count
        const total = await User.countDocuments(filter);

        res.json({
            success: true,
            data: employees,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching employees'
        });
    }
});

// @desc    Get filter options
// @route   GET /api/employees/filters
// @access  Private (Admin)
router.get('/filters', protect, authorize('admin'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        // Get unique roles
        const roles = await User.distinct('role', {
            role: { $in: ['admin', 'teacher', 'accountant', 'staff'] },
            tenantId
        });

        // Get unique departments
        const departments = await User.distinct('department', {
            role: { $in: ['admin', 'teacher', 'accountant', 'staff'] },
            tenantId,
            department: { $ne: null }
        });

        res.json({
            success: true,
            data: {
                roles: roles.sort(),
                departments: departments.sort()
            }
        });
    } catch (error) {
        console.error('Get filters error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching filters'
        });
    }
});

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private (Admin, Self)
router.get('/:id', protect, async (req, res) => {
    try {
        const employee = await User.findById(req.params.id).select('-password');

        if (!employee || !['admin', 'teacher', 'accountant', 'staff'].includes(employee.role)) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check access: admin or self
        if (req.user.role !== 'admin' && req.user._id.toString() !== employee._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this employee'
            });
        }

        res.json({
            success: true,
            data: employee
        });
    } catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching employee'
        });
    }
});

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('role').isIn(['admin', 'teacher', 'accountant', 'staff']).withMessage('Invalid role'),
    body('salary').optional().isFloat({ min: 0 }).withMessage('Salary must be >= 0'),
    handleValidationErrors
], async (req, res) => {
    try {
        const {
            name, phone, email, role, salary, dateOfJoining, designation, department,
            fatherOrHusbandName, gender, dateOfBirth, religion, bloodGroup, nationalId,
            education, experience, homeAddress, photo, password
        } = req.body;

        const tenantId = req.user.tenantId;

        // Check phone uniqueness
        if (await User.findOne({ phone: phone.trim(), tenantId })) {
            return res.status(400).json({
                success: false,
                message: 'Employee with this phone number already exists'
            });
        }

        // Check email uniqueness if provided
        if (email && await User.findOne({ email: email.toLowerCase().trim(), tenantId })) {
            return res.status(400).json({
                success: false,
                message: 'Employee with this email already exists'
            });
        }

        // Generate Employee ID
        const currentYear = new Date().getFullYear().toString();
        const sequence = await Counter.getNextSequence('employee', currentYear, tenantId);
        const employeeId = `EMP${currentYear}${String(sequence).padStart(4, '0')}`;

        const employeeData = {
            name: name.trim(),
            phone: phone.trim(),
            email: email ? email.toLowerCase().trim() : undefined,
            password: password || 'employee123',
            role,
            tenantId,
            employeeId,
            salary,
            dateOfJoining: dateOfJoining || new Date(),
            designation,
            department,
            fatherOrHusbandName,
            gender,
            dateOfBirth,
            religion,
            bloodGroup,
            nationalId,
            education,
            experience,
            homeAddress,
            photo,
            isActive: true,
            loginEnabled: true
        };

        const employee = await User.create(employeeData);

        // Send notification about new employee
        try {
            await notificationService.notifyNewEmployee(employee, tenantId);
        } catch (notifError) {
            console.error('Error sending employee notification:', notifError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: {
                id: employee._id,
                name: employee.name,
                employeeId: employee.employeeId,
                email: employee.email,
                phone: employee.phone,
                role: employee.role,
                credentials: {
                    email: employee.email || employee.phone,
                    password: password || 'employee123'
                }
            }
        });
    } catch (error) {
        console.error('Create employee error:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate entry detected (Phone or Email)'
            });
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('salary').optional().isFloat({ min: 0 }).withMessage('Salary must be >= 0'),
    handleValidationErrors
], async (req, res) => {
    try {
        const employee = await User.findById(req.params.id);

        if (!employee || !['admin', 'teacher', 'accountant', 'staff'].includes(employee.role)) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check phone uniqueness if being updated
        if (req.body.phone && req.body.phone !== employee.phone) {
            const existingPhone = await User.findOne({
                phone: req.body.phone.trim(),
                tenantId: req.user.tenantId,
                _id: { $ne: req.params.id }
            });
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already exists'
                });
            }
        }

        // Check email uniqueness if being updated
        if (req.body.email && req.body.email !== employee.email) {
            const existingEmail = await User.findOne({
                email: req.body.email.toLowerCase().trim(),
                tenantId: req.user.tenantId,
                _id: { $ne: req.params.id }
            });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Update employee
        const updatePayload = { ...req.body };
        if (updatePayload.password === '') {
            delete updatePayload.password;
        }

        const updatedEmployee = await User.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Employee updated successfully',
            data: updatedEmployee
        });
    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating employee'
        });
    }
});

// @desc    Delete employee (soft delete)
// @route   DELETE /api/employees/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const employee = await User.findById(req.params.id);

        if (!employee || !['admin', 'teacher', 'accountant', 'staff'].includes(employee.role)) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Soft delete - set inactive
        employee.isActive = false;
        employee.loginEnabled = false;
        employee.inactiveReason = 'Deleted by admin';
        employee.inactivatedAt = new Date();
        employee.inactivatedBy = req.user._id;
        await employee.save();

        res.json({
            success: true,
            message: 'Employee deleted successfully'
        });
    } catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting employee'
        });
    }
});

// @desc    Toggle employee status
// @route   PUT /api/employees/:id/toggle-status
// @access  Private (Admin)
router.put('/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
    try {
        const { reason } = req.body;
        const employee = await User.findById(req.params.id);

        if (!employee || !['admin', 'teacher', 'accountant', 'staff'].includes(employee.role)) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Toggle status
        employee.isActive = !employee.isActive;

        if (!employee.isActive) {
            employee.inactiveReason = reason || 'No reason provided';
            employee.inactivatedAt = new Date();
            employee.inactivatedBy = req.user._id;
            employee.loginEnabled = false;
        } else {
            employee.inactiveReason = null;
            employee.inactivatedAt = null;
            employee.inactivatedBy = null;
            employee.loginEnabled = true;
        }

        await employee.save();

        res.json({
            success: true,
            message: `Employee ${employee.isActive ? 'activated' : 'deactivated'} successfully`,
            data: employee
        });
    } catch (error) {
        console.error('Toggle status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while toggling employee status'
        });
    }
});

// @desc    Reset employee password
// @route   PUT /api/employees/:id/reset-password
// @access  Private (Admin)
router.put('/:id/reset-password', protect, authorize('admin'), async (req, res) => {
    try {
        const { newPassword, forceChange } = req.body;
        const employee = await User.findById(req.params.id);

        if (!employee || !['admin', 'teacher', 'accountant', 'staff'].includes(employee.role)) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        employee.password = newPassword || 'employee123';
        employee.forcePasswordChange = forceChange !== undefined ? forceChange : true;
        await employee.save();

        res.json({
            success: true,
            message: 'Password reset successfully',
            data: {
                email: employee.email || employee.phone,
                newPassword: newPassword || 'employee123'
            }
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while resetting password'
        });
    }
});

// @desc    Create login for employee
// @route   POST /api/employees/:id/create-login
// @access  Private (Admin)
router.post('/:id/create-login', protect, authorize('admin'), async (req, res) => {
    try {
        const { email, password } = req.body;
        const employee = await User.findById(req.params.id);

        if (!employee || !['admin', 'teacher', 'accountant', 'staff'].includes(employee.role)) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Update email if provided
        if (email) {
            // Check email uniqueness
            const existingEmail = await User.findOne({
                email: email.toLowerCase().trim(),
                tenantId: req.user.tenantId,
                _id: { $ne: req.params.id }
            });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
            employee.email = email.toLowerCase().trim();
        }

        employee.password = password || 'employee123';
        employee.loginEnabled = true;
        employee.forcePasswordChange = true;
        await employee.save();

        res.json({
            success: true,
            message: 'Login created successfully',
            data: {
                username: employee.email || employee.phone,
                password: password || 'employee123'
            }
        });
    } catch (error) {
        console.error('Create login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating login'
        });
    }
});

// @desc    Disable employee login
// @route   PUT /api/employees/:id/disable-login
// @access  Private (Admin)
router.put('/:id/disable-login', protect, authorize('admin'), async (req, res) => {
    try {
        const employee = await User.findById(req.params.id);

        if (!employee || !['admin', 'teacher', 'accountant', 'staff'].includes(employee.role)) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        employee.loginEnabled = false;
        await employee.save();

        res.json({
            success: true,
            message: 'Login disabled successfully'
        });
    } catch (error) {
        console.error('Disable login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while disabling login'
        });
    }
});

// ============================================================================
// IMPORT/EXPORT ROUTES
// ============================================================================

const { uploadSingleFile, deleteFile } = require('../middleware/fileUpload');
const EmployeeImportService = require('../services/employeeImportService');
const ImportExportService = require('../services/importExportService');

// @desc    Download CSV template
// @route   GET /api/employees/import/template
// @access  Private (Admin)
router.get('/import/template', protect, authorize('admin'), async (req, res) => {
    try {
        const template = await EmployeeImportService.generateTemplate();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=employee_import_template.csv');
        res.send(template);
    } catch (error) {
        console.error('Generate template error:', error);
        res.status(500).json({ success: false, message: 'Server error while generating template' });
    }
});

// @desc    Preview import
// @route   POST /api/employees/import/preview
// @access  Private (Admin)
router.post('/import/preview', protect, authorize('admin'), (req, res) => {
    uploadSingleFile(req, res, async (err) => {
        try {
            if (err) return res.status(400).json({ success: false, message: err.message });
            if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });

            const result = await EmployeeImportService.previewImport(req.file.path, req.user.tenantId);
            result.uploadedFile = req.file.filename;
            res.json(result);
        } catch (error) {
            console.error('Preview import error:', error);
            if (req.file) await deleteFile(req.file.path).catch(console.error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
});

// @desc    Execute import
// @route   POST /api/employees/import/execute
// @access  Private (Admin)
router.post('/import/execute', protect, authorize('admin'), async (req, res) => {
    try {
        const { validData, options } = req.body;
        if (!validData || !Array.isArray(validData) || validData.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid data to import' });
        }

        const result = await EmployeeImportService.executeImport(validData, req.user.tenantId, options || {});
        res.json({
            success: true,
            message: `Import completed. Created: ${result.created}, Failed: ${result.failed}`,
            data: result
        });
    } catch (error) {
        console.error('Execute import error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// @desc    Export employees
// @route   GET /api/employees/export
// @access  Private (Admin)
router.get('/export', protect, authorize('admin'), async (req, res) => {
    try {
        const filter = {
            role: { $in: ['admin', 'teacher', 'accountant', 'staff'] },
            tenantId: req.user.tenantId
        };

        if (req.query.role) filter.role = req.query.role;
        if (req.query.department) filter.department = req.query.department;
        if (req.query.status) filter.isActive = req.query.status === 'active';

        const employees = await User.find(filter).select('-password').lean();

        const columns = [
            { key: 'employeeId', header: 'Employee ID' },
            { key: 'name', header: 'Name' },
            { key: 'email', header: 'Email' },
            { key: 'phone', header: 'Phone' },
            { key: 'role', header: 'Role' },
            { key: 'department', header: 'Department' },
            { key: 'dateOfJoining', header: 'Date of Joining', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
            { key: 'isActive', header: 'Status', format: (val) => val ? 'Active' : 'Inactive' }
        ];

        const csvBuffer = await ImportExportService.exportToCSV(employees, columns);
        const filename = `employees_export_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(csvBuffer);
    } catch (error) {
        console.error('Export employees error:', error);
        res.status(500).json({ success: false, message: 'Server error while exporting employees' });
    }
});

// @desc    Upload employee profile photo
// @route   POST /api/employees/:id/upload-photo
// @access  Private (Admin)
const upload = require('../middleware/upload');
const cloudinaryService = require('../services/cloudinaryService');

router.post('/:id/upload-photo', protect, authorize('admin'), upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No photo uploaded' });
        }

        const employee = await User.findById(req.params.id);

        if (!employee || !['admin', 'teacher', 'accountant', 'staff'].includes(employee.role)) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Check if Cloudinary is configured
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'File upload service not configured. Please contact administrator.'
            });
        }

        // Upload to Cloudinary
        const result = await cloudinaryService.uploadEmployeePhoto(
            req.file,
            req.user.tenantId.toString(),
            employee._id.toString()
        );

        // Save photo URL to employee
        const updatedEmployee = await User.findByIdAndUpdate(
            req.params.id,
            { photo: result.secure_url },
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Employee photo uploaded successfully',
            data: { url: result.secure_url, employee: updatedEmployee }
        });
    } catch (error) {
        console.error('Upload employee photo error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while uploading employee photo'
        });
    }
});

module.exports = router;

