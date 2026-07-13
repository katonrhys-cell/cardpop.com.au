import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/utils/compressImageBuffer.js', () => ({
  compressImageBuffer: vi.fn(async (buffer, mimetype) => ({ buffer, contentType: mimetype })),
}));

const mockUpload = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const mockGetPublicUrl = vi.hoisted(() => vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/x' } }));
const mockCreateSignedUrl = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed?token=t' }, error: null }));
const mockRemove = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const mockStorageFrom = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/supabaseClient.js', () => ({
  supabase: {
    storage: {
      from: mockStorageFrom,
    },
  },
}));

import { uploadImagesToSupabase, uploadPrivateImage, deletePrivateImage } from '../../src/api/integrated-ai.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/x' } });
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.com/signed?token=t' }, error: null });
  mockRemove.mockResolvedValue({ error: null });
  mockStorageFrom.mockReturnValue({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
    createSignedUrl: mockCreateSignedUrl,
    remove: mockRemove,
  });
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

describe('uploadPrivateImage / deletePrivateImage', () => {
  const file = {
    buffer: Buffer.from('fake-id-scan'),
    mimetype: 'image/jpeg',
    originalname: 'passport.jpg',
    detectedExt: 'jpg',
  };

  it('uploads to the private verification-docs bucket and returns a signed URL + path', async () => {
    const result = await uploadPrivateImage({ image: file, pathPrefix: 'ai-extract/user-1' });

    expect(mockStorageFrom).toHaveBeenCalledWith('verification-docs');
    const [path] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^ai-extract\/user-1\/[0-9a-f]{16}\.jpg$/);
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
    expect(result).toEqual({ signedUrl: 'https://example.com/signed?token=t', path });
  });

  it('deletes the freshly uploaded object when signing fails, and throws', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'nope' } });

    await expect(uploadPrivateImage({ image: file, pathPrefix: 'ai-extract/user-1' }))
      .rejects.toThrow(/could not sign/i);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('deletePrivateImage removes the object and no-ops on a null path', async () => {
    await deletePrivateImage('ai-extract/user-1/abc.jpg');
    expect(mockRemove).toHaveBeenCalledWith(['ai-extract/user-1/abc.jpg']);

    mockRemove.mockClear();
    await deletePrivateImage(null);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
