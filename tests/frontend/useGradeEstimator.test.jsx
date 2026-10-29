import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockStream = vi.hoisted(() => vi.fn());
vi.mock('@/lib/integratedAiClient', () => ({ integratedAiClient: { stream: mockStream } }));
vi.mock('@/utils/compressImage.js', () => ({ compressImage: vi.fn(async (f) => f) }));

import { useGradeEstimator } from '@/hooks/useGradeEstimator.js';

// Build a fake SSE response whose body reader yields the given string chunks.
function streamResponse(chunks) {
  let i = 0;
  return {
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length
          ? { done: false, value: new TextEncoder().encode(chunks[i++]) }
          : { done: true, value: undefined }),
        cancel: vi.fn(),
      }),
    },
  };
}
const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`;
const file = () => new File([new Uint8Array([1])], 'c.jpg', { type: 'image/jpeg' });

beforeEach(() => vi.clearAllMocks());

describe('useGradeEstimator', () => {
  it('is a no-op without images', async () => {
    const { result } = renderHook(() => useGradeEstimator());
    await act(async () => { await result.current.estimateGrade([]); });
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('parses the streamed JSON grade result', async () => {
    mockStream.mockResolvedValue(streamResponse([
      sse({ type: 'content', data: { content: '{"psa":9,' } }),
      sse({ type: 'content', data: { content: '"bgs":9.5}' } }),
      sse({ type: 'completed', data: {} }),
    ]));
    const { result } = renderHook(() => useGradeEstimator());
    let data;
    await act(async () => { data = await result.current.estimateGrade([file()]); });
    expect(data).toEqual({ psa: 9, bgs: 9.5 });
    expect(result.current.result).toEqual({ psa: 9, bgs: 9.5 });
    expect(result.current.isAnalysing).toBe(false);
  });

  it('posts to the estimator\'s own 300 s function, not the shared 40 s API', async () => {
    mockStream.mockResolvedValue(streamResponse([
      sse({ type: 'content', data: { content: '{"psa":9}' } }),
      sse({ type: 'completed', data: {} }),
    ]));
    const { result } = renderHook(() => useGradeEstimator());
    await act(async () => { await result.current.estimateGrade([file()]); });
    expect(mockStream).toHaveBeenCalledWith('/estimate', expect.objectContaining({ baseUrl: '/grade-estimate' }));
  });

  it('surfaces an error event from the stream', async () => {
    mockStream.mockResolvedValue(streamResponse([
      sse({ type: 'error', data: { content: 'model overloaded' } }),
    ]));
    const { result } = renderHook(() => useGradeEstimator());
    await act(async () => { await result.current.estimateGrade([file()]); });
    expect(result.current.error).toBe('model overloaded');
  });

  it('errors when the content has no JSON object', async () => {
    mockStream.mockResolvedValue(streamResponse([
      sse({ type: 'content', data: { content: 'no json here' } }),
      sse({ type: 'completed', data: {} }),
    ]));
    const { result } = renderHook(() => useGradeEstimator());
    await act(async () => { await result.current.estimateGrade([file()]); });
    expect(result.current.error).toMatch(/could not extract grade/i);
  });

  it('reset clears result and error', async () => {
    mockStream.mockResolvedValue(streamResponse([
      sse({ type: 'content', data: { content: '{"psa":10}' } }),
      sse({ type: 'completed', data: {} }),
    ]));
    const { result } = renderHook(() => useGradeEstimator());
    await act(async () => { await result.current.estimateGrade([file()]); });
    act(() => { result.current.reset(); });
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
