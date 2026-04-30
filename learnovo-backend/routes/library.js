const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const planGate = require('../middleware/planGate');

const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const BookCategory = require('../models/BookCategory');
const BookIssue = require('../models/BookIssue');
const BookReservation = require('../models/BookReservation');
const LibraryMember = require('../models/LibraryMember');
const LibraryFine = require('../models/LibraryFine');
const LibrarySettings = require('../models/LibrarySettings');

const libraryService = require('../services/libraryService');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const requireLibrary = planGate.requireFeature('library');
const STAFF_ROLES = ['admin', 'librarian', 'principal', 'vice_principal'];

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ─── Settings ────────────────────────────────────────────────── */

router.get('/settings', protect, requireLibrary, wrap(async(req, res) => {
  const settings = await LibrarySettings.getSettings(req.user.tenantId);
  res.json({ success: true, data: settings, requestId: req.requestId });
}));

router.put('/settings', protect, requireLibrary, authorize('admin'), wrap(async(req, res) => {
  const allowed = [
    'finePerDay', 'maxIssuePeriodDays', 'maxRenewalsAllowed',
    'maxBooksPerStudent', 'maxBooksPerTeacher', 'maxBooksPerStaff',
    'reservationExpiryDays', 'allowSelfReservation',
    'sendDueReminders', 'reminderDaysBeforeDue',
    'autoSyncFinesToIncome', 'libraryName'
  ];
  const update = {};
  for (const k of allowed) if (k in req.body) update[k] = req.body[k];

  const settings = await LibrarySettings.findOneAndUpdate(
    { tenantId: req.user.tenantId },
    { $set: update },
    { new: true, upsert: true }
  );
  res.json({ success: true, data: settings, requestId: req.requestId });
}));

/* ─── Dashboard ───────────────────────────────────────────────── */

router.get('/dashboard', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const stats = await libraryService.getDashboardStats(req.user.tenantId);
  const recentIssues = await BookIssue.find({ tenantId: req.user.tenantId })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('bookId', 'title author')
    .populate('userId', 'name firstName lastName')
    .lean();
  res.json({ success: true, data: { stats, recentIssues }, requestId: req.requestId });
}));

/* ─── Categories ──────────────────────────────────────────────── */

router.get('/categories', protect, requireLibrary, wrap(async(req, res) => {
  const categories = await BookCategory.find({ tenantId: req.user.tenantId, isActive: true })
    .sort({ name: 1 }).lean();
  res.json({ success: true, data: categories, requestId: req.requestId });
}));

router.post('/categories', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
  const category = await BookCategory.create({
    tenantId: req.user.tenantId,
    name: name.trim(),
    description: description?.trim() || ''
  });
  res.status(201).json({ success: true, data: category, requestId: req.requestId });
}));

router.put('/categories/:id', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const cat = await BookCategory.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user.tenantId },
    { $set: req.body },
    { new: true }
  );
  if (!cat) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: cat, requestId: req.requestId });
}));

router.delete('/categories/:id', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const inUse = await Book.countDocuments({ tenantId: req.user.tenantId, category: req.params.id });
  if (inUse > 0) return res.status(409).json({ success: false, message: `Category in use by ${inUse} book(s)` });
  await BookCategory.deleteOne({ _id: req.params.id, tenantId: req.user.tenantId });
  res.json({ success: true, message: 'Deleted', requestId: req.requestId });
}));

/* ─── Books ───────────────────────────────────────────────────── */

router.get('/books', protect, requireLibrary, wrap(async(req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { search, category, available } = req.query;

  const filter = { tenantId: req.user.tenantId, isActive: true };
  if (category) filter.category = category;
  if (available === 'true') filter.availableCopies = { $gt: 0 };
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { author: { $regex: search, $options: 'i' } },
      { isbn: { $regex: search, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    Book.find(filter).sort({ title: 1 }).skip(skip).limit(limit)
      .populate('category', 'name').populate('subject', 'name').lean(),
    Book.countDocuments(filter)
  ]);
  res.json(paginatedResponse(items, total, page, limit, req.requestId));
}));

router.get('/books/:id', protect, requireLibrary, wrap(async(req, res) => {
  const book = await Book.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
    .populate('category', 'name').populate('subject', 'name').lean();
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

  const [copies, activeIssues, reservations] = await Promise.all([
    BookCopy.find({ tenantId: req.user.tenantId, bookId: book._id }).sort({ accessionNumber: 1 }).lean(),
    BookIssue.find({ tenantId: req.user.tenantId, bookId: book._id, status: { $in: ['issued', 'overdue'] } })
      .populate('userId', 'name firstName lastName').lean(),
    BookReservation.find({ tenantId: req.user.tenantId, bookId: book._id, status: 'active' })
      .populate('userId', 'name firstName lastName').lean()
  ]);

  res.json({ success: true, data: { book, copies, activeIssues, reservations }, requestId: req.requestId });
}));

router.post('/books', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { title, author, copies = 0, ...rest } = req.body;
  if (!title?.trim() || !author?.trim()) {
    return res.status(400).json({ success: false, message: 'Title and author are required' });
  }
  const book = await Book.create({
    tenantId: req.user.tenantId,
    title: title.trim(),
    author: author.trim(),
    ...rest,
    totalCopies: 0,
    availableCopies: 0
  });
  if (copies > 0) await libraryService.addCopies(req.user.tenantId, book._id, parseInt(copies, 10));
  const fresh = await Book.findById(book._id).lean();
  res.status(201).json({ success: true, data: fresh, requestId: req.requestId });
}));

router.put('/books/:id', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { totalCopies: _t, availableCopies: _a, ...update } = req.body;
  const book = await Book.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user.tenantId },
    { $set: update },
    { new: true }
  );
  if (!book) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: book, requestId: req.requestId });
}));

router.delete('/books/:id', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const active = await BookIssue.countDocuments({
    tenantId: req.user.tenantId, bookId: req.params.id, status: { $in: ['issued', 'overdue'] }
  });
  if (active > 0) return res.status(409).json({ success: false, message: `Book has ${active} active issue(s)` });
  await Book.updateOne({ _id: req.params.id, tenantId: req.user.tenantId }, { isActive: false });
  res.json({ success: true, message: 'Book archived', requestId: req.requestId });
}));

/* ─── Copies ──────────────────────────────────────────────────── */

router.post('/books/:id/copies', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { count = 1, condition, price } = req.body;
  const created = await libraryService.addCopies(req.user.tenantId, req.params.id, parseInt(count, 10), { condition, price });
  res.status(201).json({ success: true, data: created, requestId: req.requestId });
}));

router.put('/copies/:id', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { condition, status, remarks, price } = req.body;
  const copy = await BookCopy.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user.tenantId },
    { $set: { ...(condition && { condition }), ...(status && { status }), ...(remarks !== undefined && { remarks }), ...(price !== undefined && { price }) } },
    { new: true }
  );
  if (!copy) return res.status(404).json({ success: false, message: 'Not found' });
  await libraryService.recountBook(copy.bookId, req.user.tenantId);
  res.json({ success: true, data: copy, requestId: req.requestId });
}));

router.delete('/copies/:id', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const copy = await BookCopy.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!copy) return res.status(404).json({ success: false, message: 'Not found' });
  if (copy.status === 'issued') return res.status(409).json({ success: false, message: 'Copy is currently issued' });
  copy.status = 'retired';
  await copy.save();
  await libraryService.recountBook(copy.bookId, req.user.tenantId);
  res.json({ success: true, message: 'Copy retired', requestId: req.requestId });
}));

/* ─── Members ─────────────────────────────────────────────────── */

router.get('/members', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { search } = req.query;

  const userFilter = { tenantId: req.user.tenantId, isActive: true };
  if (search) {
    userFilter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { admissionNumber: { $regex: search, $options: 'i' } }
    ];
  }
  const [members, total] = await Promise.all([
    LibraryMember.find({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate({ path: 'userId', match: userFilter, select: 'name firstName lastName email role admissionNumber employeeId' })
      .lean(),
    LibraryMember.countDocuments({ tenantId: req.user.tenantId })
  ]);
  const filtered = members.filter(m => m.userId);
  res.json(paginatedResponse(filtered, total, page, limit, req.requestId));
}));

router.post('/members/enroll', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { userId } = req.body;
  const member = await libraryService.ensureMember(req.user.tenantId, userId);
  res.status(201).json({ success: true, data: member, requestId: req.requestId });
}));

router.put('/members/:id', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { maxBooksAllowed, status, expiryDate } = req.body;
  const member = await LibraryMember.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user.tenantId },
    { $set: {
      ...(maxBooksAllowed !== undefined && { maxBooksAllowed }),
      ...(status && { status }),
      ...(expiryDate && { expiryDate })
    } },
    { new: true }
  );
  if (!member) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: member, requestId: req.requestId });
}));

router.get('/members/me', protect, requireLibrary, wrap(async(req, res) => {
  const member = await libraryService.ensureMember(req.user.tenantId, req.user._id);
  const [activeIssues, history, fines] = await Promise.all([
    BookIssue.find({ tenantId: req.user.tenantId, memberId: member._id, status: { $in: ['issued', 'overdue'] } })
      .populate('bookId', 'title author coverImage').lean(),
    BookIssue.find({ tenantId: req.user.tenantId, memberId: member._id, status: { $in: ['returned', 'lost'] } })
      .sort({ returnDate: -1 }).limit(20).populate('bookId', 'title author').lean(),
    LibraryFine.find({ tenantId: req.user.tenantId, memberId: member._id, status: 'pending' })
      .populate('bookId', 'title').lean()
  ]);
  res.json({ success: true, data: { member, activeIssues, history, fines }, requestId: req.requestId });
}));

/* ─── Issues ──────────────────────────────────────────────────── */

router.get('/issues', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, memberId, bookId } = req.query;
  const filter = { tenantId: req.user.tenantId };
  if (status) filter.status = status;
  if (memberId) filter.memberId = memberId;
  if (bookId) filter.bookId = bookId;

  const [items, total] = await Promise.all([
    BookIssue.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('bookId', 'title author isbn')
      .populate('userId', 'name firstName lastName email admissionNumber role')
      .populate('copyId', 'accessionNumber')
      .lean(),
    BookIssue.countDocuments(filter)
  ]);
  res.json(paginatedResponse(items, total, page, limit, req.requestId));
}));

router.post('/issues', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { bookId, copyId, userId, dueDate } = req.body;
  if (!bookId || !userId) return res.status(400).json({ success: false, message: 'bookId and userId are required' });
  try {
    const issue = await libraryService.issueBook({
      tenantId: req.user.tenantId,
      bookId, copyId, userId,
      issuedBy: req.user._id,
      dueDateOverride: dueDate
    });
    res.status(201).json({ success: true, data: issue, requestId: req.requestId });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, requestId: req.requestId });
  }
}));

router.post('/issues/:id/return', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { condition, markLost } = req.body;
  try {
    const result = await libraryService.returnBook({
      tenantId: req.user.tenantId,
      issueId: req.params.id,
      returnedBy: req.user._id,
      condition,
      markLost: !!markLost
    });
    res.json({ success: true, data: result, requestId: req.requestId });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, requestId: req.requestId });
  }
}));

router.post('/issues/:id/renew', protect, requireLibrary, wrap(async(req, res) => {
  const issue = await BookIssue.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!issue) return res.status(404).json({ success: false, message: 'Not found' });
  // Member can self-renew their own; staff can renew anyone
  if (!STAFF_ROLES.includes(req.user.role) && String(issue.userId) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  try {
    const renewed = await libraryService.renewIssue({ tenantId: req.user.tenantId, issueId: req.params.id });
    res.json({ success: true, data: renewed, requestId: req.requestId });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, requestId: req.requestId });
  }
}));

router.post('/issues/sweep-overdue', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const updated = await libraryService.markOverdue(req.user.tenantId);
  res.json({ success: true, data: { updated }, requestId: req.requestId });
}));

/* ─── Reservations ────────────────────────────────────────────── */

router.get('/reservations', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { status = 'active' } = req.query;
  const items = await BookReservation.find({ tenantId: req.user.tenantId, status })
    .sort({ reservedAt: -1 })
    .populate('bookId', 'title author')
    .populate('userId', 'name firstName lastName')
    .lean();
  res.json({ success: true, data: items, requestId: req.requestId });
}));

router.post('/reservations', protect, requireLibrary, wrap(async(req, res) => {
  const { bookId, userId, notes } = req.body;
  const settings = await LibrarySettings.getSettings(req.user.tenantId);
  const isStaff = STAFF_ROLES.includes(req.user.role);
  if (!isStaff && !settings.allowSelfReservation) {
    return res.status(403).json({ success: false, message: 'Self-reservation is disabled' });
  }
  const targetUserId = isStaff && userId ? userId : req.user._id;
  try {
    const r = await libraryService.createReservation({
      tenantId: req.user.tenantId, bookId, userId: targetUserId, notes
    });
    res.status(201).json({ success: true, data: r, requestId: req.requestId });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, requestId: req.requestId });
  }
}));

router.delete('/reservations/:id', protect, requireLibrary, wrap(async(req, res) => {
  try {
    const r = await libraryService.cancelReservation({
      tenantId: req.user.tenantId,
      reservationId: req.params.id,
      userId: req.user._id,
      isAdmin: STAFF_ROLES.includes(req.user.role)
    });
    res.json({ success: true, data: r, requestId: req.requestId });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, requestId: req.requestId });
  }
}));

/* ─── Fines ───────────────────────────────────────────────────── */

router.get('/fines', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status = 'pending', memberId } = req.query;
  const filter = { tenantId: req.user.tenantId, status };
  if (memberId) filter.memberId = memberId;
  const [items, total] = await Promise.all([
    LibraryFine.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('bookId', 'title author')
      .populate('userId', 'name firstName lastName email admissionNumber')
      .lean(),
    LibraryFine.countDocuments(filter)
  ]);
  res.json(paginatedResponse(items, total, page, limit, req.requestId));
}));

router.post('/fines/:id/pay', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const { paymentMethod, paymentReference } = req.body;
  try {
    const fine = await libraryService.payFine({
      tenantId: req.user.tenantId,
      fineId: req.params.id,
      paymentMethod,
      paymentReference,
      collectedBy: req.user._id
    });
    res.json({ success: true, data: fine, requestId: req.requestId });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, requestId: req.requestId });
  }
}));

router.post('/fines/:id/waive', protect, requireLibrary, authorize('admin', 'librarian'), wrap(async(req, res) => {
  const { reason } = req.body;
  try {
    const fine = await libraryService.waiveFine({
      tenantId: req.user.tenantId,
      fineId: req.params.id,
      waivedBy: req.user._id,
      reason
    });
    res.json({ success: true, data: fine, requestId: req.requestId });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, requestId: req.requestId });
  }
}));

/* ─── Reports ─────────────────────────────────────────────────── */

router.get('/reports/most-issued', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const data = await BookIssue.aggregate([
    { $match: { tenantId: req.user.tenantId } },
    { $group: { _id: '$bookId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
    { $unwind: '$book' },
    { $project: { _id: 0, bookId: '$_id', count: 1, title: '$book.title', author: '$book.author' } }
  ]);
  res.json({ success: true, data, requestId: req.requestId });
}));

router.get('/reports/defaulters', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const items = await BookIssue.find({ tenantId: req.user.tenantId, status: 'overdue' })
    .sort({ dueDate: 1 })
    .populate('bookId', 'title author')
    .populate('userId', 'name firstName lastName email phone admissionNumber')
    .lean();
  res.json({ success: true, data: items, requestId: req.requestId });
}));

router.get('/reports/inventory-value', protect, requireLibrary, authorize(...STAFF_ROLES), wrap(async(req, res) => {
  const result = await BookCopy.aggregate([
    { $match: { tenantId: req.user.tenantId, status: { $ne: 'retired' } } },
    { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$price' } } }
  ]);
  res.json({ success: true, data: result, requestId: req.requestId });
}));

module.exports = router;
