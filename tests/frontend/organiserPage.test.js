import { describe, it, expect } from 'vitest';
import { organiserLinks, canEditOrganiserPage, organiserMetaDescription } from '@/utils/organiserPage.js';

describe('organiserLinks', () => {
  it('keeps present http(s) links in display order and drops the rest', () => {
    const links = organiserLinks({
      youtube_url: 'https://youtube.com/@show',
      website_url: 'https://show.com.au',
      instagram_url: 'javascript:alert(1)',
      facebook_url: null,
    });
    expect(links.map((l) => l.key)).toEqual(['website_url', 'youtube_url']);
  });
  it('handles a missing organiser', () => {
    expect(organiserLinks(null)).toEqual([]);
  });
});

describe('canEditOrganiserPage', () => {
  const org = { owner_id: 'u1' };
  it('lets the owner and any admin edit', () => {
    expect(canEditOrganiserPage(org, 'u1', false)).toBe(true);
    expect(canEditOrganiserPage(org, 'u2', true)).toBe(true);
  });
  it('refuses everyone else, including signed-out visitors and unowned pages', () => {
    expect(canEditOrganiserPage(org, 'u2', false)).toBe(false);
    expect(canEditOrganiserPage(org, null, false)).toBe(false);
    expect(canEditOrganiserPage({ owner_id: null }, null, false)).toBe(false);
    expect(canEditOrganiserPage(null, 'u1', true)).toBe(false);
  });
});

describe('organiserMetaDescription', () => {
  const fallback = 'Generated summary.';
  it('uses the fallback until the organiser has written something', () => {
    expect(organiserMetaDescription({ description: null }, fallback)).toBe(fallback);
    expect(organiserMetaDescription({ description: '  \n ' }, fallback)).toBe(fallback);
    expect(organiserMetaDescription(null, fallback)).toBe(fallback);
  });
  it('collapses whitespace and keeps short text whole', () => {
    expect(organiserMetaDescription({ description: 'Line one.\n\nLine   two.' }, fallback)).toBe('Line one. Line two.');
  });
  it('cuts long text at a word boundary within 155 characters, with an ellipsis', () => {
    const long = 'word '.repeat(80).trim();
    const out = organiserMetaDescription({ description: long }, fallback);
    expect(out.length).toBeLessThanOrEqual(156);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });
});
