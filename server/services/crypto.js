import { createCipheriv, createDecipheriv, randomBytes, createHash, hkdfSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('ENCRYPTION_KEY env var is required');
  // Use HKDF for proper key derivation (salt + info for domain separation)
  const salt = createHash('sha256').update('tradeflow-encryption-salt').digest();
  const derived = hkdfSync('sha256', secret, salt, 'tradeflow-api-key-encryption', KEY_LENGTH);
  return Buffer.from(derived);
}

// Legacy key derivation (SHA-256) — used only for migrating old encrypted data
function getLegacyKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('ENCRYPTION_KEY env var is required');
  return createHash('sha256').update(secret).digest();
}

export function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext) {
  const key = getKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // Fallback: try legacy SHA-256 key for data encrypted before HKDF migration
    const legacyKey = getLegacyKey();
    const decipher = createDecipheriv(ALGORITHM, legacyKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

// Re-export for migration use
export { getLegacyKey };
