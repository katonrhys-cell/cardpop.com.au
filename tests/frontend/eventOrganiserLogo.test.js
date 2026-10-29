import { describe, it, expect } from 'vitest';
import {
  logoFileError, isVideoLogoFile, isVideoLogoUrl, safeLogoUrl, logoAltText, LOGO_MAX_BYTES, LOGO_ACCEPT,
} from '@/utils/eventOrganiserLogo.js';

const file = (type, size = 1024, name = 'logo') => ({ type, size, name });

describe('utils/eventOrganiserLogo', () => {
  it('accepts still and animated images and short video loops', () => {
    for (const t of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']) {
      expect(logoFileError(file(t))).toBeNull();
      expect(LOGO_ACCEPT).toContain(t);
    }
  });

  it('refuses other types, oversize files and nothing at all', () => {
    expect(logoFileError(file('image/svg+xml'))).toMatch(/PNG, JPG, WebP or GIF/);
    expect(logoFileError(file('application/pdf'))).toMatch(/MP4/);
    expect(logoFileError(file('image/png', LOGO_MAX_BYTES + 1))).toMatch(/too big/);
    expect(logoFileError(null)).toBe('Choose a file.');
  });

  it('tells a video loop from an image, by file type and by stored URL', () => {
    expect(isVideoLogoFile(file('video/mp4'))).toBe(true);
    expect(isVideoLogoFile(file('image/gif'))).toBe(false);
    expect(isVideoLogoUrl('https://x.supabase.co/storage/v1/object/public/events/logos/abc.mp4')).toBe(true);
    expect(isVideoLogoUrl('https://x.supabase.co/storage/v1/object/public/events/logos/abc.webm?v=1')).toBe(true);
    expect(isVideoLogoUrl('https://x.supabase.co/storage/v1/object/public/events/logos/abc.gif')).toBe(false);
    expect(isVideoLogoUrl(null)).toBe(false);
  });

  it('only lets an http(s) URL through as a logo', () => {
    expect(safeLogoUrl(' https://cdn.test/logo.png ')).toBe('https://cdn.test/logo.png');
    expect(safeLogoUrl('javascript:alert(1)')).toBeNull();
    expect(safeLogoUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(safeLogoUrl('')).toBeNull();
    expect(safeLogoUrl(undefined)).toBeNull();
  });

  it('names the organiser in the alt text, falling back to the event', () => {
    expect(logoAltText({ organizer_name: 'Collect-It Con', name: 'Big Show' })).toBe('Collect-It Con logo');
    expect(logoAltText({ title: 'Big Show' })).toBe('Big Show logo');
    expect(logoAltText({})).toBe('Event organiser logo');
  });
});
