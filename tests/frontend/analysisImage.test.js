import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDetect = vi.hoisted(() => vi.fn());
vi.mock('@/utils/detectCard.js', () => ({ detectAndCropCard: mockDetect }));

const mockCompress = vi.hoisted(() => vi.fn());
vi.mock('@/utils/compressImage.js', () => ({ compressImage: mockCompress }));

import { prepareAnalysisImage, prepareAnalysisImages } from '@/utils/analysisImage.js';

/** A File of a given byte size, for payload-budget arithmetic. */
const sized = (name, bytes) => new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });

const ORIGINAL = new File(['photo-bytes'], 'IMG_2461.jpeg', { type: 'image/jpeg' });

/** A successful detection returning a warped card of the given size. */
const found = (width = 1200, height = 1680) => ({
  found: true,
  blob: new Blob(['cropped-bytes'], { type: 'image/jpeg' }),
  width,
  height,
  url: 'data:image/jpeg;base64,x',
});

beforeEach(() => {
  vi.clearAllMocks();
  // By default compression shrinks a file to a comfortable 300 KB.
  mockCompress.mockImplementation(async (file) => sized(file.name, 300 * 1024));
});

describe('prepareAnalysisImage', () => {
  it('returns the rectified card when one is detected', async () => {
    mockDetect.mockResolvedValue(found());

    const { file, cropped } = await prepareAnalysisImage(ORIGINAL);

    expect(cropped).toBe(true);
    expect(file).not.toBe(ORIGINAL);
    expect(file.name).toBe('IMG_2461-analysis.jpg');
    expect(file.type).toBe('image/jpeg');
  });

  it('keeps the original when no card outline is found', async () => {
    mockDetect.mockResolvedValue({ found: false });

    const { file, cropped } = await prepareAnalysisImage(ORIGINAL);

    expect(cropped).toBe(false);
    expect(file).toBe(ORIGINAL);
  });

  it('keeps the original when detection throws', async () => {
    // OpenCV failing to load must never block a scan.
    mockDetect.mockRejectedValue(new Error('wasm load failed'));

    const { file, cropped } = await prepareAnalysisImage(ORIGINAL);

    expect(cropped).toBe(false);
    expect(file).toBe(ORIGINAL);
  });

  it('keeps the original when detection reports success but returns no blob', async () => {
    mockDetect.mockResolvedValue({ found: true, blob: null, width: 1200, height: 1680 });

    const { cropped } = await prepareAnalysisImage(ORIGINAL);

    expect(cropped).toBe(false);
  });

  it('rejects a warp too small to be worth trading the original for', async () => {
    mockDetect.mockResolvedValue(found(320, 448));

    const { file, cropped } = await prepareAnalysisImage(ORIGINAL);

    expect(cropped).toBe(false);
    expect(file).toBe(ORIGINAL);
  });

  it('accepts a landscape card measured on its long edge', async () => {
    mockDetect.mockResolvedValue(found(1680, 1200));

    const { cropped } = await prepareAnalysisImage(ORIGINAL);

    expect(cropped).toBe(true);
  });

  it('falls back to the original when detection outruns its budget', async () => {
    vi.useFakeTimers();
    mockDetect.mockReturnValue(new Promise(() => {})); // never settles

    const pending = prepareAnalysisImage(ORIGINAL, { timeoutMs: 8000 });
    await vi.advanceTimersByTimeAsync(8000);
    const { file, cropped } = await pending;

    expect(cropped).toBe(false);
    expect(file).toBe(ORIGINAL);
    vi.useRealTimers();
  });

  it('does not call detection without a file', async () => {
    const { file, cropped } = await prepareAnalysisImage(null);

    expect(cropped).toBe(false);
    expect(file).toBeNull();
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('handles a file with no extension in its name', async () => {
    mockDetect.mockResolvedValue(found());

    const { file } = await prepareAnalysisImage(new File(['x'], 'card', { type: 'image/jpeg' }));

    expect(file.name).toBe('card-analysis.jpg');
  });
});

describe('prepareAnalysisImages', () => {
  beforeEach(() => mockDetect.mockResolvedValue({ found: false }));

  it('resizes every image before it is sent', async () => {
    // The 413 this exists to prevent: raw phone photos are 3-5 MB each and
    // Vercel refuses a body over 4.5 MB before any of our code runs.
    const { files } = await prepareAnalysisImages([
      sized('front.jpg', 4 * 1024 * 1024),
      sized('back.jpg', 4 * 1024 * 1024),
    ]);

    expect(mockCompress).toHaveBeenCalledTimes(2);
    expect(files.every(f => f.size <= 300 * 1024)).toBe(true);
  });

  it('asks for JPEG, the format both third-party APIs accept', async () => {
    await prepareAnalysisImages([sized('front.jpg', 4 * 1024 * 1024)]);
    expect(mockCompress.mock.calls[0][1]).toMatchObject({ mimeType: 'image/jpeg' });
  });

  it('keeps the whole body under the payload budget by dropping extra angles', async () => {
    // Compression can't help enough on some inputs; the front is the read that
    // matters, so trailing angles go first.
    mockCompress.mockImplementation(async (file) => sized(file.name, 2 * 1024 * 1024));

    const { files, dropped } = await prepareAnalysisImages([
      sized('front.jpg', 5 * 1024 * 1024),
      sized('back.jpg', 5 * 1024 * 1024),
      sized('angle.jpg', 5 * 1024 * 1024),
    ]);

    expect(files).toHaveLength(1);
    expect(files[0].name).toContain('front');
    expect(dropped).toBe(2);
  });

  it('never drops the front, however large', async () => {
    mockCompress.mockImplementation(async (file) => sized(file.name, 9 * 1024 * 1024));
    const { files, dropped } = await prepareAnalysisImages([sized('front.jpg', 9 * 1024 * 1024)]);
    expect(files).toHaveLength(1);
    expect(dropped).toBe(0);
  });

  it('keeps everything when it already fits', async () => {
    const { files, dropped } = await prepareAnalysisImages([
      sized('front.jpg', 400 * 1024),
      sized('back.jpg', 400 * 1024),
    ]);
    expect(files).toHaveLength(2);
    expect(dropped).toBe(0);
  });

  it('still rectifies the front', async () => {
    mockDetect.mockResolvedValue(found());
    const { cropped } = await prepareAnalysisImages([sized('front.jpg', 4 * 1024 * 1024)]);
    expect(cropped).toBe(true);
  });

  it('keeps the original when compression fails', async () => {
    mockCompress.mockRejectedValue(new Error('canvas unavailable'));
    const original = sized('front.jpg', 400 * 1024);
    const { files } = await prepareAnalysisImages([original]);
    expect(files[0]).toBe(original);
  });

  it('drops blanks and handles no input', async () => {
    expect((await prepareAnalysisImages([null, undefined])).files).toEqual([]);
    expect((await prepareAnalysisImages(null)).files).toEqual([]);
  });
});
