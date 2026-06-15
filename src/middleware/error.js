import logger from '../utils/logger.js';
import { NodeEnv } from '../constants/common.js';

const errorMiddleware = (err, req, res, next) => {
	logger.error(err.message, err.stack);

	if (res.headersSent) {
		return next(err);
	}

	const isProd = process.env.NODE_ENV === NodeEnv.Production;
	res.status(500).json({
		message: isProd ? 'Something went wrong!' : (err.message || 'Unknown error'),
		...(!isProd && { stack: err.stack }),
	});
};

export default errorMiddleware;
export { errorMiddleware };
