#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const migrationManager = require('../utils/migrationManager');
const { logger } = require('../middleware/errorHandler');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learnovo', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info('Connected to MongoDB');

    switch (command) {
    case '--status':
      await showStatus();
      break;
    case '--rollback':
      await rollback();
      break;
    default:
      await migrate();
      break;
    }

  } catch (error) {
    logger.error('Migration script error', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

async function migrate() {
  console.log('🔄 Running database migrations...');

  const result = await migrationManager.migrate();

  if (result.success) {
    console.log('✅ All migrations completed successfully');
    console.log(`📊 Summary: ${result.summary.successful}/${result.summary.total} migrations executed`);
  } else {
    console.log('❌ Migration failed');
    console.log(`📊 Summary: ${result.summary.successful}/${result.summary.total} migrations executed`);

    const failedMigrations = result.results.filter(r => r.status === 'failed');
    failedMigrations.forEach(migration => {
      console.log(`❌ Failed: ${migration.version} - ${migration.name}`);
      console.log(`   Error: ${migration.error}`);
    });

    process.exit(1);
  }
}

async function rollback() {
  console.log('🔄 Rolling back last migration...');

  const result = await migrationManager.rollback();

  if (result.success) {
    console.log('✅ Rollback completed successfully');
    console.log(`📝 ${result.message}`);
  } else {
    console.log('❌ Rollback failed');
    console.log(`📝 ${result.message}`);
    process.exit(1);
  }
}

async function showStatus() {
  console.log('📊 Migration Status');
  console.log('==================');

  const status = await migrationManager.status();

  console.log(`Total migrations: ${status.total}`);
  console.log(`Executed: ${status.executed}`);
  console.log(`Pending: ${status.pending}`);
  console.log('');

  if (status.migrations.length > 0) {
    console.log('Migration Details:');
    console.log('-----------------');

    status.migrations.forEach(migration => {
      const statusIcon = migration.executed ? '✅' : '⏳';
      console.log(`${statusIcon} ${migration.version} - ${migration.name}`);
    });
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
  process.exit(1);
});

main();
