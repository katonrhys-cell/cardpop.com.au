import { describe, it, expect, vi, beforeEach } from 'vitest';

const upload = vi.fn();
const getPublicUrl = vi.fn((path) => ({ data: { publicUrl: `https://storage.test/events/${path}` } }));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { storage: { from: () => ({ upload, getPublicUrl }) } } }));
const compressImage = vi.fn(async () => new File(['c'], 'logo.webp', { type: 'image/webp' }));
vi.mock('@/utils/compressImage.js', () => ({ compressImage: (...a) => compressImage(...a) }));

import { uploadEventOrganiserLogo } from '@/utils/uploadEventOrganiserLogo.js';

describe('uploadEventOrganiserLogo', () => {
  beforeEach(() => { upload.mockReset().mockResolvedValue({ error: null }); compressImage.mockClear(); });

  it('compresses a still PNG and uploads it under logos/<uuid>.<ext> with no timestamp', async () => {
    const url = await uploadEventOrganiserLogo(new File(['p'], 'brand.png', { type: 'image/png' }));
    expect(compressImage).toHaveBeenCalledTimes(1);
    const [path, body, opts] = upload.mock.calls[0];
    expect(path).toMatch(/^logos\/[A-Za-z0-9-]+\.webp$/);
    expect(path).not.toMatch(/\d{13}/); // a 13-digit run would make imageUrl.js expect a .thumb.webp
    expect(body.type).toBe('image/webp');
    expect(opts).toMatchObject({ cacheControl: '31536000', contentType: 'image/webp' });
    expect(url).toBe(`https://storage.test/events/${path}`);
  });

  it('uploads an animated GIF and a video loop untouched', async () => {
    await uploadEventOrganiserLogo(new File(['g'], 'spin.gif', { type: 'image/gif' }));
    await uploadEventOrganiserLogo(new File(['v'], 'loop.mp4', { type: 'video/mp4' }));
    expect(compressImage).not.toHaveBeenCalled();
    expect(upload.mock.calls[0][0]).toMatch(/^logos\/.+\.gif$/);
    expect(upload.mock.calls[0][2].contentType).toBe('image/gif');
    expect(upload.mock.calls[1][0]).toMatch(/^logos\/.+\.mp4$/);
    expect(upload.mock.calls[1][2].contentType).toBe('video/mp4');
  });

  it('refuses a bad file before touching storage and surfaces an upload error', async () => {
    await expect(uploadEventOrganiserLogo(new File(['s'], 'x.svg', { type: 'image/svg+xml' }))).rejects.toThrow(/PNG, JPG/);
    expect(upload).not.toHaveBeenCalled();
    upload.mockResolvedValueOnce({ error: new Error('mime type video/mp4 is not supported') });
    await expect(uploadEventOrganiserLogo(new File(['v'], 'loop.mp4', { type: 'video/mp4' }))).rejects.toThrow(/not supported/);
  });
});
