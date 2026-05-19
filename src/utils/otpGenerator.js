import logger from './logger.js';

function generateOTP() {
  const code = Math.floor(10000000 + Math.random() * 90000000).toString();
  logger.debug(`[OTP] Generated OTP: ${code.substring(0, 4)}****`);
  return code;
}

function generateBackupCodes(count = 6) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  logger.debug(`[OTP] Generated ${count} backup codes`);
  return codes;
}

export { generateOTP, generateBackupCodes };