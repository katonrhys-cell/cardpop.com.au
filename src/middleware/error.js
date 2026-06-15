import logger from '../utils/logger.js';
import { NodeEnv } from '../constants/common.js';

const errorMiddleware = (err, req, res, next) => {
	logger.error(err.message, err.stack);

	if (res.headersSent) {
		return next(err);
	}

	res.status(500).json({
		message: 'Something went wrong!',
		// Always expose the actual error message to help diagnose issues
		error: err.message || 'Unknown error',
		...(process.env.NODE_ENV !== NodeEnv.Production && {
			stack: err.stack,
		}),
	});
};

export default errorMiddleware;
export { errorMiddleware };
