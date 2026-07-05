import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { isCloudflareIp } from '../../../src/utils/cloudflareIps.js';

// ─── isCloudflareIp: range matching ───────────────────────────────────────────

describe('isCloudflareIp', () => {
  it('matches IPv4 addresses inside Cloudflare ranges', () => {
    expect(isCloudflareIp('104.16.0.1')).toBe(true); // 104.16.0.0/13
    expect(isCloudflareIp('172.68.1.5')).toBe(true); // 172.64.0.0/13
    expect(isCloudflareIp('162.158.42.9')).toBe(true); // 162.158.0.0/15
    expect(isCloudflareIp('198.41.200.14')).toBe(true); // 198.41.128.0/17
  });

  it('matches IPv6 addresses inside Cloudflare ranges', () => {
    expect(isCloudflareIp('2606:4700:3035::ac43:cb2d')).toBe(true); // 2606:4700::/32
    expect(isCloudflareIp('2400:cb00::1234')).toBe(true); // 2400:cb00::/32
  });

  it('matches IPv4-mapped IPv6 forms of Cloudflare IPv4 addresses', () => {
    expect(isCloudflareIp('::ffff:104.16.0.1')).toBe(true);
    expect(isCloudflareIp('::ffff:172.68.1.5')).toBe(true);
  });

  it('rejects addresses outside Cloudflare ranges', () => {
    expect(isCloudflareIp('203.0.113.7')).toBe(false);
    expect(isCloudflareIp('8.8.8.8')).toBe(false);
    expect(isCloudflareIp('10.0.0.1')).toBe(false);
    expect(isCloudflareIp('2001:db8::1')).toBe(false);
    expect(isCloudflareIp('::ffff:203.0.113.7')).toBe(false);
    // near-miss: 104.15.255.255 is just below 104.16.0.0/13
    expect(isCloudflareIp('104.15.255.255')).toBe(false);
  });

  it('never throws on garbage input', () => {
    expect(isCloudflareIp('not-an-ip')).toBe(false);
    expect(isCloudflareIp('')).toBe(false);
    expect(isCloudflareIp(null)).toBe(false);
    expect(isCloudflareIp(undefined)).toBe(false);
    expect(isCloudflareIp('999.999.999.999')).toBe(false);
  });
});

// ─── trust-proxy integration: req.ip resolution ───────────────────────────────
// Replicates the production `trust proxy` setting from src/app.js and verifies
// how Express resolves req.ip for each traffic path. The supertest socket
// plays the role of Vercel's front proxy (hop 0, always trusted); the
// X-Forwarded-For header simulates what the chain would have appended by the
// time the request reaches Express:
//   via Cloudflare:  "client-ip, cf-edge-ip"   (Cloudflare appends the client,
//                                               Vercel appends the CF edge)
//   direct:          "…forged…, attacker-ip"   (Vercel appends the attacker)

function makeApp() {
  const app = express();
  const trustProxyHops = 1;
  app.set('trust proxy', (addr, hop) => hop < trustProxyHops || isCloudflareIp(addr));
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  return app;
}

describe('trust proxy resolves req.ip through Cloudflare', () => {
  it('resolves the real visitor IP when proxied via a Cloudflare edge', async () => {
    const res = await request(makeApp())
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7, 172.68.1.5');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('resolves the real visitor IP behind an IPv6 Cloudflare edge', async () => {
    const res = await request(makeApp())
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7, 2606:4700:3035::ac43:cb2d');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('ignores forged X-Forwarded-For entries sent through Cloudflare', async () => {
    // Attacker sends XFF: "6.6.6.6" through Cloudflare — the walk stops at the
    // first non-Cloudflare hop (their real IP), never reaching the forgery.
    const res = await request(makeApp())
      .get('/ip')
      .set('X-Forwarded-For', '6.6.6.6, 203.0.113.7, 172.68.1.5');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('pins a Cloudflare-bypassing request to its own connecting IP', async () => {
    // Direct hit on the Vercel host with a forged header: the connecting IP
    // (appended by Vercel) is not a Cloudflare address, so the walk stops there.
    const res = await request(makeApp())
      .get('/ip')
      .set('X-Forwarded-For', '6.6.6.6, 198.51.100.9');
    expect(res.body.ip).toBe('198.51.100.9');
  });

  it('falls back to the socket address when no X-Forwarded-For is present', async () => {
    const res = await request(makeApp()).get('/ip');
    // supertest connects over loopback
    expect(['::1', '127.0.0.1', '::ffff:127.0.0.1']).toContain(res.body.ip);
  });
});
