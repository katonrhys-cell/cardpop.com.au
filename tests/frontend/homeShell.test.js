import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { WELCOME_DISCOUNT_PCT } from '@/config/welcomeOffer.js';
import { CONSENT_STORAGE_KEY } from '@/lib/consent.js';
import { AUTH_TOKEN_STORAGE_KEY } from '@/components/AnnouncementBar.jsx';

// The static homepage shell is what the first paint shows before any JS runs.
// It must match what React renders on its first commit (or the takeover shifts
// the layout) and stay inert, and the CSP bootstrap that trims it for
// returning visitors must agree with the app on element ids and storage keys.

const root = process.cwd();
// Comments stripped: the file's own notes mention <button> in prose.
const shell = readFileSync(path.join(root, 'tools/home-shell.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
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

  it('bootstrap defers the JS/CSS fetches until after the first paint', () => {
    expect(bootstrap).toContain('requestAnimationFrame');
    expect(bootstrap).toContain('visibilityState');
    expect(bootstrap).toContain('data-async-style');
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
