import crypto from 'crypto';
import logger from './logger.js';

function generateOTP() {
  const code = crypto.randomInt(10000000, 100000000).toString();
  logger.debug(`[OTP] Generated OTP: ${code.substring(0, 4)}****`);
  return code;
}

function generateBackupCodes(count = 6) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  logger.debug(`[OTP] Generated ${count} backup codes`);
  return codes;
}

export { generateOTP, generateBackupCodes };
