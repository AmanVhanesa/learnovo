const mongoose = require('mongoose');
const zlib = require('zlib');
const BackupLog = require('../models/BackupLog');
const googleDriveService = require('./googleDriveService');
const { logger } = require('../middleware/errorHandler');

/**
 * Create a compressed backup buffer for a tenant.
 * Returns { buffer, metadata }.
 */
async function createBackupBuffer(tenantId) {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const backupData = {};
  let totalDocs = 0;

  for (const col of collections) {
    if (col.name.startsWith('system.')) continue;

    const collection = db.collection(col.name);
    let docs;
    try {
      docs = await collection.find({ tenantId: new mongoose.Types.ObjectId(tenantId) }).toArray();
      if (docs.length === 0) {
        docs = await collection.find({ _id: new mongoose.Types.ObjectId(tenantId) }).toArray();
      }
    } catch {
      continue;
    }

    if (docs.length > 0) {
      backupData[col.name] = docs;
      totalDocs += docs.length;
    }
  }

  const jsonStr = JSON.stringify(backupData, null, 2);
  const buffer = zlib.gzipSync(Buffer.from(jsonStr));

  return {
    buffer,
    metadata: {
      collectionsCount: Object.keys(backupData).length,
      documentsCount: totalDocs,
      sizeBytes: buffer.length
    }
  };
}

/**
 * Create backup and upload to Google Drive.
 * Logs the result to BackupLog.
 */
async function createAndUploadBackup(tenantId, performedBy, type = 'manual') {
  const startTime = Date.now();

  try {
    const { buffer, metadata } = await createBackupBuffer(tenantId);

    let driveResult = null;
    let storageLocation = 'local';

    if (googleDriveService.isConfigured()) {
      try {
        driveResult = await googleDriveService.uploadOrReplace(tenantId, buffer);
        storageLocation = 'google_drive';
      } catch (uploadErr) {
        logger.error('Google Drive upload failed, falling back to local backup', {
          tenantId,
          error: uploadErr.message
        });
        // Continue with local backup — don't fail the whole operation
      }
    }

    const log = await BackupLog.create({
      tenantId,
      performedBy: performedBy || undefined,
      filename: driveResult?.filename || `learnovo-backup-${tenantId}.json.gz`,
      sizeBytes: metadata.sizeBytes,
      collectionsCount: metadata.collectionsCount,
      documentsCount: metadata.documentsCount,
      status: 'success',
      type,
      driveFileId: driveResult?.fileId || undefined,
      storageLocation
    });

    logger.info('Backup completed', {
      tenantId,
      type,
      storageLocation,
      collections: metadata.collectionsCount,
      documents: metadata.documentsCount,
      sizeBytes: metadata.sizeBytes,
      durationMs: Date.now() - startTime,
      driveFileId: driveResult?.fileId
    });

    return { log, driveResult, metadata };
  } catch (error) {
    // Log the failure
    try {
      await BackupLog.create({
        tenantId,
        performedBy: performedBy || undefined,
        filename: 'failed-backup',
        status: 'failed',
        errorMessage: error.message,
        type,
        storageLocation: 'google_drive'
      });
    } catch {
      // ignore logging errors
    }

    logger.error('Backup failed', error, { tenantId, type });
    throw error;
  }
}

/**
 * Create backup locally (no Google Drive upload).
 * Used as fallback when Google Drive is unavailable.
 * Logs the result to BackupLog.
 */
async function createLocalBackup(tenantId, performedBy, type = 'manual') {
  const startTime = Date.now();

  try {
    const { buffer, metadata } = await createBackupBuffer(tenantId);

    const log = await BackupLog.create({
      tenantId,
      performedBy: performedBy || undefined,
      filename: `learnovo-backup-${tenantId}.json.gz`,
      sizeBytes: metadata.sizeBytes,
      collectionsCount: metadata.collectionsCount,
      documentsCount: metadata.documentsCount,
      status: 'success',
      type,
      storageLocation: 'local'
    });

    logger.info('Local backup completed', {
      tenantId,
      type,
      storageLocation: 'local',
      collections: metadata.collectionsCount,
      documents: metadata.documentsCount,
      sizeBytes: metadata.sizeBytes,
      durationMs: Date.now() - startTime
    });

    return { log, metadata, buffer };
  } catch (error) {
    try {
      await BackupLog.create({
        tenantId,
        performedBy: performedBy || undefined,
        filename: 'failed-backup',
        status: 'failed',
        errorMessage: error.message,
        type,
        storageLocation: 'local'
      });
    } catch {
      // ignore logging errors
    }

    logger.error('Local backup failed', error, { tenantId, type });
    throw error;
  }
}

module.exports = {
  createBackupBuffer,
  createAndUploadBackup,
  createLocalBackup
};
