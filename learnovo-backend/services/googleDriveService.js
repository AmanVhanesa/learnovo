const { google } = require('googleapis');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

/**
 * Google Drive Service for Learnovo Backup
 *
 * Uses OAuth2 with a refresh token (works with personal Google accounts).
 *
 * IMPORTANT: Make sure your Google Cloud OAuth consent screen is set to
 * "In production" (not "Testing"). In Testing mode, Google expires refresh
 * tokens after 7 days, causing repeated auth failures.
 *
 * Env vars required:
 *   GOOGLE_DRIVE_CLIENT_ID      - OAuth2 client ID
 *   GOOGLE_DRIVE_CLIENT_SECRET  - OAuth2 client secret
 *   GOOGLE_DRIVE_REFRESH_TOKEN  - Refresh token (from scripts/gdrive-setup.js)
 *   GOOGLE_DRIVE_FOLDER_ID      - Target folder ID in Google Drive
 */

let _driveClient = null;

// Path to config.env for persisting rotated refresh tokens
const CONFIG_ENV_PATH = path.resolve(__dirname, '..', 'config.env');

function isConfigured() {
  return !!(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

/**
 * Persist a new refresh token to config.env so it survives PM2 restarts.
 * Google may rotate refresh tokens at any time — if we don't save the new
 * one, the old token in config.env becomes invalid on next restart.
 */
function persistRefreshToken(newToken) {
  try {
    if (!fs.existsSync(CONFIG_ENV_PATH)) return;

    let content = fs.readFileSync(CONFIG_ENV_PATH, 'utf8');
    const regex = /^GOOGLE_DRIVE_REFRESH_TOKEN=.*/m;

    if (regex.test(content)) {
      content = content.replace(regex, `GOOGLE_DRIVE_REFRESH_TOKEN=${newToken}`);
    } else {
      content += `\nGOOGLE_DRIVE_REFRESH_TOKEN=${newToken}\n`;
    }

    fs.writeFileSync(CONFIG_ENV_PATH, content, 'utf8');
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN = newToken;
    console.log('[GDrive] Refresh token rotated and saved to config.env');
  } catch (err) {
    console.error('[GDrive] Failed to persist rotated refresh token:', err.message);
  }
}

/**
 * Reset the cached Drive client.
 * Call this on auth errors so the next request creates a fresh client.
 */
function resetClient() {
  _driveClient = null;
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
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  });

  // When Google issues new tokens, MERGE with existing credentials.
  // tokens event usually only contains { access_token, expiry_date }
  // — calling setCredentials(tokens) alone would ERASE the refresh_token,
  // causing "No refresh token is set" on the next refresh attempt.
  oauth2Client.on('tokens', (tokens) => {
    oauth2Client.setCredentials({
      ...oauth2Client.credentials,
      ...tokens
    });

    // Google rotated the refresh token — save it so it survives restarts
    if (tokens.refresh_token && tokens.refresh_token !== process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
      persistRefreshToken(tokens.refresh_token);
    }
  });
  oauth2Client.on('error', () => {
    _driveClient = null;
  });

  _driveClient = google.drive({ version: 'v3', auth: oauth2Client });
  return _driveClient;
}

/**
 * Check if Google Drive is actually reachable (not just configured).
 * Returns { ok: true } or { ok: false, error: string }.
 */
async function checkConnection() {
  if (!isConfigured()) {
    return { ok: false, error: 'Missing environment variables' };
  }

  try {
    const drive = getDriveClient();
    await drive.about.get({ fields: 'user' });
    return { ok: true };
  } catch (err) {
    resetClient();
    const msg = err.response?.data?.error_description
      || err.response?.data?.error?.message
      || err.message
      || 'Unknown error';

    // Detect expired/revoked token
    const status = err.response?.status || err.code;
    const isTokenError = status === 401 || status === 403
      || msg.includes('invalid_grant')
      || msg.includes('Token has been expired or revoked')
      || msg.includes('token has been revoked')
      || msg.includes('invalid_client')
      || msg.includes('unauthorized_client')
      || msg.includes('access_denied');
    if (isTokenError) {
      return { ok: false, error: 'Refresh token expired or revoked. Re-run: node scripts/gdrive-setup.js' };
    }

    return { ok: false, error: msg };
  }
}

function getBackupFilename(tenantId) {
  return `learnovo-backup-${tenantId}.json.gz`;
}

/**
 * Find existing backup file for a tenant in the Drive folder.
 */
async function findExistingFile(tenantId) {
  try {
    const drive = getDriveClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const filename = getBackupFilename(tenantId);

    const res = await drive.files.list({
      q: `'${folderId}' in parents and name = '${filename}' and trashed = false`,
      fields: 'files(id, name, size, modifiedTime, webViewLink)',
      pageSize: 1
    });

    return res.data.files?.[0] || null;
  } catch (err) {
    // Reset client on auth errors so next attempt gets a fresh token
    if (err.response?.status === 401 || err.response?.status === 403 || err.message?.includes('invalid_grant')) {
      resetClient();
    }
    throw err;
  }
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
      fields: 'id, name, size, modifiedTime, webViewLink'
    });
  } else {
    result = await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: 'application/gzip',
        parents: [folderId]
      },
      media,
      fields: 'id, name, size, modifiedTime, webViewLink'
    });
  }

  console.log(`[GDrive] Backup ${existingFile ? 'updated' : 'created'}: ${filename} (fileId: ${result.data.id})`);

  return {
    fileId: result.data.id,
    filename: result.data.name,
    size: parseInt(result.data.size || '0', 10),
    modifiedTime: result.data.modifiedTime,
    webViewLink: result.data.webViewLink
  };
}

/**
 * Download the backup file for a tenant from Google Drive.
 */
async function downloadFile(tenantId) {
  const drive = getDriveClient();
  const existingFile = await findExistingFile(tenantId);

  if (!existingFile) {
    throw new Error('No backup found in Google Drive for this school.');
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
    webViewLink: existingFile.webViewLink
  };
}

module.exports = {
  isConfigured,
  checkConnection,
  resetClient,
  uploadOrReplace,
  downloadFile,
  getFileInfo
};
