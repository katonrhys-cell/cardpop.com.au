import { describe, it, expect } from 'vitest';
import ipKeyGenerator from '../../../src/utils/ipKeyGenerator.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

// Builds a minimal Express-like request object
function makeReq({ forwardedFor, ip, connectionAddr, socketAddr } = {}) {
  return {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    ip: ip ?? null,
    connection: connectionAddr ? { remoteAddress: connectionAddr } : null,
    socket: socketAddr ? { remoteAddress: socketAddr } : null,
  };
}

// ─── x-forwarded-for header ───────────────────────────────────────────────────

describe('x-forwarded-for header', () => {
  it('returns the IP from a single-entry x-forwarded-for header', () => {
    expect(ipKeyGenerator(makeReq({ forwardedFor: '203.0.113.5' }))).toBe('203.0.113.5');
  });

  it('returns only the first IP from a multi-entry x-forwarded-for header', () => {
    expect(ipKeyGenerator(makeReq({ forwardedFor: '203.0.113.5, 10.0.0.1, 172.16.0.1' }))).toBe('203.0.113.5');
  });

  it('trims whitespace from the extracted IP', () => {
    expect(ipKeyGenerator(makeReq({ forwardedFor: '  203.0.113.5  , 10.0.0.1' }))).toBe('203.0.113.5');
  });

  it('strips the ::ffff: prefix from an IPv4-mapped IPv6 address in x-forwarded-for', () => {
    expect(ipKeyGenerator(makeReq({ forwardedFor: '::ffff:192.168.1.1' }))).toBe('192.168.1.1');
  });

  it('x-forwarded-for takes precedence over req.ip', () => {
    const req = { ...makeReq({ forwardedFor: '203.0.113.5' }), ip: '10.0.0.1' };
    expect(ipKeyGenerator(req)).toBe('203.0.113.5');
  });
});

// ─── req.ip fallback ──────────────────────────────────────────────────────────

describe('req.ip fallback', () => {
  it('returns req.ip when no x-forwarded-for header is present', () => {
    expect(ipKeyGenerator(makeReq({ ip: '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('strips ::ffff: prefix from req.ip', () => {
    expect(ipKeyGenerator(makeReq({ ip: '::ffff:10.0.0.1' }))).toBe('10.0.0.1');
  });
});

// ─── connection / socket fallbacks ───────────────────────────────────────────

describe('connection.remoteAddress fallback', () => {
  it('uses connection.remoteAddress when no header or req.ip is available', () => {
    expect(ipKeyGenerator(makeReq({ connectionAddr: '192.0.2.50' }))).toBe('192.0.2.50');
  });

  it('strips ::ffff: prefix from connection.remoteAddress', () => {
    expect(ipKeyGenerator(makeReq({ connectionAddr: '::ffff:192.0.2.50' }))).toBe('192.0.2.50');
  });
});

describe('socket.remoteAddress fallback', () => {
  it('uses socket.remoteAddress as the last resort before unknown', () => {
    expect(ipKeyGenerator(makeReq({ socketAddr: '192.0.2.99' }))).toBe('192.0.2.99');
  });

  it('connection.remoteAddress takes precedence over socket.remoteAddress', () => {
    const req = makeReq({ connectionAddr: '192.0.2.50', socketAddr: '192.0.2.99' });
    expect(ipKeyGenerator(req)).toBe('192.0.2.50');
  });
});

describe('unknown fallback', () => {
  it('returns "unknown" when no IP source is available', () => {
    expect(ipKeyGenerator({ headers: {}, ip: null, connection: null, socket: null })).toBe('unknown');
  });
});

// ─── normalizeIp — IPv4-mapped IPv6 ──────────────────────────────────────────

describe('normalizeIp — IPv4-mapped IPv6', () => {
  it('strips lowercase ::ffff: prefix', () => {
    expect(ipKeyGenerator(makeReq({ ip: '::ffff:10.20.30.40' }))).toBe('10.20.30.40');
  });

  it('strips uppercase ::FFFF: prefix (case-insensitive)', () => {
    expect(ipKeyGenerator(makeReq({ ip: '::FFFF:10.20.30.40' }))).toBe('10.20.30.40');
  });

  it('strips mixed-case ::Ffff: prefix', () => {
    expect(ipKeyGenerator(makeReq({ ip: '::Ffff:10.20.30.40' }))).toBe('10.20.30.40');
  });
});

// ─── normalizeIp — IPv6 zone IDs ──────────────────────────────────────────────

describe('normalizeIp — IPv6 zone IDs', () => {
  it('strips the zone ID from a link-local IPv6 address', () => {
    expect(ipKeyGenerator(makeReq({ ip: 'fe80::1%eth0' }))).toBe('fe80::1');
  });

  it('strips a numeric zone ID', () => {
    expect(ipKeyGenerator(makeReq({ ip: 'fe80::1%3' }))).toBe('fe80::1');
  });
});

// ─── plain addresses pass through unchanged ───────────────────────────────────

describe('plain addresses', () => {
  it('returns a standard IPv4 address unchanged', () => {
    expect(ipKeyGenerator(makeReq({ ip: '203.0.113.1' }))).toBe('203.0.113.1');
  });

  it('returns a full IPv6 address unchanged', () => {
    expect(ipKeyGenerator(makeReq({ ip: '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('returns localhost unchanged', () => {
    expect(ipKeyGenerator(makeReq({ ip: '127.0.0.1' }))).toBe('127.0.0.1');
  });
});
