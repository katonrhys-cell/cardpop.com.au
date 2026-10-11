import { describe, it, expect } from 'vitest';
import { profilePhotoUrl, isOfficialProfile, profilePhotoColumns } from '@/utils/profileAvatar.js';
import { sellerFromProfile } from '@/lib/sellerIdentity.js';

describe('profilePhotoUrl', () => {
  it('returns null with no profile or no photo', () => {
    expect(profilePhotoUrl(null)).toBeNull();
    expect(profilePhotoUrl({ display_name: 'A' })).toBeNull();
  });

  it('uses avatar_url when present', () => {
    expect(profilePhotoUrl({ avatar_url: 'https://example.com/a.png' })).toBe('https://example.com/a.png');
  });

  it('falls back to profile_photo_or_character (full URL or bucket path)', () => {
    expect(profilePhotoUrl({ profile_photo_or_character: 'https://example.com/b.png' })).toBe('https://example.com/b.png');
    expect(profilePhotoUrl({ profile_photo_or_character: 'avatars/u-1.webp' })).toContain('avatars/u-1.webp');
  });

  it('prefers avatar_url over profile_photo_or_character', () => {
    expect(profilePhotoUrl({ avatar_url: 'https://example.com/a.png', profile_photo_or_character: 'x.png' }))
      .toBe('https://example.com/a.png');
  });
});

describe('profile photo helpers', () => {
  it('flags only is_admin profiles as official', () => {
    expect(isOfficialProfile({ is_admin: true })).toBe(true);
    expect(isOfficialProfile({ is_admin: false })).toBe(false);
    expect(isOfficialProfile(null)).toBe(false);
  });

  it('writes both columns so set and remove stay in sync', () => {
    expect(profilePhotoColumns('u')).toEqual({ avatar_url: 'u', profile_photo_or_character: 'u' });
    expect(profilePhotoColumns(null)).toEqual({ avatar_url: null, profile_photo_or_character: null });
  });

  it('sellerFromProfile picks up profile_photo_or_character as the logo', () => {
    expect(sellerFromProfile({ id: '1', profile_photo_or_character: 'p.png' }).logoUrl).toBe('p.png');
  });
});
