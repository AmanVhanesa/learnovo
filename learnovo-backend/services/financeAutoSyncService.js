/**
 * Finance Auto-Sync Service
 *
 * Automatically creates Income records when fee payments are confirmed
 * and Expense records when payroll is marked as paid.
 *
 * Design principles:
 *   - Idempotent: checks for existing records before creating
 *   - Non-blocking: fee/payroll operations are primary; finance sync is secondary
 *   - All errors are logged but never thrown back to the caller
 */

const Income = require('../models/Income');
const Expense = require('../models/Expense');
const IncomeCategory = require('../models/IncomeCategory');
const ExpenseCategory = require('../models/ExpenseCategory');
const { logger } = require('../middleware/errorHandler');

const LOG_PREFIX = '[Finance-AutoSync]';

/**
 * Resolves (or creates) the "Fee Collection" income category for a tenant.
 * Uses findOneAndUpdate with upsert for atomicity.
 * @param {ObjectId} tenantId
 * @returns {Promise<ObjectId>} category _id
 */
async function getOrCreateFeeCollectionCategory(tenantId) {
  const category = await IncomeCategory.findOneAndUpdate(
    { tenantId, name: 'Fee Collection' },
    {
      $setOnInsert: {
        tenantId,
        name: 'Fee Collection',
        icon: 'GraduationCap',
        color: '#3B82F6',
        isActive: true
      }
    },
    { upsert: true, new: true, lean: true }
  );
  return category._id;
}

/**
 * Resolves (or creates) the "Salary & Payroll" expense category for a tenant.
 * @param {ObjectId} tenantId
 * @returns {Promise<ObjectId>} category _id
 */
async function getOrCreateSalaryCategory(tenantId) {
  const category = await ExpenseCategory.findOneAndUpdate(
    { tenantId, name: 'Salary & Payroll' },
    {
      $setOnInsert: {
        tenantId,
        name: 'Salary & Payroll',
        icon: 'Users',
        color: '#6366F1',
        isActive: true
      }
    },
    { upsert: true, new: true, lean: true }
  );
  return category._id;
}

/**
 * Computes the academic year string (e.g. "2025-2026") for a given date.
 * Academic year runs Apr–Mar.
 * @param {Date} date
 * @returns {string}
 */
function getAcademicYear(date) {
  const d = new Date(date);
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  // Apr (3) onwards = current year start; Jan-Mar = previous year start
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/**
 * Maps payment method strings from various fee modules to Income model enum values.
 * @param {string} method - raw payment method from fee/payment models
 * @returns {string} one of: Cash, Bank Transfer, UPI, Cheque, Card
 */
function normalizePaymentMethod(method) {
  if (!method) return 'Cash';
  const upper = method.toUpperCase();
  if (upper === 'CASH') return 'Cash';
  if (upper.includes('UPI')) return 'UPI';
  if (upper.includes('BANK') || upper === 'BANK_TRANSFER') return 'Bank Transfer';
  if (upper.includes('CHEQUE')) return 'Cheque';
  if (upper.includes('CARD')) return 'Card';
  if (upper === 'ONLINE') return 'Bank Transfer';
  return 'Cash';
}

/**
 * Creates an Income record for a confirmed fee payment.
 * Idempotent — skips if an Income with the same referenceId already exists.
 *
 * @param {Object} params
 * @param {ObjectId} params.tenantId
 * @param {ObjectId} params.paymentId - The Payment or PaymentAttempt _id (used as referenceId)
 * @param {number}   params.amount
 * @param {Date}     params.paymentDate
 * @param {string}   params.paymentMethod
 * @param {string}   params.studentName - For description
 * @param {string}   params.invoiceNumber - For description
 * @param {ObjectId} params.addedBy - User who collected/verified
 * @param {string}   [params.paymentReference] - Transaction/receipt reference
 * @param {string}   [params.referenceModel] - 'Payment' | 'PaymentAttempt' | 'FeePaymentOrder'
 */
async function syncFeePaymentToIncome(params) {
  try {
    const {
      tenantId, paymentId, amount, paymentDate,
      paymentMethod, studentName, invoiceNumber,
      addedBy, paymentReference, referenceModel
    } = params;

    // Idempotency: check if already synced
    const existing = await Income.findOne({
      tenantId,
      referenceType: 'fee_payment',
      referenceId: paymentId,
      isDeleted: false
    }).lean();

    if (existing) {
      logger.info(`${LOG_PREFIX} Income already exists for payment ${paymentId}, skipping`, { tenantId });
      return existing;
    }

    const categoryId = await getOrCreateFeeCollectionCategory(tenantId);

    const income = await Income.create({
      tenantId,
      category: categoryId,
      title: `Fee Payment — ${studentName || 'Student'}`,
      description: `Fee collection for invoice ${invoiceNumber || 'N/A'} from ${studentName || 'Student'}`,
      amount,
      incomeDate: paymentDate || new Date(),
      paymentMethod: normalizePaymentMethod(paymentMethod),
      paymentReference: paymentReference || undefined,
      addedBy,
      academicYear: getAcademicYear(paymentDate || new Date()),
      referenceType: 'fee_payment',
      referenceId: paymentId,
      referenceModel: referenceModel || null,
      isSystemGenerated: true
    });

    logger.info(`${LOG_PREFIX} Created income record ${income._id} for fee payment ${paymentId}`, { tenantId });
    return income;
  } catch (error) {
    // Never block the fee payment — log and move on
    logger.error(`${LOG_PREFIX} Failed to sync fee payment to income`, error, {
      paymentId: params.paymentId,
      tenantId: params.tenantId
    });
    return null;
  }
}

/**
 * Creates an Expense record for a paid payroll record.
 * Idempotent — skips if an Expense with the same referenceId already exists.
 *
 * @param {Object} params
 * @param {ObjectId} params.tenantId
 * @param {ObjectId} params.payrollId - The Payroll _id (used as referenceId)
 * @param {number}   params.netSalary - Total net salary amount
 * @param {Date}     params.paymentDate
 * @param {string}   params.paymentMethod
 * @param {number}   params.month - Payroll month (1-12)
 * @param {number}   params.year - Payroll year
 * @param {string}   params.employeeName - For description
 * @param {ObjectId} params.addedBy - Admin who marked as paid
 * @param {string}   [params.paymentReference]
 */
async function syncPayrollToExpense(params) {
  try {
    const {
      tenantId, payrollId, netSalary, paymentDate,
      paymentMethod, month, year, employeeName,
      addedBy, paymentReference
    } = params;

    // Idempotency: check if already synced
    const existing = await Expense.findOne({
      tenantId,
      referenceType: 'payroll',
      referenceId: payrollId,
      isDeleted: false
    }).lean();

    if (existing) {
      logger.info(`${LOG_PREFIX} Expense already exists for payroll ${payrollId}, skipping`, { tenantId });
      return existing;
    }

    const categoryId = await getOrCreateSalaryCategory(tenantId);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[(month || 1) - 1];

    const expense = await Expense.create({
      tenantId,
      category: categoryId,
      title: `Salary — ${employeeName || 'Employee'} (${monthName} ${year})`,
      description: `Salary disbursement for ${employeeName || 'Employee'} for ${monthName} ${year}`,
      amount: netSalary,
      expenseDate: paymentDate || new Date(),
      paymentMethod: normalizePaymentMethod(paymentMethod),
      paymentReference: paymentReference || undefined,
      addedBy,
      status: 'Approved', // Auto-created expenses are pre-approved
      approvedBy: addedBy,
      academicYear: getAcademicYear(paymentDate || new Date()),
      referenceType: 'payroll',
      referenceId: payrollId,
      referenceModel: 'Payroll',
      isSystemGenerated: true
    });

    logger.info(`${LOG_PREFIX} Created expense record ${expense._id} for payroll ${payrollId}`, { tenantId });
    return expense;
  } catch (error) {
    // Never block the payroll operation — log and move on
    logger.error(`${LOG_PREFIX} Failed to sync payroll to expense`, error, {
      payrollId: params.payrollId,
      tenantId: params.tenantId
    });
    return null;
  }
}

/**
 * Soft-deletes the Income record associated with a reversed fee payment.
 *
 * @param {ObjectId} tenantId
 * @param {ObjectId} paymentId - The original Payment _id that was reversed
 */
async function reverseFeePaymentIncome(tenantId, paymentId) {
  try {
    const result = await Income.findOneAndUpdate(
      { tenantId, referenceType: 'fee_payment', referenceId: paymentId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (result) {
      logger.info(`${LOG_PREFIX} Soft-deleted income ${result._id} for reversed payment ${paymentId}`, { tenantId });
    }
    return result;
  } catch (error) {
    logger.error(`${LOG_PREFIX} Failed to reverse income for payment ${paymentId}`, error, { tenantId });
    return null;
  }
}

/**
 * Soft-deletes the Expense record associated with a cancelled payroll.
 * TODO: Hook this in when payroll cancellation flow is implemented.
 *
 * @param {ObjectId} tenantId
 * @param {ObjectId} payrollId
 */
async function reversePayrollExpense(tenantId, payrollId) {
  try {
    const result = await Expense.findOneAndUpdate(
      { tenantId, referenceType: 'payroll', referenceId: payrollId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (result) {
      logger.info(`${LOG_PREFIX} Soft-deleted expense ${result._id} for cancelled payroll ${payrollId}`, { tenantId });
    }
    return result;
  } catch (error) {
    logger.error(`${LOG_PREFIX} Failed to reverse expense for payroll ${payrollId}`, error, { tenantId });
    return null;
  }
}

module.exports = {
  syncFeePaymentToIncome,
  syncPayrollToExpense,
  reverseFeePaymentIncome,
  reversePayrollExpense,
  // Exported for migration script
  getOrCreateFeeCollectionCategory,
  getOrCreateSalaryCategory,
  getAcademicYear,
  normalizePaymentMethod
};
