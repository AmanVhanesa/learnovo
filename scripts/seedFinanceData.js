/**
 * Seed script for Income & Expense demo data
 *
 * Usage:
 *   TENANT_ID=<your-tenant-id> USER_ID=<admin-user-id> node scripts/seedFinanceData.js
 *
 * This creates:
 * - 7 income categories
 * - 8 expense categories (if not already present)
 * - 30 sample income records across the last 6 months
 * - 30 sample expense records across the last 6 months
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const Income = require('../models/Income');
const IncomeCategory = require('../models/IncomeCategory');
const Expense = require('../models/Expense');
const ExpenseCategory = require('../models/ExpenseCategory');

const TENANT_ID = process.env.TENANT_ID;
const USER_ID = process.env.USER_ID;

if (!TENANT_ID || !USER_ID) {
  console.error('Usage: TENANT_ID=<id> USER_ID=<id> node scripts/seedFinanceData.js');
  process.exit(1);
}

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

const INCOME_CATEGORIES = [
  { name: 'Fee Collection', icon: 'GraduationCap', color: '#3B82F6' },
  { name: 'Donations', icon: 'Heart', color: '#EC4899' },
  { name: 'Grants', icon: 'Award', color: '#8B5CF6' },
  { name: 'Rental Income', icon: 'Building2', color: '#F59E0B' },
  { name: 'Events', icon: 'Calendar', color: '#10B981' },
  { name: 'Interest', icon: 'TrendingUp', color: '#06B6D4' },
  { name: 'Miscellaneous', icon: 'MoreHorizontal', color: '#6B7280' }
];

const EXPENSE_CATEGORIES = [
  { name: 'Salaries', icon: 'Users', color: '#3B82F6' },
  { name: 'Infrastructure', icon: 'Building2', color: '#8B5CF6' },
  { name: 'Stationery', icon: 'Pencil', color: '#F59E0B' },
  { name: 'Transport', icon: 'Bus', color: '#10B981' },
  { name: 'Events', icon: 'Calendar', color: '#EC4899' },
  { name: 'Utilities', icon: 'Zap', color: '#F97316' },
  { name: 'Maintenance', icon: 'Wrench', color: '#6366F1' },
  { name: 'Miscellaneous', icon: 'MoreHorizontal', color: '#6B7280' }
];

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'];

function randomDate(monthsAgo) {
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const diff = now.getTime() - past.getTime();
  return new Date(past.getTime() + Math.random() * diff);
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

const INCOME_TITLES = [
  'Term 1 Fee Collection - Class 5', 'Term 2 Fee Collection - Class 8',
  'Annual Day ticket sales', 'Transport fee - Q1', 'Lab fee collection',
  'Donation from Parent Association', 'Alumni donation',
  'State education grant', 'Central govt grant disbursement',
  'Canteen rent - March', 'Auditorium rental for event',
  'Sports Day sponsorship', 'Science fair entry fees',
  'Interest on FD', 'Interest on savings account',
  'Bus fee collection - April', 'Exam fee collection',
  'Library fine collection', 'Book fair proceeds',
  'Uniform shop commission', 'Computer lab fee',
  'Swimming pool fee', 'Dance class fee',
  'Music class enrollment', 'Art supplies fee',
  'Field trip collection', 'Yearbook sales',
  'Fundraiser proceeds', 'Workshop fee',
  'Late fee penalties'
];

const EXPENSE_TITLES = [
  'Teacher salaries - March', 'Staff salaries - March',
  'Electricity bill - Q1', 'Water bill - February',
  'Internet & IT services', 'School bus diesel',
  'Sports equipment purchase', 'Science lab supplies',
  'Printer cartridges & paper', 'Whiteboard markers bulk',
  'Annual Day decorations', 'Prize distribution ceremony',
  'Building repair - washroom', 'AC maintenance contract',
  'CCTV system upgrade', 'Fire safety equipment',
  'Garden maintenance', 'Pest control service',
  'Student ID cards printing', 'Exam papers printing',
  'Teacher training workshop', 'Parent-teacher meet refreshments',
  'School furniture repair', 'Library new books purchase',
  'Computer lab upgrade', 'Software licenses renewal',
  'Transport vehicle service', 'Insurance premium',
  'Legal consultation fee', 'Audit fee'
];

async function seed() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const tenantId = new mongoose.Types.ObjectId(TENANT_ID);
  const userId = new mongoose.Types.ObjectId(USER_ID);

  // Seed income categories
  const incCats = [];
  for (const cat of INCOME_CATEGORIES) {
    const existing = await IncomeCategory.findOne({ tenantId, name: cat.name });
    if (existing) {
      incCats.push(existing);
    } else {
      const created = await IncomeCategory.create({ tenantId, ...cat });
      incCats.push(created);
    }
  }
  console.log(`Income categories: ${incCats.length} ready`);

  // Seed expense categories
  const expCats = [];
  for (const cat of EXPENSE_CATEGORIES) {
    const existing = await ExpenseCategory.findOne({ tenantId, name: cat.name });
    if (existing) {
      expCats.push(existing);
    } else {
      const created = await ExpenseCategory.create({ tenantId, ...cat });
      expCats.push(created);
    }
  }
  console.log(`Expense categories: ${expCats.length} ready`);

  // Seed income records
  const incomeRecords = [];
  for (let i = 0; i < 30; i++) {
    const date = randomDate(6);
    incomeRecords.push({
      tenantId,
      category: randomItem(incCats)._id,
      title: INCOME_TITLES[i % INCOME_TITLES.length],
      amount: randomAmount(1000, 150000),
      incomeDate: date,
      paymentMethod: randomItem(PAYMENT_METHODS),
      receivedBy: randomItem(['Mr. Sharma', 'Mrs. Gupta', 'Mr. Patel', 'Mrs. Singh', 'Office Staff']),
      addedBy: userId,
      description: `Auto-seeded income record #${i + 1}`
    });
  }
  await Income.insertMany(incomeRecords);
  console.log(`Created ${incomeRecords.length} income records`);

  // Seed expense records
  const expenseRecords = [];
  const statuses = ['Pending', 'Approved', 'Approved', 'Approved', 'Rejected'];
  for (let i = 0; i < 30; i++) {
    const date = randomDate(6);
    const status = randomItem(statuses);
    expenseRecords.push({
      tenantId,
      category: randomItem(expCats)._id,
      title: EXPENSE_TITLES[i % EXPENSE_TITLES.length],
      amount: randomAmount(500, 100000),
      expenseDate: date,
      paymentMethod: randomItem(PAYMENT_METHODS),
      addedBy: userId,
      status,
      approvedBy: status !== 'Pending' ? userId : null,
      rejectionReason: status === 'Rejected' ? 'Budget exceeded for this category' : undefined,
      description: `Auto-seeded expense record #${i + 1}`
    });
  }
  await Expense.insertMany(expenseRecords);
  console.log(`Created ${expenseRecords.length} expense records`);

  console.log('\nSeeding complete!');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
