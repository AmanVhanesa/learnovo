const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, BUCKET_NAME, REGION } = require('./s3');

/**
 * Upload a Buffer directly to S3
 * @param {Buffer} buffer - File content as a Buffer
 * @param {string} key - S3 object key (e.g. "documents/reportcards/tenantId/file.pdf")
 * @param {string} mimeType - MIME type (e.g. "application/pdf")
 * @returns {Promise<{ url: string, key: string }>} - Full S3 URL and key
 */
async function uploadBufferToS3(buffer, key, mimeType) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
    return { url, key };
}

/**
 * Build a namespaced S3 key for documents
 * @param {string} docType - Document type folder (e.g. "reportcards", "tc", "lc", "csv", "general")
 * @param {string} schoolId - Tenant/school ObjectId
 * @param {string} filename - Original filename
 * @returns {string} - S3 key like "documents/reportcards/{schoolId}/filename_1234567890.pdf"
 */
function buildS3Key(docType, schoolId, filename) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    // Sanitize filename
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `documents/${docType}/${schoolId}/${sanitized}_${timestamp}_${randomSuffix}`;
}

module.exports = { uploadBufferToS3, buildS3Key };
