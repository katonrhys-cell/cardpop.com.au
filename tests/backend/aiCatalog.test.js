import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// public/.well-known/ai-catalog.json is validated by Lighthouse's "Agentic
// Browsing → Agent Discoverability" audit (ard-schema) against the ARD spec.
// Before it existed, the SPA catch-all served app.html at that path with a 200,
// which the audit read as an invalid catalog. These checks mirror the spec's
// schema and the conformance suite Lighthouse bundles, so an edit that would
// turn the audit red fails here first.
const PUBLIC = path.resolve(__dirname, '../../public');
const catalog = JSON.parse(
  fs.readFileSync(path.join(PUBLIC, '.well-known/ai-catalog.json'), 'utf8'),
);

const URN = /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/;
const DISCOVERY_TYPES = [
  'application/ai-catalog+json',
  'application/agent-card+json',
  'application/a2a-agent-card+json',
  'application/mcp-server-card+json',
  'application/agent-skills+zip',
  'application/agent-skills+gzip',
  'text/markdown; profile="urn:air:agent-skills"',
  'application/ai-registry',
  'application/ai-registry+json',
];

describe('ai-catalog.json (ARD manifest)', () => {
  it('has only the allowed root properties and specVersion 1.0', () => {
    expect(catalog.specVersion).toBe('1.0');
    expect(Object.keys(catalog).sort()).toEqual(['entries', 'host', 'specVersion']);
    expect(catalog.host.displayName).toBeTruthy();
    for (const key of Object.keys(catalog.host)) {
      expect(['displayName', 'identifier', 'documentationUrl', 'logoUrl', 'trustManifest']).toContain(key);
    }
  });

  it.each(catalog.entries.map((e) => [e.identifier, e]))('%s conforms', (_id, entry) => {
    expect(entry.identifier).toMatch(URN);
    expect(entry.displayName).toBeTruthy();
    expect(DISCOVERY_TYPES).toContain(entry.type);
    expect('url' in entry !== 'data' in entry).toBe(true);
    expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2);
    expect(entry.representativeQueries.length).toBeLessThanOrEqual(5);
  });

  it('points only at well-known files that exist in public/', () => {
    for (const { url } of catalog.entries) {
      const { hostname, pathname } = new URL(url);
      expect(hostname).toBe('cardpop.com.au');
      expect(fs.existsSync(path.join(PUBLIC, pathname))).toBe(true);
    }
  });

  it('is served with its own media type rather than the SPA fallback', () => {
    const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'));
    const rule = vercel.headers.find((h) => h.source === '/.well-known/ai-catalog.json');
    expect(rule.headers).toContainEqual({
      key: 'Content-Type',
      value: 'application/ai-catalog+json; charset=utf-8',
    });
  });
});
