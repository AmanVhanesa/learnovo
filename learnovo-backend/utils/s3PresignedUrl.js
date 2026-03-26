const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, BUCKET_NAME } = require('./s3');
const cache = require('./cache');

/**
 * Generate a temporary pre-signed URL for a private S3 object.
 * Results are cached for 50 minutes (URLs expire at 60 min).
 *
 * @param {string} s3Key - The S3 object key
 * @param {number} expiresInSeconds - URL validity duration (default: 3600 = 1 hour)
 * @returns {Promise<string>} - Temporary download URL
 */
async function getPresignedUrl(s3Key, expiresInSeconds = 3600) {
    if (!s3Key) throw new Error('s3Key is required');

    // Check cache first (key scoped by bucket + key)
    const cacheKey = `s3url:${BUCKET_NAME}:${s3Key}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
    });

    const url = await getSignedUrl(s3Client, command, {
        expiresIn: expiresInSeconds,
    });

    // Cache for 50 min (just under the 60-min expiry)
    cache.set(cacheKey, url, 3000);

    return url;
}

module.exports = { getPresignedUrl };
