const Circular = require('../models/Circular');
const User = require('../models/User');
const Class = require('../models/Class');
const notificationService = require('./notificationService');

/**
 * Generate a unique circular number for a tenant.
 * Format: CIR/YYYY/NNNN (e.g., CIR/2026/0001)
 */
async function generateCircularNumber(tenantId) {
  const year = new Date().getFullYear();
  const prefix = `CIR/${year}/`;
  const last = await Circular.findOne({
    tenantId,
    circularNumber: { $regex: `^${prefix}` }
  })
    .sort({ createdAt: -1 })
    .select('circularNumber')
    .lean();

  let next = 1;
  if (last && last.circularNumber) {
    const parts = last.circularNumber.split('/');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) next = lastSeq + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

async function broadcastCircularNotifications(circular) {
  const { tenantId, targetAudience, targetClasses, title, circularNumber, priority } = circular;

  const userQuery = { tenantId, isActive: true };

  if (targetAudience.includes('all')) {
    userQuery.role = { $in: ['student', 'teacher', 'parent', 'admin'] };
  } else {
    userQuery.role = { $in: targetAudience };
  }

  if (targetClasses && targetClasses.length > 0) {
    const classes = await Class.find({ _id: { $in: targetClasses } }).select('name');
    const classNames = classes.map(c => c.name);
    if (
      userQuery.role === 'student' ||
      (Array.isArray(userQuery.role.$in) && userQuery.role.$in.includes('student'))
    ) {
      userQuery.$or = [
        { classId: { $in: targetClasses } },
        { class: { $in: classNames } }
      ];
    }
  }

  const users = await User.find(userQuery).select('_id').lean();
  if (users.length === 0) return 0;

  const notificationType = priority === 'high' ? 'warning' : 'info';
  const notifTitle = `📋 Circular ${circularNumber}: ${title}`;
  const notifMeta = { circularId: circular._id, priority, circularNumber };
  const notifications = users.map(u => ({
    tenantId,
    userId: u._id,
    title: notifTitle,
    message: circular.subject,
    type: notificationType,
    category: 'announcement',
    metadata: notifMeta
  }));

  const BATCH_SIZE = 500;
  let totalCreated = 0;
  for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
    const batch = notifications.slice(i, i + BATCH_SIZE);
    const created = await notificationService.createBulkNotifications(batch);
    totalCreated += created.length;
  }
  return totalCreated;
}

async function createCircular(payload) {
  const {
    tenantId,
    createdBy,
    title,
    subject,
    body,
    category = 'general',
    priority = 'medium',
    targetAudience = ['all'],
    targetClasses = [],
    issueDate,
    signedByName = '',
    signedByDesignation = 'Principal',
    referenceNumber = ''
  } = payload;

  const circularNumber = await generateCircularNumber(tenantId);

  const circular = await Circular.create({
    tenantId,
    createdBy,
    circularNumber,
    title,
    subject,
    body,
    category,
    priority,
    targetAudience,
    targetClasses,
    issueDate: issueDate ? new Date(issueDate) : new Date(),
    signedByName,
    signedByDesignation,
    referenceNumber,
    isActive: true
  });

  // Fire-and-forget broadcast
  setImmediate(async() => {
    try {
      const count = await broadcastCircularNotifications(circular);
      await Circular.updateOne(
        { _id: circular._id },
        { $set: { notificationsSent: count, sentAt: new Date() } }
      );
    } catch (err) {
      console.error('Circular broadcast failed:', err.message);
    }
  });

  return circular;
}

async function getCirculars(tenantId, options = {}) {
  const { page = 1, limit = 20, isActive = null, category = null, search = '' } = options;

  const query = { tenantId };
  if (isActive === false) query.isActive = false;
  else query.isActive = { $ne: false };

  if (category) query.category = category;
  if (search && search.trim()) {
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { title: rx },
      { subject: rx },
      { circularNumber: rx },
      { body: rx }
    ];
  }

  const skip = (page - 1) * limit;
  const [circulars, total] = await Promise.all([
    Circular.find(query)
      .populate('createdBy', 'name role')
      .populate('targetClasses', 'name grade')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Circular.countDocuments(query)
  ]);

  return {
    circulars,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

async function getCircular(circularId, tenantId) {
  const circular = await Circular.findOne({ _id: circularId, tenantId })
    .populate('createdBy', 'name role email')
    .populate('targetClasses', 'name grade');
  if (!circular) throw new Error('Circular not found');
  return circular;
}

async function updateCircular(circularId, tenantId, updates) {
  const circular = await Circular.findOne({ _id: circularId, tenantId });
  if (!circular) throw new Error('Circular not found');
  const allowed = [
    'title', 'subject', 'body', 'category', 'priority',
    'targetAudience', 'targetClasses',
    'signedByName', 'signedByDesignation', 'referenceNumber', 'issueDate', 'isActive'
  ];
  allowed.forEach((k) => {
    if (updates[k] !== undefined) circular[k] = updates[k];
  });
  await circular.save();
  return circular;
}

async function deleteCircular(circularId, tenantId) {
  const circular = await Circular.findOne({ _id: circularId, tenantId });
  if (!circular) throw new Error('Circular not found');
  circular.isActive = false;
  await circular.save();
  return circular;
}

module.exports = {
  createCircular,
  getCirculars,
  getCircular,
  updateCircular,
  deleteCircular,
  broadcastCircularNotifications
};
