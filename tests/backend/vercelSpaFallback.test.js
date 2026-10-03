import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'));
const fallback = vercel.rewrites.find((r) => r.destination === '/app.html');
// Vercel sources are path-to-regexp; this one is a plain regex group.
const matches = (pathname) => new RegExp(`^${fallback.source}$`).test(pathname);

// /images/ and /assets/ are served with a one-year immutable Cache-Control.
// If a missing file there fell through to app.html, the browser, the service
// worker and Cloudflare would all keep that HTML under the file's URL for a
// year — a product photo requested before its deploy finished stayed broken.
describe('vercel.json SPA fallback', () => {
  it('serves the app shell for client-side routes', () => {
    expect(matches('/')).toBe(true);
    expect(matches('/shop/graded-card-protectors/metal-slab-case')).toBe(true);
    expect(matches('/admin/products')).toBe(true);
  });

  it('never stands in for a missing static file', () => {
    expect(matches('/images/shop/metal-slab-case/black/cp-metal-slab-psa35-blk_front.jpg')).toBe(false);
    expect(matches('/assets/index-deadbeef.js')).toBe(false);
  });

  it('is the last rewrite, so every specific route is tried first', () => {
    expect(vercel.rewrites.at(-1)).toBe(fallback);
  });
});
