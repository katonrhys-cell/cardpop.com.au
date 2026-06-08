import 'dotenv/config';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('FATAL: ENCRYPTION_KEY environment variable is not set. Cannot start without it.');
}
if (ENCRYPTION_KEY.length < 32) {
  throw new Error('FATAL: ENCRYPTION_KEY must be at least 32 characters long.');
}

function encrypt(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
}

function decrypt(encryptedData) {
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

export { encrypt, decrypt };