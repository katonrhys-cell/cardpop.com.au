import express from 'express';
import mfaRouter from './mfa.js';
import passwordRouter from './password.js';
import loginRouter from './login.js';
import sessionsRouter from './sessions.js';
import devicesRouter from './devices.js';
import historyRouter from './history.js';
import backupCodesRouter from './backup-codes.js';
import securityRouter from './security.js';

const router = express.Router();

router.use('/mfa', mfaRouter);
router.use('/password', passwordRouter);
router.use('/login', loginRouter);
router.use('/sessions', sessionsRouter);
router.use('/devices', devicesRouter);
router.use('/history', historyRouter);
router.use('/backup-codes', backupCodesRouter);
router.use('/security', securityRouter);

export default router;