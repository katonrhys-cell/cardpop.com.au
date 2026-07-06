import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/utils/compressImageBuffer.js', () => ({
  compressImageBuffer: vi.fn(async (buffer, mimetype) => ({ buffer, contentType: mimetype })),
}));

const mockUpload = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const mockGetPublicUrl = vi.hoisted(() => vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/x' } }));
vi.mock('../../src/utils/supabaseClient.js', () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  },
}));

import { uploadImagesToSupabase } from '../../src/api/integrated-ai.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/x' } });
});

describe('uploadImagesToSupabase', () => {
  it('uses the magic-byte-detected extension, not the client-supplied filename', async () => {
    const file = {
      buffer: Buffer.from('fake-image-bytes'),
      mimetype: 'image/png',
      originalname: 'photo.png',
      detectedExt: 'png',
    };

    await uploadImagesToSupabase({ images: [file] });

    const [path] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^ocr\/[0-9a-f]{16}\.png$/);
  });

  it('does not let a client-controlled filename with no dot inject extra path segments into the storage key', async () => {
    // originalname.split('.').pop() on a dot-less string returns the WHOLE
    // string — a filename like "x/../../evil" would inject "/../../evil"
    // into the object key. detectedExt (from magic-byte sniffing) must be
    // used instead, regardless of what originalname contains.
    const file = {
      buffer: Buffer.from('fake-image-bytes'),
      mimetype: 'image/png',
      originalname: 'x/../../evil',
      detectedExt: 'png',
    };

    await uploadImagesToSupabase({ images: [file] });

    const [path] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^ocr\/[0-9a-f]{16}\.png$/);
    expect(path).not.toContain('..');
    expect(path).not.toContain('evil');
  });

  it('falls back to jpg when detectedExt is missing', async () => {
    const file = {
      buffer: Buffer.from('fake-image-bytes'),
      mimetype: 'image/jpeg',
      originalname: 'card.jpg',
    };

    await uploadImagesToSupabase({ images: [file] });

    const [path] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^ocr\/[0-9a-f]{16}\.jpg$/);
  });
});
