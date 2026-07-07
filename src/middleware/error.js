import logger from '../utils/logger.js';
import { NodeEnv } from '../constants/common.js';

const errorMiddleware = (err, req, res, next) => {
	logger.error(err.message, err.stack);

	if (res.headersSent) {
		return next(err);
	}

	// Fail closed: only expose error details when NODE_ENV is explicitly
	// 'development'. The previous check (NODE_ENV === Production) inverted
	// this — if NODE_ENV were ever unset or misconfigured in a deploy, it
	// would fall through to the verbose branch and leak stack traces.
	const isProd = process.env.NODE_ENV !== NodeEnv.Development;
	res.status(500).json({
		message: isProd ? 'Something went wrong!' : (err.message || 'Unknown error'),
		...(!isProd && { stack: err.stack }),
	});
};

export default errorMiddleware;
export { errorMiddleware };
