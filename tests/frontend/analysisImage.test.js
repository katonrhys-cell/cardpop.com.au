import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDetect = vi.hoisted(() => vi.fn());
vi.mock('@/utils/detectCard.js', () => ({ detectAndCropCard: mockDetect }));

import { prepareAnalysisImage } from '@/utils/analysisImage.js';

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
