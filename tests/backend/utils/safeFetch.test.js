import { describe, it, expect } from 'vitest';
import { isPrivateIp, assertNotLiteralPrivateAddress, urlHost } from '../../../src/utils/safeFetch.js';

// The SSRF guard is the only thing between attacker-supplied URLs (admin paste
// box, nightly web-search results and their redirects) and the serverless
// runtime's network. These pin the cases the 2026-09-21 audit found open.

describe('urlHost', () => {
  it('strips IPv6 brackets so a literal can be recognised as one', () => {
    expect(urlHost('http://[::1]/')).toBe('::1');
    expect(urlHost('http://[::ffff:127.0.0.1]/')).toBe('::ffff:7f00:1');
    expect(urlHost('http://example.com/')).toBe('example.com');
  });
});

describe('isPrivateIp', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '0.0.0.0', '100.64.0.1', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fd00::1', 'fc00::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::7f00:1', '2002:7f00:1::1',
  ])('treats %s as private', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '203.0.114.1', '2606:4700::1111', '::ffff:8.8.8.8'])('treats %s as public', (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });

  it('fails closed on garbage', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
    expect(isPrivateIp('')).toBe(true);
  });
});

describe('assertNotLiteralPrivateAddress', () => {
  it.each([
    'http://127.0.0.1/', 'http://0x7f000001/', 'http://2130706433/', 'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/', 'http://[::ffff:169.254.169.254]/',
    'http://[fe80::1]/', 'http://[fd00::1]/', 'http://[64:ff9b::7f00:1]/',
    'http://localhost/', 'http://LOCALHOST:8080/', 'http://foo.localhost/',
  ])('blocks %s', (url) => {
    expect(() => assertNotLiteralPrivateAddress(url)).toThrow(/Blocked/);
  });

  it.each(['https://example.com/', 'http://8.8.8.8/', 'http://[2606:4700::1111]/'])('allows %s', (url) => {
    expect(() => assertNotLiteralPrivateAddress(url)).not.toThrow();
  });
});
