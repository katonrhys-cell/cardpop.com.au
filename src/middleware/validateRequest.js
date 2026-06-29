import logger from '../utils/logger.js';

export const validateRequestBody = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      const issues = error.errors?.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })) || [];
      logger.warn(`Request validation failed: ${error.message}`);
      res.status(400).json({
        error: 'Invalid request body',
        issues,
      });
    }
  };
};

export const validateRequestQuery = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated;
      next();
    } catch (error) {
      const issues = error.errors?.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })) || [];
      logger.warn(`Query validation failed: ${error.message}`);
      res.status(400).json({
        error: 'Invalid query parameters',
        issues,
      });
    }
  };
};

export const validateRequestParams = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated;
      next();
    } catch (error) {
      const issues = error.errors?.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })) || [];
      logger.warn(`Route params validation failed: ${error.message}`);
      res.status(400).json({
        error: 'Invalid route parameters',
        issues,
      });
    }
  };
};
