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

  it('sets no candidate and informs the user when no card is found', async () => {
    mockDetect.mockResolvedValue({ found: false });

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

  it('clear() discards the current candidate', async () => {
    mockDetect.mockResolvedValue({ found: true, blob: new Blob(['x']), url: 'u' });

    const { result } = renderHook(() => useCardCrop());
    await act(async () => { await result.current.detect('main', FILE); });
    expect(result.current.candidate).not.toBeNull();

    act(() => { result.current.clear(); });
    expect(result.current.candidate).toBeNull();
  });
});
