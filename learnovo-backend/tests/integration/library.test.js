const { setupTestDB, createTestTenant, createTestUser } = require('../testHelpers');

const Book = require('../../models/Book');
const BookCopy = require('../../models/BookCopy');
const BookIssue = require('../../models/BookIssue');
const LibraryFine = require('../../models/LibraryFine');
const LibraryMember = require('../../models/LibraryMember');
const LibrarySettings = require('../../models/LibrarySettings');
const libraryService = require('../../services/libraryService');

setupTestDB();

const proSubscription = {
  subscription: {
    plan: 'pro',
    status: 'active',
    trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  }
};

describe('Library Service', () => {
  let tenant, admin, student;

  beforeEach(async() => {
    tenant = await createTestTenant(proSubscription);
    admin = await createTestUser(tenant._id, { role: 'admin', email: 'admin@lib.local.com' });
    student = await createTestUser(tenant._id, { role: 'student', email: 'stu@lib.local.com', name: 'John Stu' });

    // Clear library collections
    await Promise.all([
      Book.deleteMany({}), BookCopy.deleteMany({}), BookIssue.deleteMany({}),
      LibraryFine.deleteMany({}), LibraryMember.deleteMany({}), LibrarySettings.deleteMany({})
    ]);
  });

  test('addCopies generates accession numbers + updates book counts', async() => {
    const book = await Book.create({ tenantId: tenant._id, title: 'T', author: 'A', totalCopies: 0, availableCopies: 0, price: 100 });
    const copies = await libraryService.addCopies(tenant._id, book._id, 3);
    expect(copies).toHaveLength(3);
    copies.forEach(c => expect(c.accessionNumber).toMatch(/^ACC-\d{4}-\d{5}$/));
    const fresh = await Book.findById(book._id);
    expect(fresh.totalCopies).toBe(3);
    expect(fresh.availableCopies).toBe(3);
  });

  test('issue → return flow with no fine', async() => {
    const book = await Book.create({ tenantId: tenant._id, title: 'B', author: 'A', totalCopies: 0, availableCopies: 0 });
    await libraryService.addCopies(tenant._id, book._id, 1);

    const issue = await libraryService.issueBook({
      tenantId: tenant._id, bookId: book._id, userId: student._id, issuedBy: admin._id
    });
    expect(issue.status).toBe('issued');
    const updatedBook = await Book.findById(book._id);
    expect(updatedBook.availableCopies).toBe(0);

    const result = await libraryService.returnBook({
      tenantId: tenant._id, issueId: issue._id, returnedBy: admin._id
    });
    expect(result.issue.status).toBe('returned');
    expect(result.fine).toBeNull();
    const after = await Book.findById(book._id);
    expect(after.availableCopies).toBe(1);
  });

  test('overdue return creates fine at ₹2/day default', async() => {
    const book = await Book.create({ tenantId: tenant._id, title: 'B', author: 'A', totalCopies: 0, availableCopies: 0 });
    await libraryService.addCopies(tenant._id, book._id, 1);
    const issue = await libraryService.issueBook({
      tenantId: tenant._id, bookId: book._id, userId: student._id, issuedBy: admin._id
    });
    // Backdate dueDate by 5 days
    issue.dueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await issue.save();

    const result = await libraryService.returnBook({
      tenantId: tenant._id, issueId: issue._id, returnedBy: admin._id
    });
    expect(result.fine).not.toBeNull();
    expect(result.fine.amount).toBeGreaterThanOrEqual(10); // 5+ days × ₹2
    expect(result.fine.reason).toBe('overdue');
  });

  test('cannot issue when no copies available', async() => {
    const book = await Book.create({ tenantId: tenant._id, title: 'B', author: 'A', totalCopies: 0, availableCopies: 0 });
    await expect(libraryService.issueBook({
      tenantId: tenant._id, bookId: book._id, userId: student._id, issuedBy: admin._id
    })).rejects.toThrow(/No available copy/);
  });

  test('cannot issue when member has unpaid fines', async() => {
    const book = await Book.create({ tenantId: tenant._id, title: 'B', author: 'A', totalCopies: 0, availableCopies: 0 });
    await libraryService.addCopies(tenant._id, book._id, 2);
    const member = await libraryService.ensureMember(tenant._id, student._id);
    await LibraryFine.create({
      tenantId: tenant._id, memberId: member._id, userId: student._id,
      amount: 10, reason: 'overdue', status: 'pending'
    });
    await expect(libraryService.issueBook({
      tenantId: tenant._id, bookId: book._id, userId: student._id, issuedBy: admin._id
    })).rejects.toThrow(/unpaid fines/);
  });

  test('paying fine creates Income record', async() => {
    const Income = require('../../models/Income');
    const book = await Book.create({ tenantId: tenant._id, title: 'B', author: 'A', totalCopies: 0, availableCopies: 0 });
    await libraryService.addCopies(tenant._id, book._id, 1);
    const issue = await libraryService.issueBook({
      tenantId: tenant._id, bookId: book._id, userId: student._id, issuedBy: admin._id
    });
    issue.dueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await issue.save();
    const { fine } = await libraryService.returnBook({
      tenantId: tenant._id, issueId: issue._id, returnedBy: admin._id
    });
    expect(fine.amount).toBeGreaterThanOrEqual(6);

    const paid = await libraryService.payFine({
      tenantId: tenant._id, fineId: fine._id, paymentMethod: 'Cash', collectedBy: admin._id
    });
    expect(paid.status).toBe('paid');

    const income = await Income.findOne({ tenantId: tenant._id, referenceType: 'library_fine', referenceId: fine._id });
    expect(income).toBeTruthy();
    expect(income.amount).toBe(fine.amount);
  });

  test('member auto-enrolled with correct limit by role', async() => {
    await LibrarySettings.create({ tenantId: tenant._id, maxBooksPerStudent: 3, maxBooksPerTeacher: 5 });
    const studentMember = await libraryService.ensureMember(tenant._id, student._id);
    expect(studentMember.memberType).toBe('student');
    expect(studentMember.maxBooksAllowed).toBe(3);

    const teacher = await createTestUser(tenant._id, { role: 'teacher', email: 't@lib.local.com' });
    const teacherMember = await libraryService.ensureMember(tenant._id, teacher._id);
    expect(teacherMember.memberType).toBe('teacher');
    expect(teacherMember.maxBooksAllowed).toBe(5);
  });

  test('overdue sweep marks issued past due as overdue', async() => {
    const book = await Book.create({ tenantId: tenant._id, title: 'B', author: 'A', totalCopies: 0, availableCopies: 0 });
    await libraryService.addCopies(tenant._id, book._id, 1);
    const issue = await libraryService.issueBook({
      tenantId: tenant._id, bookId: book._id, userId: student._id, issuedBy: admin._id
    });
    issue.dueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await issue.save();

    const updated = await libraryService.markOverdue(tenant._id);
    expect(updated).toBe(1);
    const fresh = await BookIssue.findById(issue._id);
    expect(fresh.status).toBe('overdue');
  });
});
