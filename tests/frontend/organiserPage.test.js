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
  it('includes TikTok, X and Linktree after YouTube, http(s) only', () => {
    const links = organiserLinks({
      linktree_url: 'https://linktr.ee/show',
      x_url: 'https://x.com/show',
      tiktok_url: 'https://tiktok.com/@show',
      youtube_url: 'https://youtube.com/@show',
    });
    expect(links.map((l) => [l.key, l.label])).toEqual([
      ['youtube_url', 'YouTube'], ['tiktok_url', 'TikTok'], ['x_url', 'X'], ['linktree_url', 'Linktree'],
    ]);
    expect(organiserLinks({ x_url: 'javascript:alert(1)', tiktok_url: 'ftp://x' })).toEqual([]);
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

describe('organiserLogos (joint organisers)', () => {
  it('lists the primary logo first, then the extras, http(s) only and de-duplicated', async () => {
    const { organiserLogos } = await import('@/utils/organiserPage.js');
    expect(organiserLogos({
      logo_url: 'https://x.test/a.png',
      extra_logo_urls: ['https://x.test/b.png', 'javascript:alert(1)', 'https://x.test/a.png', ' https://x.test/c.png '],
    })).toEqual(['https://x.test/a.png', 'https://x.test/b.png', 'https://x.test/c.png']);
  });
  it('copes with a missing column or no logo', async () => {
    const { organiserLogos } = await import('@/utils/organiserPage.js');
    expect(organiserLogos({ logo_url: 'https://x.test/a.png' })).toEqual(['https://x.test/a.png']);
    expect(organiserLogos(null)).toEqual([]);
  });
});

describe('organiser page photos and videos columns', () => {
  it('reads gallery_albums and videos only in the full column set', async () => {
    const m = await import('@/utils/organiserPage.js');
    expect(m.ORGANISER_PAGE_COLUMNS).toContain('gallery_albums');
    expect(m.ORGANISER_PAGE_COLUMNS).toContain('videos');
    expect(m.ORGANISER_LINK_COLUMNS).not.toContain('gallery_albums');
  });
});

describe('organiser contact details', () => {
  it('returns the email and phone the organiser entered, with a dialable tel link', async () => {
    const { organiserContact } = await import('@/utils/organiserPage.js');
    expect(organiserContact({ contact_name: ' Sam ', contact_email: ' hello@show.com.au ', contact_phone: '(03) 5555  1234' }))
      .toEqual({ name: 'Sam', email: 'hello@show.com.au', phone: '(03) 5555 1234', telHref: 'tel:0355551234' });
    expect(organiserContact({ contact_phone: '+61 400 000 000' }).telHref).toBe('tel:+61400000000');
  });
  it('drops malformed values, and a name with no way to get in touch', async () => {
    const { organiserContact, cleanContactEmail, cleanContactPhone } = await import('@/utils/organiserPage.js');
    expect(organiserContact({ contact_name: 'Sam', contact_email: 'not-an-email', contact_phone: 'call me' }))
      .toEqual({ name: '', email: '', phone: '', telHref: '' });
    expect(organiserContact(null)).toEqual({ name: '', email: '', phone: '', telHref: '' });
    expect(cleanContactEmail('a b@c.com')).toBe('');
    expect(cleanContactPhone('12')).toBe('');
  });
  it('reads the contact columns only in their own column set', async () => {
    const m = await import('@/utils/organiserPage.js');
    expect(m.ORGANISER_CONTACT_COLUMNS).toContain('contact_email');
    expect(m.ORGANISER_PAGE_COLUMNS).not.toContain('contact_');
  });
});

describe('organiserBlanksFromEvent', () => {
  const event = {
    organizer_logo_url: 'https://x.test/logo.png', website_url: 'https://show.test', instagram_url: 'https://instagram.com/show',
    youtube_channel_url: 'https://youtube.com/@show', organizer_email: 'hello@show.test', organizer_phone: '0400 000 000', x_url: 'javascript:alert(1)',
  };
  it('fills only the blank fields the page row has, mapping event fields to page columns', async () => {
    const { organiserBlanksFromEvent } = await import('@/utils/organiserPage.js');
    const org = { logo_url: 'https://x.test/kept.png', website_url: null, instagram_url: '', youtube_url: null, x_url: null, contact_email: null, contact_phone: 'kept' };
    expect(organiserBlanksFromEvent(org, event)).toEqual({
      patch: { website_url: 'https://show.test', instagram_url: 'https://instagram.com/show', youtube_url: 'https://youtube.com/@show', contact_email: 'hello@show.test' },
      labels: ['website', 'Instagram', 'YouTube', 'contact email'],
    });
  });
  it('never writes a column the row was read without, and copes with nothing to add', async () => {
    const { organiserBlanksFromEvent } = await import('@/utils/organiserPage.js');
    expect(organiserBlanksFromEvent({ website_url: 'https://a.test' }, event)).toEqual({ patch: {}, labels: [] });
    expect(organiserBlanksFromEvent(null, event)).toEqual({ patch: {}, labels: [] });
  });
});

describe('organiser contact page link', () => {
  it('is read only in the top column set, behind the contact-details tier', async () => {
    const m = await import('@/utils/organiserPage.js');
    expect(m.ORGANISER_ENQUIRY_COLUMNS).toContain('contact_url');
    expect(m.ORGANISER_ENQUIRY_COLUMNS).toContain('contact_email');
    expect(m.ORGANISER_CONTACT_COLUMNS).not.toContain('contact_url');
  });

  it('admits http(s) links only and is not a social profile', async () => {
    const { organiserContactUrl, organiserLinks } = await import('@/utils/organiserPage.js');
    const url = 'https://events.ticketleap.com/event/2149932/contact';
    expect(organiserContactUrl({ contact_url: ` ${url} ` })).toBe(url);
    expect(organiserContactUrl({ contact_url: 'javascript:alert(1)' })).toBe('');
    expect(organiserContactUrl({ contact_url: 'mailto:a@b.com' })).toBe('');
    expect(organiserContactUrl({})).toBe('');
    expect(organiserContactUrl(null)).toBe('');
    expect(organiserLinks({ contact_url: url })).toEqual([]);
  });
});
