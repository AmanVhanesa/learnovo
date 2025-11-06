const mongoose = require('mongoose');
const { logger } = require('../middleware/errorHandler');

class MigrationManager {
  constructor() {
    this.migrations = [];
    this.migrationSchema = new mongoose.Schema({
      version: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      executedAt: { type: Date, default: Date.now },
      executionTime: { type: Number },
      status: { type: String, enum: ['success', 'failed'], required: true },
      error: { type: String }
    });

    this.Migration = mongoose.model('Migration', this.migrationSchema);
  }

  // Register a migration
  addMigration(version, name, up, down) {
    this.migrations.push({
      version,
      name,
      up,
      down,
      executed: false
    });
  }

  // Get executed migrations
  async getExecutedMigrations() {
    try {
      const executed = await this.Migration.find({ status: 'success' }).sort({ version: 1 });
      return executed.map(m => m.version);
    } catch (error) {
      logger.error('Failed to get executed migrations', error);
      return [];
    }
  }

  // Execute all pending migrations
  async migrate() {
    logger.info('Starting database migration');

    const executedMigrations = await this.getExecutedMigrations();
    const pendingMigrations = this.migrations.filter(m => !executedMigrations.includes(m.version));

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return { success: true, message: 'No pending migrations' };
    }

    logger.info(`Found ${pendingMigrations.length} pending migrations`);

    const results = [];

    for (const migration of pendingMigrations) {
      const startTime = Date.now();

      try {
        logger.info(`Executing migration: ${migration.version} - ${migration.name}`);

        // Execute migration
        await migration.up();

        const executionTime = Date.now() - startTime;

        // Record successful migration
        await this.Migration.create({
          version: migration.version,
          name: migration.name,
          executedAt: new Date(),
          executionTime,
          status: 'success'
        });

        results.push({
          version: migration.version,
          name: migration.name,
          status: 'success',
          executionTime
        });

        logger.info(`Migration ${migration.version} completed successfully in ${executionTime}ms`);

      } catch (error) {
        const executionTime = Date.now() - startTime;

        // Record failed migration
        await this.Migration.create({
          version: migration.version,
          name: migration.name,
          executedAt: new Date(),
          executionTime,
          status: 'failed',
          error: error.message
        });

        results.push({
          version: migration.version,
          name: migration.name,
          status: 'failed',
          error: error.message,
          executionTime
        });

        logger.error(`Migration ${migration.version} failed`, error);

        // Stop on first failure
        break;
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    logger.info(`Migration completed: ${successCount} successful, ${failureCount} failed`);

    return {
      success: failureCount === 0,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      }
    };
  }

  // Rollback last migration
  async rollback() {
    logger.info('Starting migration rollback');

    const lastMigration = await this.Migration.findOne({ status: 'success' }).sort({ executedAt: -1 });

    if (!lastMigration) {
      logger.info('No migrations to rollback');
      return { success: true, message: 'No migrations to rollback' };
    }

    const migration = this.migrations.find(m => m.version === lastMigration.version);

    if (!migration || !migration.down) {
      logger.error(`Cannot rollback migration ${lastMigration.version}: no down function defined`);
      return { success: false, message: 'Cannot rollback: no down function defined' };
    }

    try {
      logger.info(`Rolling back migration: ${migration.version} - ${migration.name}`);

      await migration.down();

      // Remove migration record
      await this.Migration.deleteOne({ version: migration.version });

      logger.info(`Migration ${migration.version} rolled back successfully`);

      return {
        success: true,
        message: `Migration ${migration.version} rolled back successfully`
      };

    } catch (error) {
      logger.error(`Failed to rollback migration ${migration.version}`, error);

      return {
        success: false,
        message: `Failed to rollback migration: ${error.message}`
      };
    }
  }

  // Get migration status
  async status() {
    const executedMigrations = await this.getExecutedMigrations();
    const allMigrations = this.migrations.map(m => ({
      version: m.version,
      name: m.name,
      executed: executedMigrations.includes(m.version)
    }));

    return {
      total: allMigrations.length,
      executed: executedMigrations.length,
      pending: allMigrations.length - executedMigrations.length,
      migrations: allMigrations
    };
  }
}

// Create migration manager instance
const migrationManager = new MigrationManager();

// Define migrations
migrationManager.addMigration(
  '001',
  'Create tenants table with proper indexes',
  async() => {
    // Ensure tenants collection exists with proper indexes
    const db = mongoose.connection.db;
    const tenantsCollection = db.collection('tenants');

    // Create indexes
    await tenantsCollection.createIndex({ schoolCode: 1 }, { unique: true });
    await tenantsCollection.createIndex({ subdomain: 1 }, { unique: true });
    await tenantsCollection.createIndex({ email: 1 }, { unique: true });
    await tenantsCollection.createIndex({ 'subscription.status': 1 });
    await tenantsCollection.createIndex({ createdAt: 1 });

    logger.info('Created tenants table indexes');
  },
  async() => {
    // Rollback: drop indexes
    const db = mongoose.connection.db;
    const tenantsCollection = db.collection('tenants');

    try {
      await tenantsCollection.dropIndex({ schoolCode: 1 });
      await tenantsCollection.dropIndex({ subdomain: 1 });
      await tenantsCollection.dropIndex({ email: 1 });
      await tenantsCollection.dropIndex({ 'subscription.status': 1 });
      await tenantsCollection.dropIndex({ createdAt: 1 });
    } catch (error) {
      // Indexes might not exist, ignore errors
    }

    logger.info('Dropped tenants table indexes');
  }
);

migrationManager.addMigration(
  '002',
  'Create users table with tenant relationship and proper constraints',
  async() => {
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Create indexes
    await usersCollection.createIndex({ email: 1, tenantId: 1 }, { unique: true });
    await usersCollection.createIndex({ tenantId: 1 });
    await usersCollection.createIndex({ role: 1, tenantId: 1 });
    await usersCollection.createIndex({ studentId: 1, tenantId: 1 }, { unique: true, sparse: true });
    await usersCollection.createIndex({ createdAt: 1 });

    logger.info('Created users table indexes');
  },
  async() => {
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    try {
      await usersCollection.dropIndex({ email: 1, tenantId: 1 });
      await usersCollection.dropIndex({ tenantId: 1 });
      await usersCollection.dropIndex({ role: 1, tenantId: 1 });
      await usersCollection.dropIndex({ studentId: 1, tenantId: 1 });
      await usersCollection.dropIndex({ createdAt: 1 });
    } catch (error) {
      // Indexes might not exist, ignore errors
    }

    logger.info('Dropped users table indexes');
  }
);

migrationManager.addMigration(
  '003',
  'Create roles and permissions system',
  async() => {
    const db = mongoose.connection.db;

    // Create roles collection
    const rolesCollection = db.collection('roles');
    await rolesCollection.createIndex({ tenantId: 1, name: 1 }, { unique: true });
    await rolesCollection.createIndex({ tenantId: 1 });

    // Create permissions collection
    const permissionsCollection = db.collection('permissions');
    await permissionsCollection.createIndex({ tenantId: 1, resource: 1, action: 1 }, { unique: true });
    await permissionsCollection.createIndex({ tenantId: 1 });

    // Create role_assignments collection
    const roleAssignmentsCollection = db.collection('role_assignments');
    await roleAssignmentsCollection.createIndex({ tenantId: 1, userId: 1, roleId: 1 }, { unique: true });
    await roleAssignmentsCollection.createIndex({ tenantId: 1 });
    await roleAssignmentsCollection.createIndex({ userId: 1 });

    logger.info('Created roles and permissions system');
  },
  async() => {
    const db = mongoose.connection.db;

    try {
      await db.collection('roles').drop();
      await db.collection('permissions').drop();
      await db.collection('role_assignments').drop();
    } catch (error) {
      // Collections might not exist, ignore errors
    }

    logger.info('Dropped roles and permissions system');
  }
);

migrationManager.addMigration(
  '004',
  'Add email queue and notification system',
  async() => {
    const db = mongoose.connection.db;

    // Create email_queue collection
    const emailQueueCollection = db.collection('email_queue');
    await emailQueueCollection.createIndex({ status: 1, createdAt: 1 });
    await emailQueueCollection.createIndex({ attempts: 1 });
    await emailQueueCollection.createIndex({ createdAt: 1 });

    // Create notifications collection
    const notificationsCollection = db.collection('notifications');
    await notificationsCollection.createIndex({ tenantId: 1, userId: 1 });
    await notificationsCollection.createIndex({ tenantId: 1, type: 1 });
    await notificationsCollection.createIndex({ createdAt: 1 });
    await notificationsCollection.createIndex({ read: 1 });

    logger.info('Created email queue and notification system');
  },
  async() => {
    const db = mongoose.connection.db;

    try {
      await db.collection('email_queue').drop();
      await db.collection('notifications').drop();
    } catch (error) {
      // Collections might not exist, ignore errors
    }

    logger.info('Dropped email queue and notification system');
  }
);

module.exports = migrationManager;
