import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// NOTE: the canvas-based preview generators (createSlabImagePreview /
// removeBackgroundPreview) rely on a real 2D canvas + Image decode which
// happy-dom does not implement, so they are exercised via manual/e2e checks.
// These tests cover the hook's state surface, the upload guard/flow, and reset.

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: mockFetch } }));
const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

import { usePhotoTemplate } from '@/hooks/usePhotoTemplate.js';

beforeEach(() => vi.clearAllMocks());

describe('usePhotoTemplate', () => {
  it('starts idle with no preview', () => {
    const { result } = renderHook(() => usePhotoTemplate());
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.previewUrl).toBeNull();
  });

  it('uploadProcessedImage throws and toasts when there is no processed image', async () => {
    const { result } = renderHook(() => usePhotoTemplate());
    await expect(
      act(async () => { await result.current.uploadProcessedImage('vault-1', 'slab'); }),
    ).rejects.toThrow(/no image to upload/i);
    expect(mockToast.error).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isProcessing).toBe(false);
  });

  it('reset returns the hook to its idle state', () => {
    const { result } = renderHook(() => usePhotoTemplate());
    act(() => { result.current.reset(); });
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.previewUrl).toBeNull();
  });
});
