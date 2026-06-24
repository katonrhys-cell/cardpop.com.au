import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockStream = vi.hoisted(() => vi.fn());
vi.mock('@/lib/integratedAiClient', () => ({ integratedAiClient: { stream: mockStream } }));
const mockGetSession = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { auth: { getSession: mockGetSession } } }));
const mockToast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ toast: mockToast }));

import { useIntegratedAi } from '@/hooks/use-integrated-ai.jsx';

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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:img');
});

describe('useIntegratedAi', () => {
  it('starts empty and finishes loading history', async () => {
    const { result } = renderHook(() => useIntegratedAi());
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false));
    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
  });

  it('appends a user message and streams the assistant content', async () => {
    mockStream.mockResolvedValue(streamResponse([
      sse({ type: 'content', data: { content: 'Hello ' } }),
      sse({ type: 'content', data: { content: 'world' } }),
      sse({ type: 'completed', data: {} }),
    ]));
    const { result } = renderHook(() => useIntegratedAi());
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false));

    await act(async () => { await result.current.sendMessage('Hi'); });

    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Hi' });
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', content: 'Hello world' });
    expect(result.current.isStreaming).toBe(false);
  });

  it('records object URLs for attached images', async () => {
    mockStream.mockResolvedValue(streamResponse([sse({ type: 'completed', data: {} })]));
    const { result } = renderHook(() => useIntegratedAi());
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false));

    const img = new File([new Uint8Array([1])], 'c.jpg', { type: 'image/jpeg' });
    await act(async () => { await result.current.sendMessage('look', [img]); });
    expect(result.current.messages[0].images).toEqual(['blob:img']);
  });

  it('appends generated images from tool results', async () => {
    mockStream.mockResolvedValue(streamResponse([
      sse({ type: 'tool_result', data: { tool_name: 'generate_image', content: 'https://img/gen.png' } }),
      sse({ type: 'completed', data: {} }),
    ]));
    const { result } = renderHook(() => useIntegratedAi());
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false));

    await act(async () => { await result.current.sendMessage('draw'); });
    expect(result.current.messages[1].images).toEqual(['https://img/gen.png']);
  });

  it('toasts and drops the empty assistant message on a stream error', async () => {
    mockStream.mockResolvedValue(streamResponse([
      sse({ type: 'error', data: { content: 'model error' } }),
    ]));
    const { result } = renderHook(() => useIntegratedAi());
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false));

    await act(async () => { await result.current.sendMessage('Hi'); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: 'model error' }));
    // The empty assistant placeholder is removed, leaving just the user message.
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('user');
  });

  it('clearMessages empties the conversation', async () => {
    mockStream.mockResolvedValue(streamResponse([sse({ type: 'completed', data: {} })]));
    const { result } = renderHook(() => useIntegratedAi());
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false));
    await act(async () => { await result.current.sendMessage('Hi'); });
    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => { result.current.clearMessages(); });
    expect(result.current.messages).toEqual([]);
  });
});
