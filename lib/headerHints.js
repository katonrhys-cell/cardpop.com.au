// What the header knew about this browser's member last time, used ONLY to
// size the header before the session has been checked — never to decide what a
// visitor may see or do (isAdmin from the profile still gates the Admin link's
// target, and /admin is guarded server- and client-side).
//
// A signed-in admin's header carries an extra "Admin" button at xl. Without a
// hint the static shell and React's first commit can't know to leave room for
// it, so it popped in once the profile loaded and shoved every icon left. The
// CSP bootstrap (vite.config.js) reads the same key to size the static shell —
// change the key there too (tests/frontend/homeShell.test.js checks).
export const ADMIN_HINT_STORAGE_KEY = 'cardpop_admin_hint';

export const readAdminHint = () => {
  try { return window.localStorage.getItem(ADMIN_HINT_STORAGE_KEY) === '1'; } catch { return false; }
};

export const writeAdminHint = (isAdmin) => {
  try {
    if (isAdmin) window.localStorage.setItem(ADMIN_HINT_STORAGE_KEY, '1');
    else window.localStorage.removeItem(ADMIN_HINT_STORAGE_KEY);
  } catch { /* storage blocked — the header just can't pre-size next time */ }
};
