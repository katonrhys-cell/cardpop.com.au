import logger from '../utils/logger.js';

const getZodIssues = (error) => {
  if (error.issues) return error.issues;
  try {
    const parsed = JSON.parse(error.message);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const validateRequestBody = (schema) => {
  return async (req, res, next) => {
    try {
      // Replace, don't merge: Object.assign kept every key zod stripped, so a
      // handler that spreads req.body into a write still received unknown
      // (attacker-chosen) columns. Handlers now only ever see the validated shape.
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      const issues = getZodIssues(error).map(e => ({
        path: Array.isArray(e.path) ? e.path.join('.') : e.path,
        message: e.message,
      }));
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
      await schema.parseAsync(req.query);
      next();
    } catch (error) {
      const issues = getZodIssues(error).map(e => ({
        path: Array.isArray(e.path) ? e.path.join('.') : e.path,
        message: e.message,
      }));
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
      await schema.parseAsync(req.params);
      next();
    } catch (error) {
      const issues = getZodIssues(error).map(e => ({
        path: Array.isArray(e.path) ? e.path.join('.') : e.path,
        message: e.message,
      }));
      logger.warn(`Route params validation failed: ${error.message}`);
      res.status(400).json({
        error: 'Invalid route parameters',
        issues,
      });
    }
  };
};
