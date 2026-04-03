const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const zlib = require('zlib');
const { protect, authorize } = require('../middleware/auth');
const BackupLog = require('../models/BackupLog');
const backupService = require('../services/backupService');
const googleDriveService = require('../services/googleDriveService');
const { logger } = require('../middleware/errorHandler');

// All backup routes require admin auth
router.use(protect, authorize('admin'));

/**
 * POST /api/admin/backup
 * Download backup as file + upload to Google Drive (fire-and-forget)
 */
router.post('/backup', async(req, res) => {
  req.setTimeout(120000);
  if (res.setTimeout) res.setTimeout(120000);

  const tenantId = req.user.tenantId;
  if (!tenantId) {
    return res.status(400).json({ success: false, message: 'Tenant ID not found.' });
  }

  try {
    const { buffer, metadata } = await backupService.createBackupBuffer(tenantId);

    const filename = `learnovo-backup-${new Date().toISOString().split('T')[0]}.json.gz`;

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

    // Fire-and-forget: upload to Google Drive + log
    (async() => {
      let driveFileId;
      let storageLocation = 'local';

      try {
        if (googleDriveService.isConfigured()) {
          try {
            const driveResult = await googleDriveService.uploadOrReplace(tenantId, buffer);
            driveFileId = driveResult.fileId;
            storageLocation = 'google_drive';
          } catch (uploadErr) {
            logger.error('Background Drive upload failed, logging as local', uploadErr, { tenantId });
          }
        }

        await BackupLog.create({
          tenantId,
          performedBy: req.user._id,
          filename,
          sizeBytes: metadata.sizeBytes,
          collectionsCount: metadata.collectionsCount,
          documentsCount: metadata.documentsCount,
          status: 'success',
          type: 'manual',
          driveFileId,
          storageLocation
        });
      } catch (err) {
        logger.error('Post-download backup logging failed', err, { tenantId });
      }
    })();
  } catch (error) {
    if (!res.headersSent) {
      BackupLog.create({
        tenantId,
        performedBy: req.user._id,
        filename: 'failed-backup',
        status: 'failed',
        errorMessage: error.message,
        type: 'manual'
      }).catch(() => {});

      res.status(500).json({
        success: false,
        message: 'Backup failed',
        error: error.message
      });
    }
  }
});

/**
 * POST /api/admin/backup/cloud
 * Backup directly to Google Drive (no file download)
 */
router.post('/backup/cloud', async(req, res) => {
  req.setTimeout(120000);

  const tenantId = req.user.tenantId;
  if (!tenantId) {
    return res.status(400).json({ success: false, message: 'Tenant ID not found.' });
  }

  if (!googleDriveService.isConfigured()) {
    return res.status(400).json({
      success: false,
      message: 'Google Drive is not configured. Run: node scripts/gdrive-setup.js to set up OAuth credentials.'
    });
  }

  // Verify the token actually works before creating the full backup
  const connection = await googleDriveService.checkConnection();
  if (!connection.ok) {
    return res.status(400).json({
      success: false,
      message: `Google Drive connection failed: ${connection.error}`
    });
  }

  try {
    const { log, driveResult, metadata } = await backupService.createAndUploadBackup(
      tenantId, req.user._id, 'manual'
    );

    res.json({
      success: true,
      message: driveResult
        ? 'Backup uploaded to Google Drive successfully.'
        : 'Backup saved locally (Google Drive upload failed).',
      data: {
        driveFileId: driveResult?.fileId,
        storageLocation: driveResult ? 'google_drive' : 'local',
        sizeBytes: metadata.sizeBytes,
        collectionsCount: metadata.collectionsCount,
        documentsCount: metadata.documentsCount,
        backupId: log._id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Cloud backup failed'
    });
  }
});

/**
 * GET /api/admin/backup/cloud/status
 * Get Google Drive backup file info for this tenant
 */
router.get('/backup/cloud/status', async(req, res) => {
  const tenantId = req.user.tenantId;

  if (!googleDriveService.isConfigured()) {
    return res.json({
      success: true,
      data: { configured: false }
    });
  }

  // Env vars are set — verify the token actually works
  const connection = await googleDriveService.checkConnection();
  if (!connection.ok) {
    return res.json({
      success: true,
      data: {
        configured: true,
        active: false,
        error: connection.error
      }
    });
  }

  try {
    const fileInfo = await googleDriveService.getFileInfo(tenantId);

    res.json({
      success: true,
      data: {
        configured: true,
        active: true,
        file: fileInfo
      }
    });
  } catch (error) {
    logger.error('Cloud status check failed', error, { tenantId });
    res.json({
      success: true,
      data: {
        configured: true,
        active: false,
        error: error.message || 'Failed to reach Google Drive'
      }
    });
  }
});

/**
 * POST /api/admin/backup/cloud/restore
 * Restore data from Google Drive backup
 */
router.post('/backup/cloud/restore', async(req, res) => {
  req.setTimeout(120000);

  const tenantId = req.user.tenantId;
  const { confirmation } = req.body;

  if (confirmation !== 'RESTORE') {
    return res.status(400).json({
      success: false,
      message: 'You must type "RESTORE" to confirm this action.'
    });
  }

  if (!googleDriveService.isConfigured()) {
    return res.status(400).json({
      success: false,
      message: 'Google Drive is not configured.'
    });
  }

  try {
    // Download backup from Google Drive
    const compressedBuffer = await googleDriveService.downloadFile(tenantId);
    const jsonStr = zlib.gunzipSync(compressedBuffer).toString();
    const backupData = JSON.parse(jsonStr);

    // Restore using transaction
    const db = mongoose.connection.db;
    const session = await mongoose.startSession();
    let restoredCollections = 0;
    let restoredDocs = 0;

    try {
      await session.withTransaction(async() => {
        for (const [colName, docs] of Object.entries(backupData)) {
          if (!Array.isArray(docs) || docs.length === 0) continue;
          if (colName.startsWith('system.')) continue;

          const collection = db.collection(colName);
          await collection.deleteMany(
            { tenantId: new mongoose.Types.ObjectId(tenantId) },
            { session }
          );
          await collection.insertMany(docs, { session });
          restoredCollections++;
          restoredDocs += docs.length;
        }
      });

      res.json({
        success: true,
        message: `Restore completed. ${restoredCollections} collections, ${restoredDocs} documents restored from Google Drive.`,
        data: { collections: restoredCollections, documents: restoredDocs }
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    logger.error('Cloud restore failed', error, { tenantId });
    res.status(500).json({
      success: false,
      message: error.message || 'Restore from Google Drive failed'
    });
  }
});

/**
 * POST /api/admin/restore
 * Restore from uploaded backup file (existing endpoint)
 */
router.post('/restore', async(req, res) => {
  req.setTimeout(120000);

  const tenantId = req.user.tenantId;
  const { confirmation } = req.body;

  if (confirmation !== 'RESTORE') {
    return res.status(400).json({ success: false, message: 'You must type "RESTORE" to confirm.' });
  }

  if (!req.body.backupData) {
    return res.status(400).json({ success: false, message: 'No backup data provided.' });
  }

  let backupData;
  try {
    backupData = typeof req.body.backupData === 'string'
      ? JSON.parse(req.body.backupData)
      : req.body.backupData;
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid backup data format.' });
  }

  const db = mongoose.connection.db;
  const session = await mongoose.startSession();
  let restoredCollections = 0;
  let restoredDocs = 0;

  try {
    await session.withTransaction(async() => {
      for (const [colName, docs] of Object.entries(backupData)) {
        if (!Array.isArray(docs) || docs.length === 0) continue;
        if (colName.startsWith('system.')) continue;

        const collection = db.collection(colName);
        await collection.deleteMany(
          { tenantId: new mongoose.Types.ObjectId(tenantId) },
          { session }
        );
        await collection.insertMany(docs, { session });
        restoredCollections++;
        restoredDocs += docs.length;
      }
    });

    res.json({
      success: true,
      message: `Restore completed. ${restoredCollections} collections, ${restoredDocs} documents restored.`,
      data: { collections: restoredCollections, documents: restoredDocs }
    });
  } catch (error) {
    logger.error('Restore failed', error, { tenantId });
    res.status(500).json({ success: false, message: error.message || 'Restore failed' });
  } finally {
    await session.endSession();
  }
});

/**
 * GET /api/admin/backup/history
 */
router.get('/backup/history', async(req, res) => {
  try {
    const logs = await BackupLog.find({ tenantId: req.user.tenantId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('performedBy', 'name email')
      .lean();

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch backup history' });
  }
});

/**
 * GET /api/admin/backup/last
 */
router.get('/backup/last', async(req, res) => {
  try {
    const lastBackup = await BackupLog.findOne({
      tenantId: req.user.tenantId,
      status: 'success'
    }).sort({ createdAt: -1 }).lean();

    res.json({ success: true, data: lastBackup || null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch last backup info' });
  }
});

module.exports = router;
