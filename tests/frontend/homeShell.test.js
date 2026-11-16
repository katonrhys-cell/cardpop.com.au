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
import { DESKTOP_NAV_PLACEHOLDER, NAV_ITEM_CLASS } from '@/components/HeaderNavPlaceholder.jsx';

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
    new Function(bootstrap); // must at least parse
    const hash = `'sha256-${createHash('sha256').update(bootstrap, 'utf8').digest('base64')}'`;
    const headers = vercel.match(/"Content-Security-Policy"/g) || [];
    expect(headers.length).toBeGreaterThan(0);
    expect(vercel.split(hash).length - 1).toBe(headers.length);
  });
});

// The header in the shell is a hand-written copy of what Header.jsx renders on
// its first commit. It drifted once — nine old menu labels, no Sell button, a
// larger ™, no phone search row — and every page load redrew the header when
// React took over. These pin the copy to its sources.
describe('static shell header matches the real header', () => {
  const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
  const shellNav = shell.match(/<nav class="flex items-center justify-evenly w-full">([\s\S]*?)<\/nav>/)[1];
  const shellNavItems = [...shellNav.matchAll(/<a href="([^"]+)" class="([^"]+)">([^<]+)/g)]
    .map(([, href, cls, label]) => ({ href, cls, label: label.trim() }));

  it('nav row carries the placeholder menu’s labels and links, in order', () => {
    expect(shellNavItems.map(({ label, href }) => ({ label, href })))
      .toEqual(DESKTOP_NAV_PLACEHOLDER.map(({ label, href }) => ({ label, href })));
  });

  it('nav row uses the placeholder’s classes', () => {
    for (const item of shellNavItems) expect(item.cls).toContain(NAV_ITEM_CLASS);
    expect(shellNavItems.find((i) => i.label === 'Sell').cls).toContain('text-primary font-bold');
  });

  it('placeholder menu covers every top-level link of the real menus', () => {
    const menus = read('components/HeaderMenus.jsx');
    const navLinks = menus.slice(menus.indexOf('export const NAV_LINKS = ['), menus.indexOf('];', menus.indexOf('export const NAV_LINKS = [')));
    const real = [...navLinks.matchAll(/\{ label: '([^']+)', href: '([^']+)'/g)].map(([, label, href]) => ({ label, href }));
    expect(real.length).toBeGreaterThan(0);
    const placeholder = DESKTOP_NAV_PLACEHOLDER.map(({ label, href }) => ({ label, href }));
    // NAV_LINKS sits between the Buy Cards and More dropdowns.
    expect(placeholder.slice(1, -1)).toEqual(real);
    expect(placeholder[0].label).toBe('Buy Cards');
    expect(placeholder.at(-1).label).toBe('More');
    expect(menus).toContain('Buy Cards');
  });

  it('logo ™ uses the same markup as CardPopLogo', () => {
    const logo = read('components/CardPopLogo.jsx');
    const supClass = 'absolute left-full top-[0.22em] text-[0.65em] font-sans font-normal tracking-normal leading-none';
    expect(logo).toContain(supClass);
    expect(shell).toContain(`<sup class="${supClass} text-foreground">™</sup>`);
  });

  it('has the Sell button and the phone search row the real header renders', () => {
    const header = read('components/Header.jsx');
    expect(header).toContain('aria-label="Sell a card"');
    expect(shell).toContain('aria-label="Sell a card"');
    const mobileSearchRow = 'lg:hidden py-2.5 border-b border-border/40';
    expect(header).toContain(mobileSearchRow);
    expect(shell).toContain(mobileSearchRow);
  });

  it('hero uses the same spacing as HeroSection and HomePage, at every breakpoint', () => {
    const heroSection = read('components/HeroSection.jsx');
    const homePage = read('pages/HomePage.jsx');
    for (const cls of [
      'relative lg:min-h-[92dvh] flex items-start justify-center pt-8 sm:pt-14 pb-10 sm:pb-16 overflow-hidden bg-zinc-950',
      'px-4 py-2 rounded-full mb-5 sm:mb-8 border',
      'text-balance mb-4 sm:mb-6 leading-[1.2] text-white',
      'max-w-lg mb-6 sm:mb-8 leading-relaxed',
      'lg:justify-start gap-3 sm:gap-4 mb-6 sm:mb-10',
    ]) {
      expect(shell).toContain(cls);
      expect(heroSection).toContain(cls);
      expect(homePage).toContain(cls);
    }
  });

  it('default tab title is the static document’s title', () => {
    const staticTitle = read('index.html').match(/<title>([^<]+)<\/title>/)[1];
    expect(read('App.jsx')).toContain(`<title>${staticTitle}</title>`);
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
    for (const cls of ['min-h-[calc(100vh-8rem)]', 'flex flex-col items-center gap-4', 'w-10 h-10 text-primary animate-spin relative z-10']) {
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
