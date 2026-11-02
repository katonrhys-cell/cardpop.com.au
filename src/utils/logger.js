// Fields a plain-object error (a Supabase/PostgREST error, a Stripe-style
// response body, a fetch Response) commonly carries. They are copied through
// so the log line names the real cause instead of "[object Object]".
const ERROR_DETAIL_KEYS = ['code', 'details', 'hint', 'status', 'statusCode', 'type'];

// Turns whatever was passed as the error into the fields the log line carries.
// Errors keep message + stack; plain objects (Supabase client errors are not
// Error instances) contribute their message and known detail fields; anything
// else is stringified. Never throws — a logging call must not take the
// request down with it.
export const describeError = (err) => {
  if (err === undefined || err === null) return {};
  if (err instanceof Error) {
    const out = { error: err.message, stack: err.stack };
    for (const key of ERROR_DETAIL_KEYS) {
      if (err[key] !== undefined && err[key] !== null) out[key] = err[key];
    }
    return out;
  }
  if (typeof err === 'object') {
    const out = {};
    if (err.message !== undefined && err.message !== null && err.message !== '') {
      out.error = String(err.message);
    }
    for (const key of ERROR_DETAIL_KEYS) {
      if (err[key] !== undefined && err[key] !== null) out[key] = err[key];
    }
    if (!out.error) {
      try {
        out.error = JSON.stringify(err);
      } catch {
        out.error = String(err);
      }
    }
    return out;
  }
  return { error: String(err) };
};

const logger = {
  // Application errors - goes to stdout
  error: (msg, err) => {
    console.error(JSON.stringify({ level: 'error', msg, ...describeError(err) }));
  },

  // Critical system errors - goes to stderr
  fatal: (msg, err) => {
    console.error(JSON.stringify({ level: 'fatal', msg, ...describeError(err) }));
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

