// Google Customer Reviews requires the HTML5 DOCTYPE to be the very first thing
// in the order-confirmation page — no byte-order mark, comment or whitespace
// before it (docs/google-customer-reviews.md). The confirmation page is served
// from the built app.html, and "/" from the built index.html, both derived
// from the source index.html by the home-shell build plugin (vite.config.js),
// so the guarantee has to hold on the EMITTED files, not just the source.
//
// Pure string work: used by the build plugin to fail the build and by
// tests/frontend/indexDoctype.test.js.

export const HTML5_DOCTYPE = '<!DOCTYPE html>';

/**
 * Returns null when `html` starts with `<!DOCTYPE html>` and nothing before
 * it, else a short description of what precedes it.
 */
export const doctypeProblem = (html) => {
  const text = String(html ?? '');
  if (text.startsWith(HTML5_DOCTYPE)) return null;
  if (text.charCodeAt(0) === 0xfeff) return 'a byte-order mark precedes the DOCTYPE';
  if (/^\s/.test(text)) return 'whitespace precedes the DOCTYPE';
  if (text.startsWith('<!--')) return 'a comment precedes the DOCTYPE';
  if (/^<!doctype html>/i.test(text)) return `the DOCTYPE is not spelled exactly ${HTML5_DOCTYPE}`;
  return `the document does not start with ${HTML5_DOCTYPE}`;
};
