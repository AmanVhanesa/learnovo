const { google } = require('googleapis');
const { Readable } = require('stream');

/**
 * Google Drive Service for Learnovo Backup
 *
 * Uses OAuth2 with a refresh token (works with personal Google accounts).
 *
 * Env vars required:
 *   GOOGLE_DRIVE_CLIENT_ID      - OAuth2 client ID
 *   GOOGLE_DRIVE_CLIENT_SECRET  - OAuth2 client secret
 *   GOOGLE_DRIVE_REFRESH_TOKEN  - Refresh token (from scripts/gdrive-setup.js)
 *   GOOGLE_DRIVE_FOLDER_ID      - Target folder ID in Google Drive
 */

let _driveClient = null;

function isConfigured() {
  return !!(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

function getDriveClient() {
  if (_driveClient) return _driveClient;

  if (!isConfigured()) {
    throw new Error('Google Drive is not configured. Run: node scripts/gdrive-setup.js');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  });

  _driveClient = google.drive({ version: 'v3', auth: oauth2Client });
  return _driveClient;
}

function getBackupFilename(tenantId) {
  return `learnovo-backup-${tenantId}.json.gz`;
}

/**
 * Find existing backup file for a tenant in the Drive folder.
 */
async function findExistingFile(tenantId) {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const filename = getBackupFilename(tenantId);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${filename}' and trashed = false`,
    fields: 'files(id, name, size, modifiedTime, webViewLink)',
    pageSize: 1,
  });

  return res.data.files?.[0] || null;
}

/**
 * Upload or replace (overwrite) the backup file for a tenant.
 * Single file per tenant — always the same filename, always overwritten.
 */
async function uploadOrReplace(tenantId, buffer) {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const filename = getBackupFilename(tenantId);

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const media = { mimeType: 'application/gzip', body: stream };

  const existingFile = await findExistingFile(tenantId);

  let result;
  if (existingFile) {
    result = await drive.files.update({
      fileId: existingFile.id,
      media,
      fields: 'id, name, size, modifiedTime, webViewLink',
    });
  } else {
    result = await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: 'application/gzip',
        parents: [folderId],
      },
      media,
      fields: 'id, name, size, modifiedTime, webViewLink',
    });
  }

  console.log(`[GDrive] Backup ${existingFile ? 'updated' : 'created'}: ${filename} (fileId: ${result.data.id})`);

  return {
    fileId: result.data.id,
    filename: result.data.name,
    size: parseInt(result.data.size || '0', 10),
    modifiedTime: result.data.modifiedTime,
    webViewLink: result.data.webViewLink,
  };
}

/**
 * Download the backup file for a tenant from Google Drive.
 */
async function downloadFile(tenantId) {
  const drive = getDriveClient();
  const existingFile = await findExistingFile(tenantId);

  if (!existingFile) {
    throw new Error(`No backup found in Google Drive for this school.`);
  }

  const res = await drive.files.get(
    { fileId: existingFile.id, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(res.data);
}

/**
 * Get metadata about the backup file for a tenant.
 */
async function getFileInfo(tenantId) {
  const existingFile = await findExistingFile(tenantId);
  if (!existingFile) return null;

  return {
    fileId: existingFile.id,
    filename: existingFile.name,
    size: parseInt(existingFile.size || '0', 10),
    modifiedTime: existingFile.modifiedTime,
    webViewLink: existingFile.webViewLink,
  };
}

module.exports = {
  isConfigured,
  uploadOrReplace,
  downloadFile,
  getFileInfo,
};
