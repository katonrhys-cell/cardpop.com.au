import { describe, it, expect, vi, beforeEach } from 'vitest';

const upload = vi.fn();
const getPublicUrl = vi.fn((path) => ({ data: { publicUrl: `https://storage.test/events/${path}` } }));
const storageFrom = vi.fn(() => ({ upload, getPublicUrl }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { storage: { from: (...a) => storageFrom(...a) } } }));

const compressImage = vi.fn(async (file) => new File(['full'], 'poster.webp', { type: 'image/webp' }));
const createThumbnail = vi.fn(async () => new File(['thumb'], 'poster.webp', { type: 'image/webp' }));
vi.mock('@/utils/compressImage.js', () => ({
  compressImage: (...a) => compressImage(...a),
  createThumbnail: (...a) => createThumbnail(...a),
}));

import { uploadEventImage } from '@/utils/uploadEventImage.js';

const picked = new File(['x'], 'poster.png', { type: 'image/png' });

describe('uploadEventImage', () => {
  beforeEach(() => {
    upload.mockReset().mockResolvedValue({ error: null });
    storageFrom.mockClear();
    createThumbnail.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('uploads the compressed image and its .thumb.webp companion to the events bucket', async () => {
    const url = await uploadEventImage(picked, { folder: 'events', stem: '1793400000000', upsert: true });
    expect(storageFrom).toHaveBeenCalledWith('events');
    expect(upload).toHaveBeenCalledTimes(2);
    const [[fullPath, fullFile, fullOpts], [thumbPath, thumbFile, thumbOpts]] = upload.mock.calls;
    expect(fullPath).toBe('events/1793400000000.webp');
    expect(fullFile.name).toBe('poster.webp');
    expect(fullOpts).toMatchObject({ upsert: true, cacheControl: '31536000' });
    expect(thumbPath).toBe('events/1793400000000.thumb.webp');
    expect(thumbFile.size).toBe(5);
    expect(thumbOpts).toMatchObject({ upsert: true, contentType: 'image/webp', cacheControl: '31536000' });
    // The thumb is made from the compressed full image, not the raw pick.
    expect(createThumbnail).toHaveBeenCalledWith(fullFile);
    expect(url).toBe('https://storage.test/events/events/1793400000000.webp');
  });

  it('throws when the full image fails and never attempts the thumb', async () => {
    upload.mockResolvedValueOnce({ error: new Error('new row violates row-level security policy') });
    await expect(uploadEventImage(picked, { folder: 'layouts', stem: 'e1-1793400000000' })).rejects.toThrow(/row-level security/);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(createThumbnail).not.toHaveBeenCalled();
  });

  it('still returns the full image URL when the thumb upload fails (best-effort)', async () => {
    upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('boom') });
    const url = await uploadEventImage(picked, { folder: 'events/gallery', stem: '1793400000000-0-0-abcde' });
    expect(url).toBe('https://storage.test/events/events/gallery/1793400000000-0-0-abcde.webp');
    expect(console.warn).toHaveBeenCalled();
  });

  it('still returns the full image URL when thumbnail generation throws', async () => {
    createThumbnail.mockRejectedValueOnce(new Error('canvas unavailable'));
    const url = await uploadEventImage(picked, { folder: 'events', stem: '1793400000000' });
    expect(url).toContain('events/1793400000000.webp');
    expect(upload).toHaveBeenCalledTimes(1);
  });
});
