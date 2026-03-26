const mongoose = require('mongoose');

/**
 * Ensure critical compound indexes exist on startup.
 *
 * Mongoose creates indexes declared in schemas automatically when
 * autoIndex is true, but in production we set autoIndex: false for
 * faster boot.  This module explicitly creates the indexes we need.
 *
 * Call once after Mongoose connects: require('./utils/indexes').ensureIndexes()
 */

async function ensureIndexes() {
  const start = Date.now();

  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.warn('[indexes] No DB connection yet – skipping index creation');
      return;
    }

    // ── Users (students, employees, admins) ────────────────────────
    const users = db.collection('users');
    await Promise.all([
      users.createIndex({ tenantId: 1, role: 1, isActive: 1 },      { background: true, name: 'idx_tenant_role_active' }),
      users.createIndex({ tenantId: 1, email: 1 },                   { background: true, name: 'idx_tenant_email', sparse: true }),
      users.createIndex({ tenantId: 1, admissionNumber: 1 },         { background: true, name: 'idx_tenant_admNo', sparse: true }),
      users.createIndex({ tenantId: 1, class: 1, section: 1 },       { background: true, name: 'idx_tenant_class_section', sparse: true }),
      users.createIndex({ tenantId: 1, createdAt: -1 },              { background: true, name: 'idx_tenant_created' }),
      users.createIndex({ tenantId: 1, rollNumber: 1 },              { background: true, name: 'idx_tenant_rollNo', sparse: true }),
      users.createIndex({ tenantId: 1, employeeId: 1 },              { background: true, name: 'idx_tenant_empId', sparse: true }),
    ]);

    // ── Fees ───────────────────────────────────────────────────────
    const fees = db.collection('fees');
    await Promise.all([
      fees.createIndex({ tenantId: 1, studentId: 1 },                { background: true, name: 'idx_fee_tenant_student' }),
      fees.createIndex({ tenantId: 1, status: 1 },                   { background: true, name: 'idx_fee_tenant_status' }),
      fees.createIndex({ tenantId: 1, createdAt: -1 },               { background: true, name: 'idx_fee_tenant_created' }),
    ]);

    // ── Attendance ─────────────────────────────────────────────────
    const attendance = db.collection('attendances');
    await Promise.all([
      attendance.createIndex({ tenantId: 1, date: 1, classId: 1 },   { background: true, name: 'idx_att_tenant_date_class' }),
      attendance.createIndex({ tenantId: 1, studentId: 1, date: 1 }, { background: true, name: 'idx_att_tenant_student_date' }),
    ]);

    // ── Tenants ────────────────────────────────────────────────────
    const tenants = db.collection('tenants');
    await Promise.all([
      tenants.createIndex({ schoolCode: 1 },  { background: true, unique: true, name: 'idx_tenant_code' }),
      tenants.createIndex({ subdomain: 1 },   { background: true, sparse: true, name: 'idx_tenant_subdomain' }),
    ]);

    // ── Notifications ──────────────────────────────────────────────
    const notifications = db.collection('notifications');
    await Promise.all([
      notifications.createIndex({ tenantId: 1, userId: 1, isRead: 1 }, { background: true, name: 'idx_notif_tenant_user_read' }),
    ]);

    // ── Classes & Sections ─────────────────────────────────────────
    const classes = db.collection('classes');
    await classes.createIndex({ tenantId: 1, isActive: 1 }, { background: true, name: 'idx_class_tenant_active' });

    const sections = db.collection('sections');
    await sections.createIndex({ tenantId: 1, classId: 1, isActive: 1 }, { background: true, name: 'idx_section_tenant_class_active' });

    // ── Generated Certificates ─────────────────────────────────────
    const certs = db.collection('generatedcertificates');
    await certs.createIndex({ tenantId: 1, studentId: 1, type: 1 }, { background: true, name: 'idx_cert_tenant_student_type' });

    console.log(`[indexes] All indexes ensured in ${Date.now() - start}ms`);
  } catch (err) {
    // Non-fatal — the app still works, just slower queries
    console.error('[indexes] Error creating indexes:', err.message);
  }
}

module.exports = { ensureIndexes };
