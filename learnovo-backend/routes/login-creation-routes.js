// Login Creation Routes for Students
// These routes handle creating login credentials for students who were imported without email addresses

const crypto = require('crypto');

// Helper function to generate secure random password
function generateSecurePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
        password += charset[randomBytes[i] % charset.length];
    }

    return password;
}

// @desc    Create login credentials for a student
// @route   POST /api/students/:id/create-login
// @access  Private (Admin)
router.post('/:id/create-login', protect, authorize('admin'), async (req, res) => {
    try {
        const { email, password, sendCredentials } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Email is required to create login credentials'
            });
        }

        const student = await User.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId,
            role: 'student'
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        if (student.hasLogin) {
            return res.status(400).json({
                success: false,
                message: 'Student already has login credentials. Use update route to modify.'
            });
        }

        // Check email uniqueness
        const existing = await User.findOne({
            email: email.toLowerCase().trim(),
            tenantId: req.user.tenantId
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Email already in use by another user'
            });
        }

        // Generate password if not provided
        const generatedPassword = password || generateSecurePassword();

        // Update student with login credentials
        student.email = email.toLowerCase().trim();
        student.password = generatedPassword;
        student.loginCreatedAt = new Date();
        student.loginCreatedBy = req.user._id;

        await student.save();

        // TODO: Send credentials email if sendCredentials is true
        // await sendCredentialsEmail(student.email, generatedPassword);

        res.json({
            success: true,
            message: 'Login credentials created successfully',
            data: {
                studentId: student._id,
                name: student.fullName || student.name,
                email: student.email,
                password: generatedPassword, // Return password only on creation
                hasLogin: student.hasLogin
            }
        });
    } catch (error) {
        console.error('Create login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating login credentials'
        });
    }
});

// @desc    Bulk create login credentials for multiple students
// @route   POST /api/students/bulk-create-logins
// @access  Private (Admin)
router.post('/bulk-create-logins', protect, authorize('admin'), async (req, res) => {
    try {
        const { studentIds, emailDomain, sendCredentials } = req.body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of student IDs'
            });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [],
            credentials: []
        };

        const domain = emailDomain || 'school.learnovo.local';

        for (const studentId of studentIds) {
            try {
                const student = await User.findOne({
                    _id: studentId,
                    tenantId: req.user.tenantId,
                    role: 'student'
                });

                if (!student) {
                    results.failed++;
                    results.errors.push({
                        studentId,
                        error: 'Student not found'
                    });
                    continue;
                }

                if (student.hasLogin) {
                    results.failed++;
                    results.errors.push({
                        studentId,
                        name: student.fullName || student.name,
                        error: 'Already has login credentials'
                    });
                    continue;
                }

                // Generate email if not present
                let email = student.email;
                if (!email || !email.trim()) {
                    if (!student.admissionNumber) {
                        results.failed++;
                        results.errors.push({
                            studentId,
                            name: student.fullName || student.name,
                            error: 'No email and no admission number to generate email'
                        });
                        continue;
                    }
                    email = `${student.admissionNumber.toLowerCase()}@${domain}`;
                }

                // Check email uniqueness
                const existing = await User.findOne({
                    email: email.toLowerCase().trim(),
                    tenantId: req.user.tenantId
                });

                if (existing && existing._id.toString() !== studentId) {
                    results.failed++;
                    results.errors.push({
                        studentId,
                        name: student.fullName || student.name,
                        error: `Email ${email} already in use`
                    });
                    continue;
                }

                const generatedPassword = generateSecurePassword();

                student.email = email.toLowerCase().trim();
                student.password = generatedPassword;
                student.loginEnabled = false; // Inactive by default for bulk creation
                student.loginCreatedAt = new Date();
                student.loginCreatedBy = req.user._id;

                await student.save();

                results.success++;
                results.credentials.push({
                    studentId: student._id,
                    name: student.fullName || student.name,
                    admissionNumber: student.admissionNumber,
                    email: student.email,
                    password: generatedPassword
                });

                // TODO: Send credentials email if sendCredentials is true

            } catch (error) {
                results.failed++;
                results.errors.push({
                    studentId,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Bulk login creation completed. Success: ${results.success}, Failed: ${results.failed}`,
            results
        });
    } catch (error) {
        console.error('Bulk create logins error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during bulk login creation'
        });
    }
});

module.exports = { generateSecurePassword };
