/**
 * Library Service
 *
 * Encapsulates all library business logic: book copy management,
 * issue/return flow with fine calculation, reservations, and member management.
 */

const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const BookIssue = require('../models/BookIssue');
const BookReservation = require('../models/BookReservation');
const LibraryMember = require('../models/LibraryMember');
const LibraryFine = require('../models/LibraryFine');
const LibrarySettings = require('../models/LibrarySettings');
const Counter = require('../models/Counter');
const User = require('../models/User');
const IncomeCategory = require('../models/IncomeCategory');
const Income = require('../models/Income');
const notificationService = require('./notificationService');
const { logger } = require('../middleware/errorHandler');

const notify = (params) => {
  Promise.resolve(notificationService.createNotification(params)).catch(err =>
    logger.error('[Library] notification failed', { error: err.message })
  );
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const daysBetween = (a, b) => Math.max(0, Math.ceil((a.getTime() - b.getTime()) / MS_PER_DAY));

const memberLimitFromSettings = (memberType, settings) => {
  if (memberType === 'student') return settings.maxBooksPerStudent;
  if (memberType === 'teacher') return settings.maxBooksPerTeacher;
  return settings.maxBooksPerStaff;
};

const inferMemberType = (user) => {
  if (user.role === 'student') return 'student';
  if (user.role === 'teacher' || user.role === 'principal' || user.role === 'vice_principal') return 'teacher';
  return 'staff';
};

const generateAccessionNumber = async(tenantId) => {
  const year = new Date().getFullYear().toString();
  const seq = await Counter.getNextSequence('library_accession', year, tenantId);
  return `ACC-${year}-${String(seq).padStart(5, '0')}`;
};

const generateMembershipNumber = async(tenantId) => {
  const year = new Date().getFullYear().toString();
  const seq = await Counter.getNextSequence('library_member', year, tenantId);
  return `LM-${year}-${String(seq).padStart(5, '0')}`;
};

/* ─── Members ─────────────────────────────────────────────────── */

async function ensureMember(tenantId, userId) {
  let member = await LibraryMember.findOne({ tenantId, userId });
  if (member) return member;

  const user = await User.findOne({ _id: userId, tenantId }).lean();
  if (!user) throw new Error('User not found');

  const settings = await LibrarySettings.getSettings(tenantId);
  const memberType = inferMemberType(user);
  const membershipNumber = await generateMembershipNumber(tenantId);

  member = await LibraryMember.create({
    tenantId,
    userId,
    membershipNumber,
    memberType,
    maxBooksAllowed: memberLimitFromSettings(memberType, settings)
  });
  return member;
}

/* ─── Book copies ─────────────────────────────────────────────── */

async function addCopies(tenantId, bookId, count, copyData = {}) {
  const book = await Book.findOne({ _id: bookId, tenantId });
  if (!book) throw new Error('Book not found');

  const created = [];
  for (let i = 0; i < count; i++) {
    const accessionNumber = await generateAccessionNumber(tenantId);
    const copy = await BookCopy.create({
      tenantId,
      bookId,
      accessionNumber,
      condition: copyData.condition || 'new',
      price: copyData.price || book.price || 0,
      status: 'available'
    });
    created.push(copy);
  }

  book.totalCopies += count;
  book.availableCopies += count;
  await book.save();

  return created;
}

async function recountBook(bookId, tenantId) {
  const [total, available] = await Promise.all([
    BookCopy.countDocuments({ tenantId, bookId, status: { $ne: 'retired' } }),
    BookCopy.countDocuments({ tenantId, bookId, status: 'available' })
  ]);
  await Book.updateOne({ _id: bookId, tenantId }, { totalCopies: total, availableCopies: available });
}

/* ─── Issue / Return ──────────────────────────────────────────── */

async function issueBook({ tenantId, bookId, copyId, userId, issuedBy, dueDateOverride }) {
  const settings = await LibrarySettings.getSettings(tenantId);
  const member = await ensureMember(tenantId, userId);

  if (member.status !== 'active') {
    throw Object.assign(new Error('Member is not active'), { status: 400 });
  }
  if (member.currentBooksIssued >= member.maxBooksAllowed) {
    throw Object.assign(new Error(`Member has reached max book limit (${member.maxBooksAllowed})`), { status: 400 });
  }

  // Check unpaid fines
  const unpaid = await LibraryFine.countDocuments({ tenantId, memberId: member._id, status: 'pending' });
  if (unpaid > 0) {
    throw Object.assign(new Error('Member has unpaid fines. Clear them before issuing a new book.'), { status: 400 });
  }

  // Pick copy
  let copy;
  if (copyId) {
    copy = await BookCopy.findOne({ _id: copyId, tenantId, bookId, status: 'available' });
  } else {
    copy = await BookCopy.findOne({ tenantId, bookId, status: 'available' });
  }
  if (!copy) throw Object.assign(new Error('No available copy of this book'), { status: 400 });

  // Atomic claim
  const claimed = await BookCopy.findOneAndUpdate(
    { _id: copy._id, status: 'available' },
    { status: 'issued' },
    { new: true }
  );
  if (!claimed) throw Object.assign(new Error('Copy was just issued to someone else'), { status: 409 });

  const issueDate = new Date();
  const dueDate = dueDateOverride
    ? new Date(dueDateOverride)
    : new Date(issueDate.getTime() + settings.maxIssuePeriodDays * MS_PER_DAY);

  const issue = await BookIssue.create({
    tenantId,
    bookId,
    copyId: claimed._id,
    memberId: member._id,
    userId,
    issueDate,
    dueDate,
    status: 'issued',
    issuedBy
  });

  member.currentBooksIssued += 1;
  member.totalBooksIssued += 1;
  await member.save();

  await Book.updateOne({ _id: bookId, tenantId }, { $inc: { availableCopies: -1 } });

  // Fulfill any active reservation for this user for this book
  await BookReservation.updateOne(
    { tenantId, bookId, memberId: member._id, status: 'active' },
    { status: 'fulfilled', fulfilledAt: new Date() }
  );

  const book = await Book.findById(bookId).select('title').lean();
  notify({
    tenantId, userId, category: 'library', type: 'info',
    title: 'Book Issued',
    message: `"${book?.title || 'A book'}" has been issued to you. Due on ${dueDate.toDateString()}.`,
    actionUrl: '/app/library/my', actionLabel: 'View'
  });

  return issue;
}

async function returnBook({ tenantId, issueId, returnedBy, condition = 'good', markLost = false }) {
  const issue = await BookIssue.findOne({ _id: issueId, tenantId, status: { $in: ['issued', 'overdue'] } });
  if (!issue) throw Object.assign(new Error('Active issue not found'), { status: 404 });

  const settings = await LibrarySettings.getSettings(tenantId);
  const returnDate = new Date();
  const overdueDays = daysBetween(returnDate, issue.dueDate);
  const fineAmount = markLost
    ? 0 // lost fine handled separately by price
    : overdueDays * settings.finePerDay;

  issue.returnDate = returnDate;
  issue.returnedBy = returnedBy;
  issue.fineAmount = fineAmount;
  issue.status = markLost ? 'lost' : 'returned';
  await issue.save();

  // Update copy
  const newCopyStatus = markLost ? 'lost' : (condition === 'damaged' ? 'damaged' : 'available');
  await BookCopy.updateOne(
    { _id: issue.copyId, tenantId },
    { status: newCopyStatus, condition }
  );

  // Update book counts
  if (!markLost && condition !== 'damaged') {
    await Book.updateOne({ _id: issue.bookId, tenantId }, { $inc: { availableCopies: 1 } });
  } else {
    await recountBook(issue.bookId, tenantId);
  }

  // Update member
  await LibraryMember.updateOne(
    { _id: issue.memberId, tenantId },
    { $inc: { currentBooksIssued: -1 } }
  );

  // Create fine
  let fine = null;
  if (fineAmount > 0) {
    fine = await LibraryFine.create({
      tenantId,
      memberId: issue.memberId,
      userId: issue.userId,
      issueId: issue._id,
      bookId: issue.bookId,
      amount: fineAmount,
      reason: 'overdue',
      description: `${overdueDays} day(s) overdue at ₹${settings.finePerDay}/day`,
      status: 'pending'
    });
  }

  if (markLost) {
    const bookDoc = await Book.findById(issue.bookId).lean();
    const lostAmount = bookDoc?.price || 0;
    if (lostAmount > 0) {
      fine = await LibraryFine.create({
        tenantId,
        memberId: issue.memberId,
        userId: issue.userId,
        issueId: issue._id,
        bookId: issue.bookId,
        amount: lostAmount,
        reason: 'lost',
        description: `Book reported lost — replacement cost ₹${lostAmount}`,
        status: 'pending'
      });
    }
  }

  const book = await Book.findById(issue.bookId).select('title').lean();
  notify({
    tenantId, userId: issue.userId, category: 'library', type: fineAmount > 0 ? 'warning' : 'success',
    title: markLost ? 'Book Marked Lost' : 'Book Returned',
    message: fineAmount > 0
      ? `"${book?.title || 'Book'}" returned. Overdue fine: ₹${fineAmount}.`
      : `"${book?.title || 'Book'}" returned successfully. Thank you!`,
    actionUrl: '/app/library/my', actionLabel: 'View'
  });

  // Notify next reservation in queue
  const nextRes = await BookReservation.findOne({
    tenantId, bookId: issue.bookId, status: 'active'
  }).sort({ reservedAt: 1 });
  if (nextRes) {
    notify({
      tenantId, userId: nextRes.userId, category: 'library', type: 'info',
      title: 'Reserved Book Available',
      message: `"${book?.title || 'A book'}" you reserved is now available. Visit the library to collect it.`,
      actionUrl: '/app/library/my', actionLabel: 'View'
    });
  }

  return { issue, fine };
}

async function renewIssue({ tenantId, issueId }) {
  const settings = await LibrarySettings.getSettings(tenantId);
  const issue = await BookIssue.findOne({ _id: issueId, tenantId, status: 'issued' });
  if (!issue) throw Object.assign(new Error('Active issue not found'), { status: 404 });
  if (issue.renewalCount >= settings.maxRenewalsAllowed) {
    throw Object.assign(new Error('Max renewals reached'), { status: 400 });
  }

  // Block renewal if reservation queue exists
  const reserved = await BookReservation.countDocuments({
    tenantId, bookId: issue.bookId, status: 'active'
  });
  if (reserved > 0) {
    throw Object.assign(new Error('Cannot renew — book is reserved by another member'), { status: 400 });
  }

  issue.dueDate = new Date(issue.dueDate.getTime() + settings.maxIssuePeriodDays * MS_PER_DAY);
  issue.renewalCount += 1;
  issue.lastRenewedAt = new Date();
  await issue.save();
  return issue;
}

/* ─── Fines ───────────────────────────────────────────────────── */

async function getOrCreateLibraryFineCategory(tenantId) {
  const cat = await IncomeCategory.findOneAndUpdate(
    { tenantId, name: 'Library Fines' },
    { $setOnInsert: { tenantId, name: 'Library Fines', icon: 'BookOpen', color: '#10B981', isActive: true } },
    { upsert: true, new: true, lean: true }
  );
  return cat._id;
}

async function payFine({ tenantId, fineId, paymentMethod = 'Cash', collectedBy, paymentReference }) {
  const fine = await LibraryFine.findOne({ _id: fineId, tenantId, status: 'pending' });
  if (!fine) throw Object.assign(new Error('Pending fine not found'), { status: 404 });

  const settings = await LibrarySettings.getSettings(tenantId);

  fine.status = 'paid';
  fine.paidAt = new Date();
  fine.paidAmount = fine.amount;
  fine.collectedBy = collectedBy;
  await fine.save();

  // Mark linked issue as fine paid
  if (fine.issueId) {
    await BookIssue.updateOne({ _id: fine.issueId, tenantId }, { finePaid: true });
  }

  await LibraryMember.updateOne(
    { _id: fine.memberId, tenantId },
    { $inc: { totalFinesPaid: fine.amount } }
  );

  // Auto-sync to Income
  if (settings.autoSyncFinesToIncome) {
    try {
      const user = await User.findById(fine.userId).select('name firstName lastName').lean();
      const memberName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Member';
      const categoryId = await getOrCreateLibraryFineCategory(tenantId);
      const income = await Income.create({
        tenantId,
        category: categoryId,
        title: `Library Fine — ${memberName}`,
        description: fine.description || `Library ${fine.reason} fine`,
        amount: fine.amount,
        incomeDate: fine.paidAt,
        paymentMethod,
        paymentReference,
        addedBy: collectedBy,
        referenceType: 'library_fine',
        referenceId: fine._id,
        referenceModel: 'LibraryFine',
        isSystemGenerated: true
      });
      fine.incomeRecordId = income._id;
      await fine.save();
    } catch (err) {
      logger.error('[Library] Failed to sync fine to income', { fineId: fine._id, error: err.message });
    }
  }

  notify({
    tenantId, userId: fine.userId, category: 'library', type: 'success',
    title: 'Fine Paid', message: `Library fine of ₹${fine.amount} has been collected. Thank you!`
  });

  return fine;
}

async function waiveFine({ tenantId, fineId, waivedBy, reason }) {
  const fine = await LibraryFine.findOne({ _id: fineId, tenantId, status: 'pending' });
  if (!fine) throw Object.assign(new Error('Pending fine not found'), { status: 404 });
  fine.status = 'waived';
  fine.waivedAt = new Date();
  fine.waivedBy = waivedBy;
  fine.waiveReason = reason || '';
  await fine.save();

  if (fine.issueId) {
    await BookIssue.updateOne({ _id: fine.issueId, tenantId }, { finePaid: true });
  }

  notify({
    tenantId, userId: fine.userId, category: 'library', type: 'info',
    title: 'Fine Waived', message: `Your library fine of ₹${fine.amount} has been waived.`
  });

  return fine;
}

/* ─── Reservations ────────────────────────────────────────────── */

async function createReservation({ tenantId, bookId, userId, notes }) {
  const settings = await LibrarySettings.getSettings(tenantId);
  const member = await ensureMember(tenantId, userId);

  const existing = await BookReservation.findOne({
    tenantId, bookId, memberId: member._id, status: 'active'
  });
  if (existing) throw Object.assign(new Error('You already have an active reservation for this book'), { status: 400 });

  const expiresAt = new Date(Date.now() + settings.reservationExpiryDays * MS_PER_DAY);
  return BookReservation.create({
    tenantId, bookId, memberId: member._id, userId, expiresAt, notes: notes || ''
  });
}

async function cancelReservation({ tenantId, reservationId, userId, isAdmin }) {
  const filter = { _id: reservationId, tenantId, status: 'active' };
  if (!isAdmin) filter.userId = userId;
  const reservation = await BookReservation.findOne(filter);
  if (!reservation) throw Object.assign(new Error('Active reservation not found'), { status: 404 });
  reservation.status = 'cancelled';
  reservation.cancelledAt = new Date();
  await reservation.save();
  return reservation;
}

/* ─── Overdue sweep ───────────────────────────────────────────── */

async function markOverdue(tenantId = null) {
  const filter = { status: 'issued', dueDate: { $lt: new Date() } };
  if (tenantId) filter.tenantId = tenantId;
  const result = await BookIssue.updateMany(filter, { status: 'overdue' });
  return result.modifiedCount;
}

async function expireReservations(tenantId = null) {
  const filter = { status: 'active', expiresAt: { $lt: new Date() } };
  if (tenantId) filter.tenantId = tenantId;
  const result = await BookReservation.updateMany(filter, { status: 'expired' });
  return result.modifiedCount;
}

/* ─── Stats ───────────────────────────────────────────────────── */

async function getDashboardStats(tenantId) {
  const [totalBooks, totalCopies, issuedToday, currentlyIssued, overdue, pendingFines, totalMembers] = await Promise.all([
    Book.countDocuments({ tenantId, isActive: true }),
    BookCopy.countDocuments({ tenantId, status: { $ne: 'retired' } }),
    BookIssue.countDocuments({
      tenantId,
      issueDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    }),
    BookIssue.countDocuments({ tenantId, status: { $in: ['issued', 'overdue'] } }),
    BookIssue.countDocuments({ tenantId, status: 'overdue' }),
    LibraryFine.aggregate([
      { $match: { tenantId: require('mongoose').Types.ObjectId.isValid(tenantId) ? new (require('mongoose').Types.ObjectId)(tenantId) : tenantId, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    LibraryMember.countDocuments({ tenantId, status: 'active' })
  ]);

  return {
    totalBooks,
    totalCopies,
    issuedToday,
    currentlyIssued,
    overdue,
    pendingFinesAmount: pendingFines[0]?.total || 0,
    pendingFinesCount: pendingFines[0]?.count || 0,
    totalMembers
  };
}

module.exports = {
  ensureMember,
  addCopies,
  recountBook,
  issueBook,
  returnBook,
  renewIssue,
  payFine,
  waiveFine,
  createReservation,
  cancelReservation,
  markOverdue,
  expireReservations,
  getDashboardStats
};
