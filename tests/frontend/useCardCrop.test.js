import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDetect = vi.hoisted(() => vi.fn());
vi.mock('@/utils/detectCard.js', () => ({ detectAndCropCard: mockDetect }));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

import { useCardCrop } from '@/hooks/useCardCrop.js';

const FILE = new File(['bytes'], 'charizard.jpg', { type: 'image/jpeg' });

beforeEach(() => vi.clearAllMocks());

describe('useCardCrop', () => {
  it('stores a candidate (with key + cropped File) on a successful detection', async () => {
    mockDetect.mockResolvedValue({
      found: true,
      blob: new Blob(['x'], { type: 'image/jpeg' }),
      url: 'data:image/jpeg;base64,abc',
    });

    const { result } = renderHook(() => useCardCrop());
    let returned;
    await act(async () => { returned = await result.current.detect('main', FILE); });

    expect(returned).toBe(true);
    expect(result.current.candidate.key).toBe('main');
    expect(result.current.candidate.croppedUrl).toBe('data:image/jpeg;base64,abc');
    expect(result.current.candidate.croppedFile).toBeInstanceOf(File);
    expect(result.current.candidate.croppedFile.name).toBe('charizard-cropped.jpg');
    expect(result.current.detectingKey).toBeNull();
  });

  it('preserves an arbitrary slot key (e.g. an extra-photo index)', async () => {
    mockDetect.mockResolvedValue({ found: true, blob: new Blob(['x']), url: 'u' });

    const { result } = renderHook(() => useCardCrop());
    await act(async () => { await result.current.detect(2, FILE); });

    expect(result.current.candidate.key).toBe(2);
  });

  it('reports an engine failure as an error, not as "no card found"', async () => {
    // An engine that never loaded says nothing about the photo — telling the
    // seller "no outline detected" sends them chasing lighting and angles.
    mockDetect.mockResolvedValue({ found: false, reason: 'engine' });

    const { result } = renderHook(() => useCardCrop());
    await act(async () => { await result.current.detect('main', FILE); });

    expect(mockToast.error).toHaveBeenCalled();
    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it('sets no candidate and informs the user when no card is found', async () => {
    mockDetect.mockResolvedValue({ found: false, reason: 'no-card' });

    const { result } = renderHook(() => useCardCrop());
    let returned;
    await act(async () => { returned = await result.current.detect('main', FILE); });

    expect(returned).toBe(false);
    expect(result.current.candidate).toBeNull();
    expect(mockToast.info).toHaveBeenCalled();
  });

  it('handles a detection error gracefully', async () => {
    mockDetect.mockRejectedValue(new Error('opencv exploded'));

    const { result } = renderHook(() => useCardCrop());
    let returned;
    await act(async () => { returned = await result.current.detect('main', FILE); });

    expect(returned).toBe(false);
    expect(result.current.candidate).toBeNull();
    expect(mockToast.error).toHaveBeenCalled();
  });

  it('does nothing without a file', async () => {
    const { result } = renderHook(() => useCardCrop());
    let returned;
    await act(async () => { returned = await result.current.detect('main', null); });

    expect(returned).toBe(false);
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('suppresses the not-found and error toasts in silent mode', async () => {
    const { result } = renderHook(() => useCardCrop());

    mockDetect.mockResolvedValue({ found: false });
    await act(async () => { await result.current.detect('main', FILE, { silent: true }); });
    expect(mockToast.info).not.toHaveBeenCalled();

    mockDetect.mockRejectedValue(new Error('opencv exploded'));
    await act(async () => { await result.current.detect('main', FILE, { silent: true }); });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('still stores a candidate found by a silent run', async () => {
    mockDetect.mockResolvedValue({ found: true, blob: new Blob(['x']), url: 'u' });

    const { result } = renderHook(() => useCardCrop());
    let returned;
    await act(async () => { returned = await result.current.detect('main', FILE, { silent: true }); });

    expect(returned).toBe(true);
    expect(result.current.candidate.key).toBe('main');
  });

  it('a superseded run cannot clobber the newer pick', async () => {
    // First detection resolves late, after a second photo was picked; the
    // stale result must be discarded rather than replacing the fresh one.
    let resolveFirst;
    mockDetect
      .mockImplementationOnce(() => new Promise(res => { resolveFirst = res; }))
      .mockResolvedValueOnce({ found: true, blob: new Blob(['new']), url: 'u-new' });

    const { result } = renderHook(() => useCardCrop());
    let first;
    await act(async () => {
      first = result.current.detect('main', FILE);
      await result.current.detect('main', FILE);
    });
    await act(async () => {
      resolveFirst({ found: true, blob: new Blob(['old']), url: 'u-old' });
      expect(await first).toBe(false);
    });

    expect(result.current.candidate.croppedUrl).toBe('u-new');
    expect(result.current.detectingKey).toBeNull();
  });

  it('clear() discards the current candidate', async () => {
    mockDetect.mockResolvedValue({ found: true, blob: new Blob(['x']), url: 'u' });

    const { result } = renderHook(() => useCardCrop());
    await act(async () => { await result.current.detect('main', FILE); });
    expect(result.current.candidate).not.toBeNull();

    act(() => { result.current.clear(); });
    expect(result.current.candidate).toBeNull();
  });
});
