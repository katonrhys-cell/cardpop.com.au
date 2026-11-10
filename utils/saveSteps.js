// Run a multi-step browser save (uploads, then database writes) so that it can
// never spin forever. Each step is named while it runs (so the button can say
// what it's doing) and given a deadline; a step that blows its deadline fails
// with a message naming the step, and is reported so we learn which step
// stalls instead of hearing "it just kept loading" (docs/event-submissions.md).
//
// A timed-out step isn't cancelled — the browser may still finish it — so the
// messages tell the person to check before retrying a database write.

export class SaveStepTimeoutError extends Error {
  constructor(label, ms) {
    super(`This is taking too long (${label.toLowerCase()} for over ${Math.round(ms / 1000)} seconds). `
      + 'Check your connection and try again.');
    this.name = 'SaveStepTimeoutError';
    this.step = label;
    this.timeoutMs = ms;
  }
}

export const UPLOAD_STEP_TIMEOUT_MS = 90_000;
export const WRITE_STEP_TIMEOUT_MS = 30_000;

/** Resolve/reject with `promise`, or reject with SaveStepTimeoutError after `ms`. */
export function withStepTimeout(promise, ms, label) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new SaveStepTimeoutError(label, ms)), ms);
  });
  return Promise.race([Promise.resolve(promise), deadline]).finally(() => clearTimeout(timer));
}

/**
 * A runner bound to one save: `run(label, fn, ms)` shows `label`, runs `fn()`
 * under the deadline, and reports a timeout through `onTimeout(err)`.
 */
export function createStepRunner({ onStep, onTimeout } = {}) {
  return async function run(label, fn, ms = WRITE_STEP_TIMEOUT_MS) {
    onStep?.(label);
    try {
      return await withStepTimeout(fn(), ms, label);
    } catch (err) {
      if (err instanceof SaveStepTimeoutError) {
        try { onTimeout?.(err); } catch { /* reporting must never mask the error */ }
      }
      throw err;
    }
  };
}

/** Report a stalled step to Sentry (best-effort; the SDK loads lazily). */
export function reportStalledStep(err, context = {}) {
  import('@sentry/react')
    .then((Sentry) => Sentry.captureException(err, {
      tags: { save_step: err.step, save_form: context.form || 'unknown' },
      extra: { timeoutMs: err.timeoutMs, ...context },
    }))
    .catch(() => {});
}
