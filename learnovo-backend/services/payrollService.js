const Payroll = require('../models/Payroll');
const AdvanceSalary = require('../models/AdvanceSalary');
const User = require('../models/User');
const Driver = require('../models/Driver');

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
  generateMonthlyPayroll: async(tenantId, month, year, generatedBy, options = {}) => {
    try {
      console.log('=== GENERATING PAYROLL ===');
      console.log('TenantId:', tenantId);
      console.log('Month:', month, 'Year:', year);
      console.log('Options:', options);

      // Get all active employees with salary, optionally restricted to a chosen subset
      const employeeFilter = {
        tenantId,
        role: { $in: ['admin', 'teacher', 'accountant', 'staff'] },
        isActive: true,
        salary: { $exists: true, $ne: null, $gt: 0 }
      };
      if (Array.isArray(options.employeeIds) && options.employeeIds.length > 0) {
        employeeFilter._id = { $in: options.employeeIds };
      }
      const userEmployees = await User.find(employeeFilter).select('_id name employeeId salary leaveDeductionPerDay');

      // Also include drivers (active, with salary, optionally restricted)
      const driverFilter = {
        tenantId,
        isActive: true,
        salary: { $exists: true, $ne: null, $gt: 0 }
      };
      if (Array.isArray(options.driverIds) && options.driverIds.length > 0) {
        driverFilter._id = { $in: options.driverIds };
      } else if (Array.isArray(options.employeeIds) && options.employeeIds.length > 0 && (!Array.isArray(options.driverIds))) {
        // Backwards compat: when only employeeIds is sent, do not include drivers
        driverFilter._id = { $in: [] };
      }
      const drivers = await Driver.find(driverFilter).select('_id name driverId salary');

      // Normalize into a unified workers list
      const employees = [
        ...userEmployees.map(u => ({
          _id: u._id,
          name: u.name,
          employeeId: u.employeeId,
          salary: u.salary,
          leaveDeductionPerDay: u.leaveDeductionPerDay,
          employeeType: 'User'
        })),
        ...drivers.map(d => ({
          _id: d._id,
          name: d.name,
          employeeId: d.driverId,
          salary: d.salary,
          leaveDeductionPerDay: 0,
          employeeType: 'Driver'
        }))
      ];

      console.log('Found employees:', employees.length, '(', userEmployees.length, 'users +', drivers.length, 'drivers )');

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
            employeeType: employee.employeeType,
            month,
            year
          });

          console.log(`Existing payroll for ${employee.name}:`, existing ? (existing.isDeleted ? 'YES (soft-deleted)' : 'YES') : 'NO');

          // Soft-deleted records should be regenerated automatically (admin deleted them
          // intending to redo this month). Only skip when an active record exists and
          // overwrite is not set.
          if (existing && !existing.isDeleted && !options.overwrite) {
            console.log(`Skipping ${employee.name} - already exists and overwrite=false`);
            results.skipped++;
            continue;
          }

          // Get pending advance salaries for this employee
          // (Drivers don't currently support advance salary; skip lookup for them)
          const pendingAdvances = employee.employeeType === 'Driver' ? [] : await AdvanceSalary.find({
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

          // Calculate leave deductions
          const leaveDays = options.leaveDays?.[employee._id.toString()] || 0;
          const leaveDeductionPerDay = employee.leaveDeductionPerDay || 0;
          const leaveDeduction = leaveDays * leaveDeductionPerDay;

          // Calculate net salary: base + bonuses - deductions - advances - leave deductions
          const netSalary = Math.max(0, baseSalary + bonuses - otherDeductions - totalAdvanceDeduction - leaveDeduction);

          const payrollData = {
            tenantId,
            employeeId: employee._id,
            employeeType: employee.employeeType,
            month,
            year,
            baseSalary,
            bonuses,
            otherDeductions,
            advanceDeductions,
            totalAdvanceDeduction,
            leaveDays,
            leaveDeduction,
            netSalary,
            generatedBy,
            generatedAt: new Date(),
            academicSessionId: options.academicSessionId || undefined
          };

          console.log(`Creating payroll for ${employee.name} with data:`, JSON.stringify(payrollData, null, 2));

          let payroll;
          if (existing) {
            console.log(`Updating existing payroll for ${employee.name}${existing.isDeleted ? ' (restoring soft-deleted record)' : ''}`);
            payroll = await Payroll.findByIdAndUpdate(
              existing._id,
              {
                $set: {
                  ...payrollData,
                  updatedBy: generatedBy,
                  isDeleted: false,
                  paymentStatus: existing.isDeleted ? 'pending' : (existing.paymentStatus || 'pending')
                },
                $unset: { deletedAt: '', deletedBy: '' }
              },
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
  getPayrollRecords: async(filter, options = {}) => {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      // Exclude payroll records for inactive employees/drivers so their salary isn't shown
      if (filter.tenantId && !filter.employeeId) {
        const [inactiveUsers, inactiveDrivers] = await Promise.all([
          User.find({ tenantId: filter.tenantId, isActive: false }).select('_id').lean(),
          Driver.find({ tenantId: filter.tenantId, isActive: false }).select('_id').lean()
        ]);
        const inactiveIds = [
          ...inactiveUsers.map(e => e._id),
          ...inactiveDrivers.map(d => d._id)
        ];
        if (inactiveIds.length > 0) {
          filter.employeeId = { $nin: inactiveIds };
        }
      }

      const records = await Payroll.find(filter)
        .populate('employeeId', 'name employeeId driverId email phone designation department accountNumber ifscCode bankName')
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
  getEmployeePayrollHistory: async(employeeId, tenantId, year = null) => {
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
  getSalarySummary: async(tenantId, month, year) => {
    try {
      const inactiveEmployees = await User.find({ tenantId, isActive: false }).select('_id').lean();
      const summaryFilter = { tenantId, month, year, isDeleted: { $ne: true } };
      if (inactiveEmployees.length > 0) {
        summaryFilter.employeeId = { $nin: inactiveEmployees.map(e => e._id) };
      }
      const records = await Payroll.find(summaryFilter);

      const summary = {
        totalEmployees: records.length,
        totalBaseSalary: 0,
        totalBonuses: 0,
        totalDeductions: 0,
        totalAdvanceDeductions: 0,
        totalLeaveDeductions: 0,
        totalNetSalary: 0,
        paidCount: 0,
        pendingCount: 0
      };

      records.forEach(record => {
        summary.totalBaseSalary += record.baseSalary;
        summary.totalBonuses += record.bonuses;
        summary.totalDeductions += record.otherDeductions;
        summary.totalAdvanceDeductions += record.totalAdvanceDeduction;
        summary.totalLeaveDeductions += record.leaveDeduction || 0;
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
