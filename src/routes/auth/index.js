import express from 'express';
import passwordRouter from './password.js';
import loginRouter from './login.js';
import historyRouter from './history.js';
import backupCodesRouter from './backup-codes.js';
import securityRouter from './security.js';

const router = express.Router();

router.use('/password', passwordRouter);
router.use('/login', loginRouter);
router.use('/history', historyRouter);
router.use('/backup-codes', backupCodesRouter);
router.use('/security', securityRouter);

export default router;