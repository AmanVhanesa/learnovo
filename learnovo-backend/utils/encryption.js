const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set. Payment data cannot be encrypted.');
  }
  // Key must be 32 bytes (256-bit) for AES-256
  // Accept hex-encoded (64 chars) or raw 32-char keys
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }
  if (key.length === 32) {
    return Buffer.from(key, 'utf8');
  }
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters or 64 hex characters (256-bit).');
}

/**
 * Encrypt a string value using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex-encoded).
 */
function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const textToEncrypt = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

  let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a value previously encrypted with encrypt().
 * Expects format: iv:authTag:ciphertext (all hex-encoded).
 * If the value doesn't look encrypted (no colons), returns it as-is for backward compatibility.
 */
function decrypt(encryptedValue) {
  if (encryptedValue == null || encryptedValue === '') return encryptedValue;

  // Backward compatibility: if not in encrypted format, return as-is
  if (typeof encryptedValue !== 'string' || encryptedValue.split(':').length !== 3) {
    return encryptedValue;
  }

  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertext] = encryptedValue.split(':');

  // Validate hex parts before attempting decryption
  if (!ivHex || !authTagHex || !ciphertext) return encryptedValue;
  if (ivHex.length !== IV_LENGTH * 2) return encryptedValue;

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // If decryption fails, value might be unencrypted legacy data
    return encryptedValue;
  }
}

/**
 * Encrypt a JS object (e.g. gatewayResponse). Serializes to JSON first.
 */
function encryptObject(obj) {
  if (obj == null || (typeof obj === 'object' && Object.keys(obj).length === 0)) {
    return obj;
  }
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt back to a JS object. Parses JSON after decryption.
 * Returns the original value if it's already a plain object (backward compat).
 */
function decryptObject(value) {
  // Already a plain object (unencrypted legacy data)
  if (value != null && typeof value === 'object') return value;

  const decrypted = decrypt(value);
  if (decrypted === value) return value; // wasn't encrypted

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

module.exports = { encrypt, decrypt, encryptObject, decryptObject };
