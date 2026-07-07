import 'dotenv/config';
import crypto from 'crypto';

const RAW_KEY = process.env.ENCRYPTION_KEY;
if (!RAW_KEY) {
  throw new Error('FATAL: ENCRYPTION_KEY environment variable is not set. Cannot start without it.');
}
if (RAW_KEY.length < 32) {
  throw new Error('FATAL: ENCRYPTION_KEY must be at least 32 characters long.');
}

// Derive a fixed 32-byte key from the env string.
const KEY = crypto.createHash('sha256').update(RAW_KEY).digest();

// AES-256-GCM: authenticated encryption — confidentiality + integrity.
// Format: iv(32 hex) + tag(32 hex) + ciphertext(hex).
function encrypt(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

function decrypt(encryptedData) {
  if (typeof encryptedData !== 'string') throw new Error('Invalid encrypted data');

  // AES-256-GCM format
  const iv = Buffer.from(encryptedData.slice(0, 32), 'hex');
  const tag = Buffer.from(encryptedData.slice(32, 64), 'hex');
  const ciphertext = Buffer.from(encryptedData.slice(64), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

export { encrypt, decrypt };
