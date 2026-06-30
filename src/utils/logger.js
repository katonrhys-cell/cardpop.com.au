const logger = {
  // Application errors - goes to stdout
  error: (msg, err) => {
    const logObj = { level: 'error', msg };
    if (err instanceof Error) {
      logObj.error = err.message;
      logObj.stack = err.stack;
    } else if (err) {
      logObj.error = String(err);
    }
    console.error(JSON.stringify(logObj));
  },

  // Critical system errors - goes to stderr
  fatal: (msg, err) => {
    const logObj = { level: 'fatal', msg };
    if (err instanceof Error) {
      logObj.error = err.message;
      logObj.stack = err.stack;
    } else if (err) {
      logObj.error = String(err);
    }
    console.error(JSON.stringify(logObj));
  },

  info: (msg) => {
    console.log(JSON.stringify({ level: 'info', msg }));
  },

  debug: (msg) => {
    console.log(JSON.stringify({ level: 'debug', msg }));
  },

  warn: (msg) => {
    console.log(JSON.stringify({ level: 'warn', msg }));
  }
};

export default logger;

export { logger };

