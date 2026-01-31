const Payroll = require('../models/Payroll');
const AdvanceSalary = require('../models/AdvanceSalary');
const User = require('../models/User');

/**
 * Payroll Service - Business logic for payroll management
 */
const payrollService = {
    /**
     * Generate monthly payroll for all active employees
     * @param {String} tenantId - Tenant ID
     * @param {Number} month - Month (1-12)
     * @param {Number} year - Year
     * @param {String} generatedBy - Admin user ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Result with created records
     */
    generateMonthlyPayroll: async (tenantId, month, year, generatedBy, options = {}) => {
        try {
            console.log('=== GENERATING PAYROLL ===');
            console.log('TenantId:', tenantId);
            console.log('Month:', month, 'Year:', year);
            console.log('Options:', options);

            // Get all active employees with salary
            const employees = await User.find({
                tenantId,
                role: { $in: ['admin', 'teacher', 'accountant', 'staff'] },
                isActive: true,
                salary: { $exists: true, $ne: null, $gt: 0 }
            }).select('_id name employeeId salary');

            console.log('Found employees:', employees.length);
            console.log('Employee details:', employees.map(e => ({ name: e.name, salary: e.salary, isActive: e.isActive })));

            if (employees.length === 0) {
                return {
                    success: false,
                    message: 'No active employees with salary found',
                    created: 0,
                    skipped: 0,
                    errors: []
                };
            }

            const results = {
                success: true,
                created: 0,
                skipped: 0,
                errors: [],
                records: []
            };

            for (const employee of employees) {
                try {
                    console.log(`Processing employee: ${employee.name} (${employee._id})`);

                    // Check if payroll already exists for this employee/month/year
                    const existing = await Payroll.findOne({
                        tenantId,
                        employeeId: employee._id,
                        month,
                        year
                    });

                    console.log(`Existing payroll for ${employee.name}:`, existing ? 'YES' : 'NO');

                    if (existing && !options.overwrite) {
                        console.log(`Skipping ${employee.name} - already exists and overwrite=false`);
                        results.skipped++;
                        continue;
                    }

                    // Get pending advance salaries for this employee
                    const pendingAdvances = await AdvanceSalary.find({
                        tenantId,
                        employeeId: employee._id,
                        status: 'approved',
                        deductionStatus: { $in: ['pending', 'partial'] }
                    }).sort({ requestDate: 1 });

                    // Calculate advance deductions
                    const advanceDeductions = [];
                    let totalAdvanceDeduction = 0;

                    for (const advance of pendingAdvances) {
                        const remainingAmount = advance.remainingAmount || advance.amount;
                        const deductionAmount = Math.min(remainingAmount, employee.salary * 0.5); // Max 50% of salary

                        if (deductionAmount > 0 && totalAdvanceDeduction + deductionAmount <= employee.salary) {
                            advanceDeductions.push({
                                advanceId: advance._id,
                                amount: deductionAmount,
                                deductedAt: new Date()
                            });
                            totalAdvanceDeduction += deductionAmount;
                        }
                    }

                    // Create or update payroll record
                    const baseSalary = employee.salary;
                    const bonuses = options.bonuses?.[employee._id.toString()] || 0;
                    const otherDeductions = options.deductions?.[employee._id.toString()] || 0;

                    // Calculate net salary: base + bonuses - deductions - advances
                    const netSalary = Math.max(0, baseSalary + bonuses - otherDeductions - totalAdvanceDeduction);

                    const payrollData = {
                        tenantId,
                        employeeId: employee._id,
                        month,
                        year,
                        baseSalary,
                        bonuses,
                        otherDeductions,
                        advanceDeductions,
                        totalAdvanceDeduction,
                        netSalary,
                        generatedBy,
                        generatedAt: new Date()
                    };

                    console.log(`Creating payroll for ${employee.name} with data:`, JSON.stringify(payrollData, null, 2));

                    let payroll;
                    if (existing && options.overwrite) {
                        console.log(`Updating existing payroll for ${employee.name}`);
                        payroll = await Payroll.findByIdAndUpdate(
                            existing._id,
                            { ...payrollData, updatedBy: generatedBy },
                            { new: true, runValidators: true }
                        );
                    } else {
                        console.log(`Creating new payroll for ${employee.name}`);
                        payroll = await Payroll.create(payrollData);
                    }

                    console.log(`✅ Successfully created payroll for ${employee.name}`);

                    // Update advance salary records
                    for (const deduction of advanceDeductions) {
                        const advance = await AdvanceSalary.findById(deduction.advanceId);
                        if (advance) {
                            await advance.addDeduction(payroll._id, deduction.amount, month, year);
                        }
                    }

                    results.created++;
                    results.records.push(payroll);

                } catch (error) {
                    console.error(`❌ ERROR processing ${employee.name}:`, error);
                    console.error('Error details:', error.message);
                    console.error('Error stack:', error.stack);
                    results.errors.push({
                        employeeId: employee.employeeId,
                        name: employee.name,
                        error: error.message
                    });
                }
            }

            return results;

        } catch (error) {
            throw new Error(`Failed to generate payroll: ${error.message}`);
        }
    },

    /**
     * Get payroll records with filters
     * @param {Object} filter - MongoDB filter
     * @param {Object} options - Pagination and sorting options
     * @returns {Promise<Object>} Payroll records with pagination
     */
    getPayrollRecords: async (filter, options = {}) => {
        try {
            const page = options.page || 1;
            const limit = options.limit || 20;
            const skip = (page - 1) * limit;

            const records = await Payroll.find(filter)
                .populate('employeeId', 'name employeeId email phone designation department')
                .populate('generatedBy', 'name email')
                .sort(options.sort || { year: -1, month: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await Payroll.countDocuments(filter);

            return {
                success: true,
                data: records,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total
                }
            };

        } catch (error) {
            throw new Error(`Failed to get payroll records: ${error.message}`);
        }
    },

    /**
     * Get employee payroll history
     * @param {String} employeeId - Employee ID
     * @param {String} tenantId - Tenant ID
     * @param {Number} year - Optional year filter
     * @returns {Promise<Array>} Payroll records
     */
    getEmployeePayrollHistory: async (employeeId, tenantId, year = null) => {
        try {
            const filter = { employeeId, tenantId, isDeleted: { $ne: true } };
            if (year) {
                filter.year = year;
            }

            const records = await Payroll.find(filter)
                .sort({ year: -1, month: -1 })
                .lean();

            return records;

        } catch (error) {
            throw new Error(`Failed to get employee payroll history: ${error.message}`);
        }
    },

    /**
     * Calculate salary summary for a period
     * @param {String} tenantId - Tenant ID
     * @param {Number} month - Month
     * @param {Number} year - Year
     * @returns {Promise<Object>} Summary statistics
     */
    getSalarySummary: async (tenantId, month, year) => {
        try {
            const records = await Payroll.find({ tenantId, month, year, isDeleted: { $ne: true } });

            const summary = {
                totalEmployees: records.length,
                totalBaseSalary: 0,
                totalBonuses: 0,
                totalDeductions: 0,
                totalAdvanceDeductions: 0,
                totalNetSalary: 0,
                paidCount: 0,
                pendingCount: 0
            };

            records.forEach(record => {
                summary.totalBaseSalary += record.baseSalary;
                summary.totalBonuses += record.bonuses;
                summary.totalDeductions += record.otherDeductions;
                summary.totalAdvanceDeductions += record.totalAdvanceDeduction;
                summary.totalNetSalary += record.netSalary;

                if (record.paymentStatus === 'paid') {
                    summary.paidCount++;
                } else if (record.paymentStatus === 'pending') {
                    summary.pendingCount++;
                }
            });

            return summary;

        } catch (error) {
            throw new Error(`Failed to calculate salary summary: ${error.message}`);
        }
    }
};

module.exports = payrollService;
