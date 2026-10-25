import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { WELCOME_DISCOUNT_PCT } from '@/config/welcomeOffer.js';
import { CONSENT_STORAGE_KEY } from '@/lib/consent.js';
import { AUTH_TOKEN_STORAGE_KEY, QUIET_PREFIXES as ANNOUNCEMENT_QUIET } from '@/components/AnnouncementBar.jsx';
import { QUIET_PREFIXES as COOKIE_QUIET } from '@/components/CookieConsentBanner.jsx';
import { appShellFromHomeShell, APP_SHELL_MAIN } from '../../tools/appShell.mjs';

// The static homepage shell is what the first paint shows before any JS runs.
// It must match what React renders on its first commit (or the takeover shifts
// the layout) and stay inert, and the CSP bootstrap that trims it for
// returning visitors must agree with the app on element ids and storage keys.

const root = process.cwd();
const rawShell = readFileSync(path.join(root, 'tools/home-shell.html'), 'utf8');
// Comments stripped: the file's own notes mention <button> in prose.
const shell = rawShell.replace(/<!--[\s\S]*?-->/g, '');
const viteConfig = readFileSync(path.join(root, 'vite.config.js'), 'utf8');
const vercel = readFileSync(path.join(root, 'vercel.json'), 'utf8');
const bootstrap = viteConfig.match(/const CSP_BOOTSTRAP = '(.*)';/)[1];

describe('static homepage shell', () => {
  it('has no interactive <button> beyond the hero search submit (controls are inert until React mounts)', () => {
    const buttons = shell.match(/<button\b[^>]*>/gi) || [];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toMatch(/type="submit"/);
  });

  it('shows the same welcome offer as config/welcomeOffer.js', () => {
    expect(shell).toContain(`${WELCOME_DISCOUNT_PCT}% off your first order`);
  });

  it('carries the announcement bar and cookie banner the bootstrap knows how to remove', () => {
    for (const id of ['cardpop-shell-announcement', 'cardpop-shell-cookie']) {
      expect(shell).toContain(`id="${id}"`);
      expect(bootstrap).toContain(`#${id}`);
    }
  });

  it('bootstrap reads the same storage keys as the app', () => {
    expect(bootstrap).toContain(`"${CONSENT_STORAGE_KEY}"`);
    expect(bootstrap).toContain(`"${AUTH_TOKEN_STORAGE_KEY}"`);
    expect(bootstrap).toContain('"cardpop_announcement_dismissed"');
  });

  it('bootstrap applies the dark theme before first paint, like hooks/useDarkMode.js', () => {
    const hook = readFileSync(path.join(root, 'hooks/useDarkMode.js'), 'utf8');
    const key = hook.match(/const STORAGE_KEY = '([^']+)'/)[1];
    expect(bootstrap).toContain(`localStorage.getItem("${key}")`);
    expect(bootstrap).toContain('matchMedia("(prefers-color-scheme: dark)")');
    expect(bootstrap).toContain('document.documentElement.classList.add("dark")');
  });

  it('bootstrap hides the shell banners on the same quiet routes as the components', () => {
    // Otherwise the shell paints a banner on e.g. /login that React never
    // renders, and it vanishes on mount — the page jumps up by its height.
    expect(bootstrap).toContain(`qp("${ANNOUNCEMENT_QUIET.join(',')}")`);
    expect(bootstrap).toContain(`qp("${COOKIE_QUIET.join(',')}")`);
  });

  it('bootstrap defers the JS/CSS fetches until after the first paint', () => {
    expect(bootstrap).toContain('requestAnimationFrame');
    expect(bootstrap).toContain('visibilityState');
    expect(bootstrap).toContain('data-async-style');
  });

  it('bootstrap preloads the current route’s chunk graph from data-route-preload', () => {
    expect(bootstrap).toContain('d.routePreload');
    expect(bootstrap).toContain('location.pathname');
    // Only the bare chunk basename travels in the map; the URL is rebuilt and
    // re-validated against /assets/*.js.
    expect(bootstrap).toContain('"/assets/"+n+".js"');
    // It contains no backslash escapes: this test hashes the raw source text,
    // and an escape would make that differ from the runtime string.
    expect(bootstrap).not.toContain('\\');
  });

  it('bootstrap hands the deferred stylesheet to main.jsx on every document', () => {
    // inlineCriticalCss runs for index.html AND app.html; both rely on the
    // bootstrap injecting data-css as a media="print" data-async-style link.
    expect(viteConfig).toMatch(/inlineCriticalCss\([^)]*'app-shell'/);
    expect(viteConfig).toMatch(/inlineCriticalCss\([^)]*'home-shell'/);
  });

  it('bootstrap hash is pinned in every CSP header in vercel.json', () => {
    // eslint-disable-next-line no-new-func
    new Function(bootstrap); // must at least parse
    const hash = `'sha256-${createHash('sha256').update(bootstrap, 'utf8').digest('base64')}'`;
    const headers = vercel.match(/"Content-Security-Policy"/g) || [];
    expect(headers.length).toBeGreaterThan(0);
    expect(vercel.split(hash).length - 1).toBe(headers.length);
  });
});

// app.html (every route but "/") paints the same chrome from HTML, derived at
// build time from the homepage shell so the header can't drift between the two
// documents, with the route loader where the hero was.
describe('static app shell', () => {
  const appShell = appShellFromHomeShell(rawShell);

  it('keeps the announcement bar, header and cookie banner', () => {
    for (const id of ['cardpop-shell-announcement', 'cardpop-shell-cookie']) {
      expect(appShell).toContain(`id="${id}"`);
    }
    expect(appShell).toContain('<header');
    expect(appShell).toContain('aria-label="CardPop — back to home"');
  });

  it('drops the homepage hero and shows the route loader instead', () => {
    expect(appShell).not.toContain('<h1');
    expect(appShell).not.toContain('Buy and Sell Trading Cards');
    expect(appShell).toContain(APP_SHELL_MAIN);
    // One <main>, and it is the loader.
    expect(appShell.match(/<main\b/g)).toHaveLength(1);
  });

  it('mirrors PageLoader.jsx so React’s first commit moves nothing', () => {
    const loader = readFileSync(path.join(root, 'components/PageLoader.jsx'), 'utf8');
    for (const cls of ['min-h-[calc(100vh-8rem)]', 'animate-in fade-in duration-500', 'w-10 h-10 text-primary animate-spin relative z-10']) {
      expect(loader).toContain(cls);
      expect(APP_SHELL_MAIN).toContain(cls);
    }
    expect(loader).toContain('Loading content...');
    expect(APP_SHELL_MAIN).toContain('Loading content...');
  });

  it('is fully inert (no <button> at all)', () => {
    expect(appShell.match(/<button\b/gi) || []).toHaveLength(0);
  });

  it('refuses a shell without a <main> rather than shipping the hero everywhere', () => {
    expect(() => appShellFromHomeShell('<div id="x"></div>')).toThrow(/<main>/);
  });
});
