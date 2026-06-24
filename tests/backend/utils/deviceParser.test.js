import { describe, it, expect } from 'vitest';
import { parseUserAgent, getDeviceName } from '../../../src/utils/deviceParser.js';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('parseUserAgent', () => {
  it('extracts browser, os and device from a desktop UA', () => {
    const result = parseUserAgent(CHROME_MAC);
    expect(result.browser).toBe('Chrome');
    expect(result.os).toMatch(/Mac/); // ua-parser-js reports "Mac OS"
    expect(result.device).toBe('desktop'); // ua-parser returns no type for desktop → default
  });

  it('reports a mobile device type for a phone UA', () => {
    const result = parseUserAgent(SAFARI_IPHONE);
    expect(result.browser).toBe('Mobile Safari');
    expect(result.os).toBe('iOS');
    expect(result.device).toBe('mobile');
  });

  it('falls back to "Unknown" / "desktop" for an unrecognizable UA', () => {
    const result = parseUserAgent('not-a-real-user-agent');
    expect(result.browser).toBe('Unknown');
    expect(result.os).toBe('Unknown');
    expect(result.device).toBe('desktop');
  });

  it('handles an empty user-agent string', () => {
    const result = parseUserAgent('');
    expect(result).toEqual({ browser: 'Unknown', os: 'Unknown', device: 'desktop' });
  });
});

describe('getDeviceName', () => {
  it('formats a human-readable "browser on os" label', () => {
    expect(getDeviceName(SAFARI_IPHONE)).toBe('Mobile Safari on iOS');
  });

  it('uses the Unknown fallbacks when nothing parses', () => {
    expect(getDeviceName('')).toBe('Unknown on Unknown');
  });
});
