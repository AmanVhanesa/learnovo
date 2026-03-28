const {
  setupTestDB,
  createTestTenant,
  createTestUser
} = require('../testHelpers');

const Notification = require('../../models/Notification');
const NotificationPreference = require('../../models/NotificationPreference');
const notificationService = require('../../services/notificationService');

setupTestDB();

// Also clear Notification + NotificationPreference between tests
beforeEach(async() => {
  await Promise.all([
    Notification.deleteMany({}),
    NotificationPreference.deleteMany({})
  ]);
  notificationService._resetCleanupCache();
});

describe('Notification Service', () => {
  let tenant, admin, teacher;

  beforeEach(async() => {
    tenant = await createTestTenant();
    admin = await createTestUser(tenant._id, {
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'admin'
    });
    teacher = await createTestUser(tenant._id, {
      name: 'Teacher User',
      email: 'teacher@test.com',
      role: 'teacher'
    });
  });

  // ========================================================================
  // DEDUPLICATION
  // ========================================================================

  describe('Deduplication', () => {
    it('should create a notification on first call', async() => {
      const notif = await notificationService.createNotification({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'New Employee Added',
        message: 'John Doe has been added.',
        type: 'info',
        category: 'employee'
      });

      expect(notif).not.toBeNull();
      expect(notif.title).toBe('New Employee Added');
    });

    it('should NOT create a duplicate notification within 5 minutes', async() => {
      const params = {
        tenantId: tenant._id,
        userId: admin._id,
        title: 'New Employee Added',
        message: 'John Doe has been added.',
        type: 'info',
        category: 'employee'
      };

      const first = await notificationService.createNotification(params);
      const second = await notificationService.createNotification(params);

      expect(first).not.toBeNull();
      expect(second).toBeNull(); // duplicate suppressed

      const count = await Notification.countDocuments({
        tenantId: tenant._id,
        userId: admin._id,
        category: 'employee'
      });
      expect(count).toBe(1);
    });

    it('should allow different titles for the same category', async() => {
      const base = {
        tenantId: tenant._id,
        userId: admin._id,
        type: 'info',
        category: 'employee'
      };

      const first = await notificationService.createNotification({
        ...base,
        title: 'New Employee Added',
        message: 'John Doe has been added.'
      });

      const second = await notificationService.createNotification({
        ...base,
        title: 'Employee Role Changed',
        message: 'Jane role updated.'
      });

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
    });

    it('should allow same notification for different users', async() => {
      const params = {
        tenantId: tenant._id,
        title: 'System Update',
        message: 'Maintenance scheduled.',
        type: 'info',
        category: 'system'
      };

      const first = await notificationService.createNotification({
        ...params,
        userId: admin._id
      });

      const second = await notificationService.createNotification({
        ...params,
        userId: teacher._id
      });

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
    });

    it('should deduplicate within createBulkNotifications', async() => {
      // Pre-create one notification
      await notificationService.createNotification({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'New Employee Added',
        message: 'John Doe.',
        type: 'info',
        category: 'employee'
      });

      // Bulk create that includes a duplicate
      const result = await notificationService.createBulkNotifications([
        {
          tenantId: tenant._id,
          userId: admin._id,
          title: 'New Employee Added', // duplicate
          message: 'John Doe.',
          type: 'info',
          category: 'employee'
        },
        {
          tenantId: tenant._id,
          userId: teacher._id,
          title: 'New Employee Added', // not a duplicate (different user)
          message: 'John Doe.',
          type: 'info',
          category: 'employee'
        }
      ]);

      // Only the teacher's notification should be created
      expect(result).toHaveLength(1);
      expect(result[0].userId.toString()).toBe(teacher._id.toString());
    });
  });

  // ========================================================================
  // CREATE NOTIFICATION
  // ========================================================================

  describe('createNotification', () => {
    it('should respect user preferences and skip disabled categories', async() => {
      // Disable employee notifications for admin
      await NotificationPreference.create({
        tenantId: tenant._id,
        userId: admin._id,
        employee: { inApp: false, email: false, whatsapp: false }
      });

      const notif = await notificationService.createNotification({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'New Employee',
        message: 'Test',
        type: 'info',
        category: 'employee'
      });

      expect(notif).toBeNull();
    });

    it('should set channels.inApp.deliveredAt', async() => {
      const notif = await notificationService.createNotification({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'Test',
        message: 'Test message',
        type: 'info',
        category: 'system'
      });

      expect(notif.channels.inApp.enabled).toBe(true);
      expect(notif.channels.inApp.deliveredAt).toBeDefined();
    });

    it('should pass through visibility when provided', async() => {
      const notif = await notificationService.createNotification({
        tenantId: tenant._id,
        userId: teacher._id,
        title: 'Test',
        message: 'Test',
        type: 'info',
        category: 'academic',
        visibility: ['teacher', 'admin']
      });

      expect(notif.visibility).toEqual(expect.arrayContaining(['teacher', 'admin']));
    });
  });

  // ========================================================================
  // MARK AS READ
  // ========================================================================

  describe('markAsRead / markAllAsRead', () => {
    it('should mark a single notification as read', async() => {
      const notif = await notificationService.createNotification({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'Unread Test',
        message: 'Should become read.',
        type: 'info',
        category: 'system'
      });

      const updated = await notificationService.markAsRead(notif._id, admin._id, tenant._id);
      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
    });

    it('should not allow marking another user\'s notification as read', async() => {
      const notif = await notificationService.createNotification({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'Admin Only',
        message: 'Test',
        type: 'info',
        category: 'system'
      });

      await expect(
        notificationService.markAsRead(notif._id, teacher._id, tenant._id)
      ).rejects.toThrow('Notification not found');
    });

    it('should mark all notifications as read for a user', async() => {
      // Create 3 unread notifications
      for (let i = 0; i < 3; i++) {
        await Notification.create({
          tenantId: tenant._id,
          userId: admin._id,
          title: `Notif ${i}`,
          message: `Message ${i}`,
          type: 'info',
          category: 'system',
          isRead: false
        });
      }

      await notificationService.markAllAsRead(admin._id, tenant._id);

      const unread = await Notification.countDocuments({
        userId: admin._id,
        tenantId: tenant._id,
        isRead: false
      });
      expect(unread).toBe(0);
    });
  });

  // ========================================================================
  // UNREAD COUNT
  // ========================================================================

  describe('getUnreadCount', () => {
    it('should return correct unread count', async() => {
      // Create 2 unread and 1 read
      await Notification.create([
        { tenantId: tenant._id, userId: admin._id, title: 'A', message: 'a', type: 'info', category: 'system', isRead: false },
        { tenantId: tenant._id, userId: admin._id, title: 'B', message: 'b', type: 'info', category: 'system', isRead: false },
        { tenantId: tenant._id, userId: admin._id, title: 'C', message: 'c', type: 'info', category: 'system', isRead: true }
      ]);

      const count = await notificationService.getUnreadCount(admin._id, tenant._id);
      expect(count).toBe(2);
    });

    it('should not count soft-deleted notifications', async() => {
      await Notification.create({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'Deleted',
        message: 'deleted',
        type: 'info',
        category: 'system',
        isRead: false,
        isDeleted: true
      });

      const count = await notificationService.getUnreadCount(admin._id, tenant._id);
      expect(count).toBe(0);
    });

    it('should clean up stale visibility mismatches for non-admin users', async() => {
      // Create an admin-only notification targeted at the teacher user
      await Notification.create({
        tenantId: tenant._id,
        userId: teacher._id,
        title: 'Admin-Only',
        message: 'should be cleaned up',
        type: 'info',
        category: 'fee_collection', // visibility defaults to ['admin']
        isRead: false,
        isDeleted: false
      });

      const count = await notificationService.getUnreadCount(teacher._id, tenant._id);
      expect(count).toBe(0);

      // Verify it was soft-deleted
      const notif = await Notification.findOne({
        userId: teacher._id,
        title: 'Admin-Only'
      });
      expect(notif.isDeleted).toBe(true);
    });
  });

  // ========================================================================
  // SOFT DELETE
  // ========================================================================

  describe('deleteNotification', () => {
    it('should soft-delete a notification', async() => {
      const notif = await notificationService.createNotification({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'To Delete',
        message: 'Will be deleted.',
        type: 'info',
        category: 'system'
      });

      await notificationService.deleteNotification(notif._id, admin._id, tenant._id);

      const deleted = await Notification.findById(notif._id);
      expect(deleted.isDeleted).toBe(true);
      expect(deleted.deletedAt).toBeDefined();
    });

    it('should not allow deleting another user\'s notification', async() => {
      const notif = await notificationService.createNotification({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'Admin Only',
        message: 'Test',
        type: 'info',
        category: 'system'
      });

      await expect(
        notificationService.deleteNotification(notif._id, teacher._id, tenant._id)
      ).rejects.toThrow('Notification not found');
    });
  });

  // ========================================================================
  // DOMAIN-SPECIFIC NOTIFICATIONS
  // ========================================================================

  describe('notifyNewEmployee', () => {
    it('should create exactly one notification per recipient', async() => {
      const employee = await createTestUser(tenant._id, {
        name: 'New Teacher',
        email: 'newteacher@test.com',
        role: 'teacher'
      });

      await notificationService.notifyNewEmployee(employee, tenant._id);

      // Should have: 1 welcome for employee + 1 for admin
      const allNotifs = await Notification.find({ tenantId: tenant._id });
      const employeeNotifs = allNotifs.filter(n => n.userId.toString() === employee._id.toString());
      const adminNotifs = allNotifs.filter(n => n.userId.toString() === admin._id.toString());

      expect(employeeNotifs).toHaveLength(1);
      expect(employeeNotifs[0].title).toContain('Welcome');
      expect(adminNotifs).toHaveLength(1);
      expect(adminNotifs[0].title).toBe('New Employee Added');
    });

    it('should not duplicate if called twice rapidly', async() => {
      const employee = await createTestUser(tenant._id, {
        name: 'New Teacher 2',
        email: 'newteacher2@test.com',
        role: 'teacher'
      });

      // Call twice in rapid succession
      await Promise.all([
        notificationService.notifyNewEmployee(employee, tenant._id),
        notificationService.notifyNewEmployee(employee, tenant._id)
      ]);

      const employeeNotifs = await Notification.find({
        tenantId: tenant._id,
        userId: employee._id
      });

      // Should only have 1 welcome notification, not 2
      expect(employeeNotifs).toHaveLength(1);
    });
  });

  // ========================================================================
  // PAGINATION
  // ========================================================================

  describe('getNotifications', () => {
    it('should paginate results correctly', async() => {
      // Create 5 notifications
      for (let i = 0; i < 5; i++) {
        await Notification.create({
          tenantId: tenant._id,
          userId: admin._id,
          title: `Notif ${i}`,
          message: `Msg ${i}`,
          type: 'info',
          category: 'system'
        });
      }

      const page1 = await notificationService.getNotifications(admin._id, tenant._id, {
        page: 1,
        limit: 2
      });

      expect(page1.notifications).toHaveLength(2);
      expect(page1.pagination.total).toBe(5);
      expect(page1.pagination.pages).toBe(3);
    });

    it('should filter by isRead', async() => {
      await Notification.create([
        { tenantId: tenant._id, userId: admin._id, title: 'Unread', message: 'u', type: 'info', category: 'system', isRead: false },
        { tenantId: tenant._id, userId: admin._id, title: 'Read', message: 'r', type: 'info', category: 'system', isRead: true }
      ]);

      const unreadOnly = await notificationService.getNotifications(admin._id, tenant._id, {
        isRead: false
      });

      expect(unreadOnly.notifications).toHaveLength(1);
      expect(unreadOnly.notifications[0].title).toBe('Unread');
    });
  });

  // ========================================================================
  // isDuplicate (exported helper)
  // ========================================================================

  describe('isDuplicate', () => {
    it('should return false when no matching notification exists', async() => {
      const result = await notificationService.isDuplicate(
        tenant._id, admin._id, 'system', 'Nonexistent'
      );
      expect(result).toBe(false);
    });

    it('should return true when a recent matching notification exists', async() => {
      await Notification.create({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'Duplicate Check',
        message: 'test',
        type: 'info',
        category: 'system'
      });

      const result = await notificationService.isDuplicate(
        tenant._id, admin._id, 'system', 'Duplicate Check'
      );
      expect(result).toBe(true);
    });

    it('should return false for soft-deleted notifications', async() => {
      await Notification.create({
        tenantId: tenant._id,
        userId: admin._id,
        title: 'Deleted Notif',
        message: 'test',
        type: 'info',
        category: 'system',
        isDeleted: true
      });

      const result = await notificationService.isDuplicate(
        tenant._id, admin._id, 'system', 'Deleted Notif'
      );
      expect(result).toBe(false);
    });
  });
});
