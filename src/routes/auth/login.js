import 'dotenv/config';
import express from 'express';
import pb from '../../utils/pocketbaseClient.js';
import logger from '../../utils/logger.js';

const router = express.Router();
const LOGIN_ATTEMPT_MAX_TRIES = parseInt(process.env.LOGIN_ATTEMPT_MAX_TRIES || '5', 10);
const LOGIN_ATTEMPT_LOCK_DURATION_MS = parseInt(process.env.LOGIN_ATTEMPT_LOCK_DURATION_MS || '900000', 10);

async function checkLoginAttempts(email, ipAddress) {
  try {
    const attempts = await pb.collection('loginAttempts').getFullList({
      filter: `email = "${email}" && ipAddress = "${ipAddress}"`,
    });

    if (attempts.length === 0) {
      return { allowed: true };
    }

    const latestAttempt = attempts[attempts.length - 1];
    const lockExpiry = new Date(latestAttempt.lockedUntil).getTime();
    const now = Date.now();

    if (latestAttempt.failedAttempts >= LOGIN_ATTEMPT_MAX_TRIES && now < lockExpiry) {
      logger.warn(`[LOGIN] Login attempt blocked for ${email} from ${ipAddress} - account locked`);
      return {
        allowed: false,
        lockedUntil: latestAttempt.lockedUntil,
        message: 'Account temporarily locked due to too many failed login attempts',
      };
    }

    return { allowed: true };
  } catch (error) {
    logger.error('[LOGIN] Error checking login attempts:', error);
    return { allowed: true };
  }
}

async function recordFailedAttempt(email, ipAddress) {
  try {
    const attempts = await pb.collection('loginAttempts').getFullList({
      filter: `email = "${email}" && ipAddress = "${ipAddress}"`,
    });

    if (attempts.length === 0) {
      await pb.collection('loginAttempts').create({
        email,
        ipAddress,
        failedAttempts: 1,
        lockedUntil: new Date(Date.now() + LOGIN_ATTEMPT_LOCK_DURATION_MS).toISOString(),
      });
      logger.info(`[LOGIN] First failed login attempt recorded for ${email} from ${ipAddress}`);
    } else {
      const latestAttempt = attempts[attempts.length - 1];
      const newFailedCount = latestAttempt.failedAttempts + 1;
      const shouldLock = newFailedCount >= LOGIN_ATTEMPT_MAX_TRIES;

      await pb.collection('loginAttempts').update(latestAttempt.id, {
        failedAttempts: newFailedCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOGIN_ATTEMPT_LOCK_DURATION_MS).toISOString()
          : latestAttempt.lockedUntil,
      });
      logger.warn(`[LOGIN] Failed login attempt ${newFailedCount}/${LOGIN_ATTEMPT_MAX_TRIES} for ${email} from ${ipAddress}`);
    }
  } catch (error) {
    logger.error('[LOGIN] Error recording failed login attempt:', error);
  }
}

async function clearLoginAttempts(email, ipAddress) {
  try {
    const attempts = await pb.collection('loginAttempts').getFullList({
      filter: `email = "${email}" && ipAddress = "${ipAddress}"`,
    });

    for (const attempt of attempts) {
      await pb.collection('loginAttempts').delete(attempt.id);
    }
    logger.info(`[LOGIN] Login attempts cleared for ${email} from ${ipAddress}`);
  } catch (error) {
    logger.error('[LOGIN] Error clearing login attempts:', error);
  }
}

router.post('/attempt', async (req, res) => {
  logger.debug('[LOGIN] POST /attempt - Received request');
  logger.debug(`[LOGIN] Request body type: ${typeof req.body}`);
  logger.debug(`[LOGIN] Request body keys: ${req.body ? Object.keys(req.body).join(', ') : 'undefined'}`);

  const { email, ipAddress } = req.body;

  if (!email || !ipAddress) {
    logger.warn('[LOGIN] /attempt - Missing required fields: email or ipAddress');
    return res.status(400).json({ error: 'Email and IP address are required' });
  }

  logger.info(`[LOGIN] /attempt - Login attempt check for ${email} from ${ipAddress}`);
  const check = await checkLoginAttempts(email, ipAddress);

  if (!check.allowed) {
    logger.warn(`[LOGIN] /attempt - Account locked for ${email}`);
    return res.status(429).json({
      error: check.message,
      lockedUntil: check.lockedUntil,
    });
  }

  logger.debug(`[LOGIN] /attempt - Login allowed for ${email}`);
  res.json({ allowed: true });
});

router.post('/record-failure', async (req, res) => {
  logger.debug('[LOGIN] POST /record-failure - Received request');
  logger.debug(`[LOGIN] Request body type: ${typeof req.body}`);
  logger.debug(`[LOGIN] Request body keys: ${req.body ? Object.keys(req.body).join(', ') : 'undefined'}`);

  const { email, ipAddress } = req.body;

  if (!email || !ipAddress) {
    logger.warn('[LOGIN] /record-failure - Missing required fields: email or ipAddress');
    return res.status(400).json({ error: 'Email and IP address are required' });
  }

  logger.info(`[LOGIN] /record-failure - Recording failed attempt for ${email} from ${ipAddress}`);
  await recordFailedAttempt(email, ipAddress);
  res.json({ success: true });
});

router.post('/record-success', async (req, res) => {
  logger.debug('[LOGIN] POST /record-success - Received request');
  logger.debug(`[LOGIN] Request body type: ${typeof req.body}`);
  logger.debug(`[LOGIN] Request body keys: ${req.body ? Object.keys(req.body).join(', ') : 'undefined'}`);

  const { email, ipAddress } = req.body;

  if (!email || !ipAddress) {
    logger.warn('[LOGIN] /record-success - Missing required fields: email or ipAddress');
    return res.status(400).json({ error: 'Email and IP address are required' });
  }

  logger.info(`[LOGIN] /record-success - Clearing failed attempts for ${email} from ${ipAddress}`);
  await clearLoginAttempts(email, ipAddress);
  res.json({ success: true });
});

router.post('/authenticate', async (req, res) => {
  logger.info('[LOGIN] POST /authenticate - Received authentication request');
  
  // ===== STEP 1: Log request details =====
  logger.debug(`[LOGIN] Request headers: Content-Type=${req.headers['content-type']}`);
  logger.debug(`[LOGIN] Request body type: ${typeof req.body}`);
  logger.debug(`[LOGIN] Request body is null/undefined: ${req.body === null || req.body === undefined}`);
  
  if (req.body) {
    logger.debug(`[LOGIN] Request body keys: ${Object.keys(req.body).join(', ')}`);
    logger.debug(`[LOGIN] Request body JSON: ${JSON.stringify(req.body)}`);
  }

  // ===== STEP 2: Validate request body =====
  if (!req.body || typeof req.body !== 'object') {
    logger.error('[LOGIN] /authenticate - Request body is not a valid JSON object');
    logger.error(`[LOGIN] Request body type: ${typeof req.body}, value: ${req.body}`);
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }

  // ===== STEP 3: Extract fields from request body =====
  const { email, password, ipAddress, userAgent } = req.body;

  logger.debug(`[LOGIN] /authenticate - Extracted fields:`);
  logger.debug(`[LOGIN]   - email: ${email ? `"${email}"` : 'undefined'}`);
  logger.debug(`[LOGIN]   - password: ${password ? '***' : 'undefined'}`);
  logger.debug(`[LOGIN]   - ipAddress: ${ipAddress ? `"${ipAddress}"` : 'undefined'}`);
  logger.debug(`[LOGIN]   - userAgent: ${userAgent ? `"${userAgent.substring(0, 50)}..."` : 'undefined'}`);

  // ===== STEP 4: Validate inputs =====
  if (!email || typeof email !== 'string' || !email.trim()) {
    logger.warn('[LOGIN] /authenticate - Missing or invalid email field');
    logger.warn(`[LOGIN] Email value: ${JSON.stringify(email)}`);
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    logger.warn('[LOGIN] /authenticate - Missing or invalid password field');
    logger.warn(`[LOGIN] Password value: ${password ? '***' : 'undefined'}`);
    return res.status(400).json({ error: 'Password is required' });
  }

  if (!ipAddress || typeof ipAddress !== 'string' || !ipAddress.trim()) {
    logger.warn('[LOGIN] /authenticate - Missing or invalid IP address field');
    logger.warn(`[LOGIN] IP address value: ${JSON.stringify(ipAddress)}`);
    return res.status(400).json({ error: 'IP address is required' });
  }

  // ===== STEP 5: Normalize inputs =====
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();
  const trimmedIpAddress = ipAddress.trim();
  const trimmedUserAgent = userAgent ? String(userAgent).trim() : 'Unknown';

  logger.info(`[LOGIN] /authenticate - Authentication attempt for ${trimmedEmail} from ${trimmedIpAddress}`);
  logger.debug(`[LOGIN] /authenticate - Email (trimmed): ${trimmedEmail}`);
  logger.debug(`[LOGIN] /authenticate - Password length: ${trimmedPassword.length}`);
  logger.debug(`[LOGIN] /authenticate - IP Address: ${trimmedIpAddress}`);
  logger.debug(`[LOGIN] /authenticate - User Agent: ${trimmedUserAgent}`);

  // ===== STEP 6: Check if account is locked =====
  logger.debug(`[LOGIN] /authenticate - Checking login attempts for ${trimmedEmail}`);
  const check = await checkLoginAttempts(trimmedEmail, trimmedIpAddress);
  if (!check.allowed) {
    logger.warn(`[LOGIN] /authenticate - Authentication blocked for ${trimmedEmail} - account locked`);
    return res.status(429).json({
      error: check.message,
      lockedUntil: check.lockedUntil,
    });
  }

  // ===== STEP 7: Attempt authentication with PocketBase =====
  logger.debug(`[LOGIN] /authenticate - Attempting PocketBase authentication for ${trimmedEmail}`);
  let authData;
  try {
    authData = await pb.collection('users').authWithPassword(trimmedEmail, trimmedPassword);
    logger.debug(`[LOGIN] /authenticate - PocketBase authWithPassword returned successfully`);
    logger.debug(`[LOGIN] /authenticate - Auth data type: ${typeof authData}`);
    logger.debug(`[LOGIN] /authenticate - Auth data keys: ${authData ? Object.keys(authData).join(', ') : 'null'}`);
  } catch (authError) {
    logger.error(`[LOGIN] /authenticate - PocketBase authentication failed: ${authError.message}`);
    logger.debug(`[LOGIN] /authenticate - Auth error details:`, authError);
    await recordFailedAttempt(trimmedEmail, trimmedIpAddress);
    throw new Error('Invalid email or password');
  }

  if (!authData || !authData.record) {
    logger.error(`[LOGIN] /authenticate - Authentication succeeded but no user record returned`);
    logger.error(`[LOGIN] /authenticate - Auth data: ${JSON.stringify(authData)}`);
    await recordFailedAttempt(trimmedEmail, trimmedIpAddress);
    throw new Error('Invalid email or password');
  }

  logger.info(`[LOGIN] /authenticate - Authentication successful for ${trimmedEmail}`);
  logger.debug(`[LOGIN] /authenticate - User record ID: ${authData.record.id}`);
  logger.debug(`[LOGIN] /authenticate - User record email: ${authData.record.email}`);

  const user = authData.record;

  // ===== STEP 8: Check if OTP is enabled on the user account =====
  logger.debug(`[LOGIN] /authenticate - Checking if OTP is enabled for user ${user.id}`);
  if (user.otpEnabled) {
    logger.info(`[LOGIN] /authenticate - OTP is enabled for user ${user.id} (${trimmedEmail})`);
    logger.debug(`[LOGIN] /authenticate - Requesting OTP from PocketBase for ${trimmedEmail}`);

    // Request OTP from PocketBase
    let otpResponse;
    try {
      otpResponse = await pb.collection('users').requestOTP(trimmedEmail);
      logger.info(`[LOGIN] /authenticate - OTP request successful for ${trimmedEmail}`);
      logger.debug(`[LOGIN] /authenticate - OTP response type: ${typeof otpResponse}`);
      logger.debug(`[LOGIN] /authenticate - OTP response keys: ${otpResponse ? Object.keys(otpResponse).join(', ') : 'null'}`);
    } catch (otpError) {
      logger.error(`[LOGIN] /authenticate - OTP request failed: ${otpError.message}`);
      throw new Error(`Failed to request OTP: ${otpError.message}`);
    }

    // Log the OTP request
    try {
      await pb.collection('auditLogs').create({
        userId: user.id,
        eventType: 'otp_requested',
        description: 'OTP code requested during login',
        ipAddress: trimmedIpAddress,
        userAgent: trimmedUserAgent,
        status: 'success',
        timestamp: new Date().toISOString(),
      });
      logger.info(`[LOGIN] /authenticate - OTP request logged for user ${user.id}`);
    } catch (auditError) {
      logger.warn(`[LOGIN] /authenticate - Failed to create audit log for OTP request: ${auditError.message}`);
    }

    // Return OTP response (don't return auth token yet)
    logger.debug(`[LOGIN] /authenticate - Returning OTP response to client`);
    const otpResponseData = {
      success: true,
      otpRequired: true,
      otpId: otpResponse.otpId,
      message: 'OTP code sent to email. Please verify to complete login.',
    };
    logger.debug(`[LOGIN] /authenticate - OTP response JSON: ${JSON.stringify(otpResponseData)}`);
    
    // ===== STEP 9: Send response as JSON =====
    try {
      res.json(otpResponseData);
      logger.info(`[LOGIN] /authenticate - OTP response sent successfully to client`);
    } catch (responseError) {
      logger.error(`[LOGIN] /authenticate - Error sending OTP response: ${responseError.message}`);
      throw responseError;
    }
    return;
  }

  // OTP not enabled - proceed with normal login
  logger.info(`[LOGIN] /authenticate - OTP not enabled for user ${user.id} - proceeding with normal login`);

  // ===== STEP 10: Create session =====
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const activeSessions = user.activeSessions || [];

  logger.debug(`[LOGIN] /authenticate - Creating session with ID: ${sessionId}`);
  const newSession = {
    sessionId,
    deviceName: trimmedUserAgent,
    ipAddress: trimmedIpAddress,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };

  activeSessions.push(newSession);

  logger.debug(`[LOGIN] /authenticate - Updating user record with new session`);
  try {
    await pb.collection('users').update(user.id, {
      activeSessions,
      lastLoginDevice: trimmedUserAgent,
      lastLoginIp: trimmedIpAddress,
    });
    logger.info(`[LOGIN] /authenticate - User record updated with new session`);
  } catch (updateError) {
    logger.error(`[LOGIN] /authenticate - Failed to update user record: ${updateError.message}`);
    throw new Error(`Failed to create session: ${updateError.message}`);
  }

  // ===== STEP 11: Log successful login =====
  try {
    await pb.collection('auditLogs').create({
      userId: user.id,
      eventType: 'login',
      description: 'User logged in successfully',
      ipAddress: trimmedIpAddress,
      userAgent: trimmedUserAgent,
      status: 'success',
      timestamp: new Date().toISOString(),
    });
    logger.info(`[LOGIN] /authenticate - Login audit log created for user ${user.id}`);
  } catch (auditError) {
    logger.warn(`[LOGIN] /authenticate - Failed to create login audit log: ${auditError.message}`);
  }

  // ===== STEP 12: Clear failed attempts =====
  await clearLoginAttempts(trimmedEmail, trimmedIpAddress);

  logger.info(`[LOGIN] /authenticate - Session created for user ${user.id} with sessionId ${sessionId}`);

  // ===== STEP 13: Prepare response =====
  const responseData = {
    success: true,
    token: authData.token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || '',
      avatar: user.avatar || '',
    },
    sessionId,
  };

  logger.debug(`[LOGIN] /authenticate - Response data prepared: ${JSON.stringify(responseData)}`);

  // ===== STEP 14: Send response as JSON =====
  try {
    res.json(responseData);
    logger.info(`[LOGIN] /authenticate - Successful authentication response sent to client`);
  } catch (responseError) {
    logger.error(`[LOGIN] /authenticate - Error sending authentication response: ${responseError.message}`);
    throw responseError;
  }
});

export default router;